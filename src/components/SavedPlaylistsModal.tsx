import { useState, useEffect } from 'react';
import { Cloud, Trash2, Play, Save, X, Calendar, Music, AlertCircle } from 'lucide-react';
import { supabase, type SavedUserPlaylist } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { WorshipQueueItem } from '../data/worshipQueue';

interface SavedPlaylistsModalProps {
  currentQueue: WorshipQueueItem[];
  onLoadPlaylist: (items: WorshipQueueItem[]) => void;
  onClose: () => void;
}

export function SavedPlaylistsModal({ currentQueue, onLoadPlaylist, onClose }: SavedPlaylistsModalProps) {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<SavedUserPlaylist[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUserPlaylists = async () => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_playlists')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        setError(error.message);
      } else if (data) {
        setPlaylists(data as SavedUserPlaylist[]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch playlists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPlaylists();
  }, [user]);

  const handleSaveCurrentQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newTitle.trim()) {
      setError('Please enter a name for your playlist.');
      return;
    }

    if (!currentQueue.length) {
      setError('Your active playlist is empty. Add some videos before saving!');
      return;
    }

    if (!supabase || !user) {
      setError('You must be signed in to save playlists to your cloud account.');
      return;
    }

    try {
      setSaving(true);
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('user_playlists')
        .insert({
          user_id: user.id,
          title: newTitle.trim(),
          items: currentQueue,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        setError(error.message);
      } else {
        setSuccess(`✓ Saved "${newTitle.trim()}" to your cloud account!`);
        setNewTitle('');
        if (data) {
          setPlaylists([data as SavedUserPlaylist, ...playlists]);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save playlist.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlaylist = async (id: string, title: string) => {
    if (!window.confirm(`Delete saved playlist "${title}"?`)) return;
    if (!supabase || !user) return;

    try {
      const { error } = await supabase
        .from('user_playlists')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        setError(error.message);
      } else {
        setPlaylists(playlists.filter((p) => p.id !== id));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete playlist.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--playlists" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Cloud size={18} /> My Saved Cloud Playlists</h3>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {/* Save Current Queue Box */}
          <form onSubmit={handleSaveCurrentQueue} className="save-queue-box">
            <h4>Save Active Playlist to Cloud</h4>
            <div className="save-queue-box__row">
              <input
                type="text"
                placeholder="e.g. Sunday Morning Service - 10 Aug..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={saving || !currentQueue.length}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save Playlist'}
              </button>
            </div>
            <p className="save-queue-box__hint">
              Current queue contains {currentQueue.length} video{currentQueue.length === 1 ? '' : 's'}.
            </p>
          </form>

          {error && <div className="auth-alert auth-alert--error">{error}</div>}
          {success && <div className="auth-alert auth-alert--success">{success}</div>}

          {/* Saved Playlists List */}
          <div className="saved-playlists-list">
            <h4>Your Saved Service Playlists ({playlists.length})</h4>

            {loading ? (
              <p className="loading-state">Loading your saved playlists...</p>
            ) : playlists.length === 0 ? (
              <div className="empty-playlists">
                <Music size={32} />
                <p>No saved cloud playlists found.</p>
                <span>Add videos to your playlist and enter a title above to save your first service playlist!</span>
              </div>
            ) : (
              <ul className="saved-playlists__items">
                {playlists.map((pl) => (
                  <li key={pl.id} className="saved-playlist-card">
                    <div className="saved-playlist-card__info">
                      <strong>{pl.title}</strong>
                      <div className="saved-playlist-card__meta">
                        <span><Music size={12} /> {pl.items.length} song{pl.items.length === 1 ? '' : 's'}</span>
                        <span><Calendar size={12} /> {new Date(pl.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="saved-playlist-card__actions">
                      <button
                        type="button"
                        className="btn-primary-sm"
                        onClick={() => {
                          onLoadPlaylist(pl.items);
                          onClose();
                        }}
                      >
                        <Play size={13} /> Load Playlist
                      </button>
                      <button
                        type="button"
                        className="btn-icon-danger"
                        onClick={() => handleDeletePlaylist(pl.id, pl.title)}
                        title="Delete Playlist"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
