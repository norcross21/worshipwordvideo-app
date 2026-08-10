import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Cloud,
  Library,
  ListMusic,
  Music2,
  Plus,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import { supabase, supabaseErrorMessage, type SavedUserPlaylist } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatPlaybackTime, type WorshipQueueItem } from '../data/worshipQueue';

interface SavedPlaylistsModalProps {
  activePlaylistId: string | null;
  activePlaylist?: SavedUserPlaylist | null;
  pendingItem?: WorshipQueueItem | null;
  initialMode?: 'create' | 'manage';
  onActivatePlaylist: (playlist: SavedUserPlaylist) => Promise<void> | void;
  onPlaylistDeleted?: (playlistId: string) => void;
  onClose: () => void;
}

interface VideoThumbnailProps {
  item?: WorshipQueueItem;
  className?: string;
}

interface SavedServiceCardProps {
  playlist: SavedUserPlaylist;
  deleteCandidateId: string | null;
  deletingId: string | null;
  openingId: string | null;
  isActive: boolean;
  onOpen: (playlist: SavedUserPlaylist) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (playlist: SavedUserPlaylist) => void;
}

const serviceDateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const savedDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function VideoThumbnail({ item, className = '' }: VideoThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const classes = `service-video-thumbnail ${className}`.trim();

  return (
    <span className={classes} aria-hidden="true">
      {item?.youtubeId && !failed ? (
        <img
          src={`https://i.ytimg.com/vi/${encodeURIComponent(item.youtubeId)}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Music2 size={22} />
      )}
    </span>
  );
}

function formatServiceDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : serviceDateFormatter.format(date);
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently updated' : `Updated ${savedDateFormatter.format(date)}`;
}

function trimSummary(item: WorshipQueueItem) {
  if (item.startSeconds == null && item.endSeconds == null) return null;
  return `${formatPlaybackTime(item.startSeconds) || '0:00'}–${formatPlaybackTime(item.endSeconds) || 'end'}`;
}

function SavedServiceCard({
  playlist,
  deleteCandidateId,
  deletingId,
  openingId,
  isActive,
  onOpen,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: SavedServiceCardProps) {
  const items = Array.isArray(playlist.items) ? playlist.items : [];
  const serviceDate = formatServiceDate(playlist.service_date);
  const isConfirmingDelete = deleteCandidateId === playlist.id;
  const isDeleting = deletingId === playlist.id;
  const previewItems = items.slice(0, 3);

  return (
    <li className={`saved-service-card ${isActive ? 'is-active' : ''}`}>
      <div className="saved-service-card__cover">
        <VideoThumbnail item={items[0]} className="saved-service-card__cover-image" />
        <span className="saved-service-card__cover-count"><Play size={13} fill="currentColor" /> {items.length} video{items.length === 1 ? '' : 's'}</span>
      </div>

      <div className="saved-service-card__body">
        <div className="saved-service-card__heading">
          <div>
            <span className="saved-service-card__eyebrow">{isActive ? 'Active service' : serviceDate ? 'Planned service' : 'Saved service'}</span>
            <h5>{playlist.title}</h5>
          </div>
          {serviceDate ? (
            <time dateTime={playlist.service_date ?? undefined} className="saved-service-card__date"><CalendarDays size={14} /> {serviceDate}</time>
          ) : (
            <span className="saved-service-card__date"><Clock3 size={14} /> {formatUpdatedAt(playlist.updated_at)}</span>
          )}
        </div>

        {playlist.notes ? <p className="saved-service-card__notes">{playlist.notes}</p> : null}

        {previewItems.length > 0 ? (
          <ol className="saved-service-card__songs" aria-label={`First songs in ${playlist.title}`}>
            {previewItems.map((item, index) => {
              const timing = trimSummary(item);
              return (
                <li key={`${item.id}-${index}`}>
                  <VideoThumbnail item={item} className="saved-service-card__song-image" />
                  <span className="saved-service-card__song-number">{index + 1}</span>
                  <span className="saved-service-card__song-copy">
                    <strong>{item.title}</strong>
                    <small>{item.artist}</small>
                  </span>
                  {timing ? <span className="saved-service-card__trim">Trim {timing}</span> : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="saved-service-card__no-videos"><Music2 size={17} /> No videos saved in this service.</div>
        )}

        {items.length > previewItems.length ? (
          <p className="saved-service-card__more">+ {items.length - previewItems.length} more video{items.length - previewItems.length === 1 ? '' : 's'} in this service</p>
        ) : null}

        <div className="saved-service-card__footer">
          <span>{serviceDate ? formatUpdatedAt(playlist.updated_at) : 'Ready to open and edit'}</span>
          <div className="saved-service-card__actions">
            <button type="button" className="saved-service-card__open" onClick={() => onOpen(playlist)} disabled={openingId === playlist.id}>
              <Play size={15} fill="currentColor" /> {openingId === playlist.id ? 'Opening…' : isActive ? 'Continue service' : 'Open service'}
            </button>
            {isConfirmingDelete ? (
              <div className="saved-service-card__delete-confirm" role="group" aria-label={`Confirm deletion of ${playlist.title}`}>
                <span>Delete?</span>
                <button type="button" onClick={onCancelDelete} disabled={isDeleting}>Keep</button>
                <button type="button" className="is-danger" onClick={() => onConfirmDelete(playlist)} disabled={isDeleting}>
                  {isDeleting ? 'Deleting…' : 'Yes'}
                </button>
              </div>
            ) : (
              <button type="button" className="saved-service-card__delete" onClick={() => onRequestDelete(playlist.id)} aria-label={`Delete ${playlist.title}`} title="Delete saved service">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function SavedPlaylistsModal({
  activePlaylistId,
  activePlaylist = null,
  pendingItem = null,
  initialMode = 'manage',
  onActivatePlaylist,
  onPlaylistDeleted,
  onClose,
}: SavedPlaylistsModalProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const [playlists, setPlaylists] = useState<SavedUserPlaylist[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const displayedPlaylists = playlists.map((playlist) => playlist.id === activePlaylist?.id
    ? { ...playlist, items: activePlaylist.items, updated_at: activePlaylist.updated_at }
    : playlist);

  const fetchUserPlaylists = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('user_playlists')
        .select('id,user_id,title,items,service_date,notes,created_at,updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (fetchError) {
        setError(fetchError.message);
      } else if (data) {
        setPlaylists(data as SavedUserPlaylist[]);
      }
    } catch (err: unknown) {
      setError(supabaseErrorMessage(err, 'Failed to fetch saved services.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

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

  const handleCreateService = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!newTitle.trim()) {
      setError('Give this service a name before saving it.');
      return;
    }

    if (!supabase || !userId) {
      setError('You must be signed in to save services to your account.');
      return;
    }

    try {
      setSaving(true);
      const { data, error: saveError } = await supabase
        .from('user_playlists')
        .insert({
          user_id: userId,
          title: newTitle.trim(),
          items: [],
          service_date: serviceDate || null,
          notes: notes.trim() || null,
        })
        .select('id,user_id,title,items,service_date,notes,created_at,updated_at')
        .single();

      if (saveError) {
        setError(saveError.message);
      } else {
        setSuccess(`Created “${newTitle.trim()}”.`);
        setNewTitle('');
        setServiceDate('');
        setNotes('');
        if (data) {
          const playlist = data as SavedUserPlaylist;
          setPlaylists((current) => [playlist, ...current]);
          await onActivatePlaylist(playlist);
          onClose();
        }
      }
    } catch (err: unknown) {
      setError(supabaseErrorMessage(err, 'Failed to save this service.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlaylist = async (playlist: SavedUserPlaylist) => {
    if (!supabase || !userId) return;

    try {
      setError('');
      setSuccess('');
      setDeletingId(playlist.id);
      const { error: deleteError } = await supabase
        .from('user_playlists')
        .delete()
        .eq('id', playlist.id)
        .eq('user_id', userId);

      if (deleteError) {
        setError(deleteError.message);
      } else {
        setPlaylists((current) => current.filter((item) => item.id !== playlist.id));
        onPlaylistDeleted?.(playlist.id);
        setSuccess(`Deleted “${playlist.title}”.`);
      }
    } catch (err: unknown) {
      setError(supabaseErrorMessage(err, 'Failed to delete this service.'));
    } finally {
      setDeletingId(null);
      setDeleteCandidateId(null);
    }
  };

  const openPlaylist = async (playlist: SavedUserPlaylist) => {
    setError('');
    setOpeningId(playlist.id);
    try {
      await onActivatePlaylist(playlist);
      onClose();
    } catch (openError) {
      setError(supabaseErrorMessage(openError, 'This service could not be opened.'));
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-card modal-card--playlists modal-card--service-library is-${initialMode}-mode`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-playlists-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header modal-header--services">
          <div className="saved-services-header">
            <span className="saved-services-header__icon"><Library size={22} /></span>
            <div>
              <span className="saved-services-header__eyebrow">Your planning space</span>
              <h3 id="saved-playlists-title">Saved services</h3>
              <p>Create a service first, then switch between services and add videos to the one you have open.</p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close saved services"><X size={20} /></button>
        </div>

        <div className="modal-body saved-services-modal__body">
          {error ? <div className="auth-alert auth-alert--error" role="alert">{error}</div> : null}
          {success ? <div className="auth-alert auth-alert--success" role="status"><CheckCircle2 size={16} /> {success}</div> : null}

          <div className="saved-services-layout">
            <section className="service-library" aria-labelledby="service-library-heading">
              <div className="service-library__heading">
                <div>
                  <span><Cloud size={15} /> Stored securely in your account</span>
                  <h4 id="service-library-heading">Your service library</h4>
                </div>
                <strong>{displayedPlaylists.length} saved</strong>
              </div>

              {loading ? (
                <div className="service-library-loading" role="status">
                  <span className="service-library-loading__image" />
                  <span><strong>Loading your services…</strong><small>Bringing back your videos and service notes.</small></span>
                </div>
              ) : displayedPlaylists.length === 0 ? (
                <div className="empty-playlists">
                  <span className="empty-playlists__icon"><ListMusic size={28} /></span>
                  <h5>Your first saved service will appear here</h5>
                  <p>Create a named service using the form alongside. It can start empty, ready for you to add videos.</p>
                </div>
              ) : (
                <ul className="saved-playlists__items">
                  {displayedPlaylists.map((playlist) => (
                    <SavedServiceCard
                      key={playlist.id}
                      playlist={playlist}
                      deleteCandidateId={deleteCandidateId}
                      deletingId={deletingId}
                      openingId={openingId}
                      isActive={playlist.id === activePlaylistId}
                      onOpen={openPlaylist}
                      onRequestDelete={setDeleteCandidateId}
                      onCancelDelete={() => setDeleteCandidateId(null)}
                      onConfirmDelete={(item) => void handleDeletePlaylist(item)}
                    />
                  ))}
                </ul>
              )}
            </section>

            <aside className="save-service-panel" aria-labelledby="save-current-service-heading">
              <form onSubmit={handleCreateService} className="save-queue-box save-queue-box--rich">
                <span className="save-service-panel__eyebrow"><Plus size={14} /> New service</span>
                <h4 id="save-current-service-heading">Create a service</h4>
                <p className="save-service-panel__intro">Name the service first. It opens immediately, and every video you add afterwards is saved into it.</p>

                {pendingItem ? (
                  <div className="pending-service-video">
                    <VideoThumbnail item={pendingItem} />
                    <span><strong>{pendingItem.title}</strong><small>This video will be added as soon as you create or choose a service.</small></span>
                  </div>
                ) : null}

                <label className="save-service-form__field">
                  <span>Service name</span>
                  <input
                    type="text"
                    autoFocus={initialMode === 'create'}
                    maxLength={120}
                    placeholder="Sunday morning worship"
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                  />
                </label>

                <label className="save-service-form__field">
                  <span>Service date <small>Optional</small></span>
                  <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} />
                </label>

                <label className="save-service-form__field">
                  <span>Notes <small>Optional</small></span>
                  <textarea rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Theme, speaker or anything to remember" />
                </label>

                <button type="submit" className="btn-primary save-service-panel__submit" disabled={saving}>
                  <Plus size={15} /> {saving ? 'Creating service…' : 'Create and open service'}
                </button>
                <p className="save-queue-box__hint">Services are private to your account and automatically updated as you plan.</p>
              </form>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
