import { useCallback, useEffect, useState } from 'react';
import { Cloud, Trash2, Play, Save, X, Calendar, Music } from 'lucide-react';
import { supabase, supabaseErrorMessage, type SavedUserPlaylist } from '../lib/supabase';
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
  const [serviceDate, setServiceDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUserPlaylists = useCallback(async () => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_playlists')
        .select('id,user_id,title,items,service_date,notes,created_at,updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) {
        setError(error.message);
      } else if (data) {
        setPlaylists(data as SavedUserPlaylist[]);
      }
    } catch (err: unknown) {
      setError(supabaseErrorMessage(err, 'Failed to fetch playlists.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchUserPlaylists();
  }, [fetchUserPlaylists]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

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
      const { data, error } = await supabase
        .from('user_playlists')
        .insert({
          user_id: user.id,
          title: newTitle.trim(),
          items: currentQueue,
          service_date: serviceDate || null,
          notes: notes.trim() || null,
        })
        .select('id,user_id,title,items,service_date,notes,created_at,updated_at')
        .single();

      if (error) {
        setError(error.message);
      } else {
        setSuccess(`✓ Saved "${newTitle.trim()}" to your cloud account!`);
        setNewTitle('');
        setServiceDate('');
        setNotes('');
        if (data) {
          setPlaylists((current) => [data as SavedUserPlaylist, ...current]);
        }
      }
    } catch (err: unknown) {
      setError(supabaseErrorMessage(err, 'Failed to save playlist.'));
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
        setPlaylists((current) => current.filter((playlist) => playlist.id !== id));
      }
    } catch (err: unknown) {
      setError(supabaseErrorMessage(err, 'Failed to delete playlist.'));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card--playlists"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-playlists-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="saved-playlists-title"><Cloud size={18} /> My Saved Cloud Playlists</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close saved playlists"><X size={18} /></button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSaveCurrentQueue} className="save-queue-box">
            <h4>Save this service</h4>
            <div className="save-queue-box__row">
              <input
                type="text"
                maxLength={120}
                aria-label="Playlist name"
                placeholder="e.g. Sunday morning worship"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={saving || !currentQueue.length}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save service'}
              </button>
            </div>
            <div className="save-queue-box__details">
              <label>Service date <span>(optional)</span><input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} /></label>
              <label>Notes <span>(optional)</span><input type="text" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Theme, speaker or service notes" /></label>
            </div>
            <p className="save-queue-box__hint">
              Current queue contains {currentQueue.length} video{currentQueue.length === 1 ? '' : 's'}.
            </p>
          </form>

          {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}
          {success && <div className="auth-alert auth-alert--success" role="status">{success}</div>}

          {/* Saved Playlists List */}
          <div className="saved-playlists-list">
            <h4>Your saved services ({playlists.length})</h4>

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
                        <span><Calendar size={12} /> {pl.service_date ? new Date(`${pl.service_date}T12:00:00`).toLocaleDateString() : `Saved ${new Date(pl.updated_at).toLocaleDateString()}`}</span>
                      </div>
                      {pl.notes && <p className="saved-playlist-card__notes">{pl.notes}</p>}
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
                        <Play size={13} /> Open service
                      </button>
                      <button
                        type="button"
                        className="btn-icon-danger"
                        onClick={() => handleDeletePlaylist(pl.id, pl.title)}
                        title="Delete Playlist"
                        aria-label={`Delete ${pl.title}`}
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
