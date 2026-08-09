import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Cloud,
  Library,
  ListMusic,
  Music2,
  Play,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { supabase, supabaseErrorMessage, type SavedUserPlaylist } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatPlaybackTime, type WorshipQueueItem } from '../data/worshipQueue';

interface SavedPlaylistsModalProps {
  currentQueue: WorshipQueueItem[];
  onLoadPlaylist: (items: WorshipQueueItem[]) => void;
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
    <li className="saved-service-card">
      <div className="saved-service-card__cover">
        <VideoThumbnail item={items[0]} className="saved-service-card__cover-image" />
        <span className="saved-service-card__cover-count"><Play size={13} fill="currentColor" /> {items.length} video{items.length === 1 ? '' : 's'}</span>
      </div>

      <div className="saved-service-card__body">
        <div className="saved-service-card__heading">
          <div>
            <span className="saved-service-card__eyebrow">{serviceDate ? 'Planned service' : 'Saved service'}</span>
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
            <button type="button" className="saved-service-card__open" onClick={() => onOpen(playlist)} disabled={!items.length}>
              <Play size={15} fill="currentColor" /> Open service
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

function CurrentServicePreview({ items }: { items: WorshipQueueItem[] }) {
  return (
    <div className={`current-service-preview ${items.length ? '' : 'is-empty'}`.trim()}>
      <div className="current-service-preview__images">
        {items.length ? items.slice(0, 3).map((item, index) => (
          <VideoThumbnail key={`${item.id}-${index}`} item={item} />
        )) : <VideoThumbnail />}
      </div>
      <div>
        <strong>{items.length ? `${items.length} video${items.length === 1 ? '' : 's'} ready to save` : 'Your current service is empty'}</strong>
        <span>{items.length ? items.slice(0, 2).map((item) => item.title).join(' · ') : 'Add videos from the catalogue first.'}</span>
      </div>
    </div>
  );
}

export function SavedPlaylistsModal({ currentQueue, onLoadPlaylist, onClose }: SavedPlaylistsModalProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const [playlists, setPlaylists] = useState<SavedUserPlaylist[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const handleSaveCurrentQueue = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!newTitle.trim()) {
      setError('Give this service a name before saving it.');
      return;
    }

    if (!currentQueue.length) {
      setError('Your current service is empty. Add videos before saving.');
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
          items: currentQueue,
          service_date: serviceDate || null,
          notes: notes.trim() || null,
        })
        .select('id,user_id,title,items,service_date,notes,created_at,updated_at')
        .single();

      if (saveError) {
        setError(saveError.message);
      } else {
        setSuccess(`Saved “${newTitle.trim()}” to your service library.`);
        setNewTitle('');
        setServiceDate('');
        setNotes('');
        if (data) setPlaylists((current) => [data as SavedUserPlaylist, ...current]);
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
        setSuccess(`Deleted “${playlist.title}”.`);
      }
    } catch (err: unknown) {
      setError(supabaseErrorMessage(err, 'Failed to delete this service.'));
    } finally {
      setDeletingId(null);
      setDeleteCandidateId(null);
    }
  };

  const openPlaylist = (playlist: SavedUserPlaylist) => {
    const items = Array.isArray(playlist.items) ? playlist.items : [];
    if (!items.length) return;
    onLoadPlaylist(items);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card--playlists modal-card--service-library"
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
              <p>See each service at a glance, reopen its videos and keep future worship plans together.</p>
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
                <strong>{playlists.length} saved</strong>
              </div>

              {loading ? (
                <div className="service-library-loading" role="status">
                  <span className="service-library-loading__image" />
                  <span><strong>Loading your services…</strong><small>Bringing back your videos and service notes.</small></span>
                </div>
              ) : playlists.length === 0 ? (
                <div className="empty-playlists">
                  <span className="empty-playlists__icon"><ListMusic size={28} /></span>
                  <h5>Your first saved service will appear here</h5>
                  <p>Build a playlist, then use the form alongside to save its running order, video trims and notes.</p>
                </div>
              ) : (
                <ul className="saved-playlists__items">
                  {playlists.map((playlist) => (
                    <SavedServiceCard
                      key={playlist.id}
                      playlist={playlist}
                      deleteCandidateId={deleteCandidateId}
                      deletingId={deletingId}
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
              <form onSubmit={handleSaveCurrentQueue} className="save-queue-box save-queue-box--rich">
                <span className="save-service-panel__eyebrow"><Save size={14} /> Current service</span>
                <h4 id="save-current-service-heading">Save this plan</h4>
                <p className="save-service-panel__intro">Keep the exact running order and any video trims for another device or service.</p>

                <CurrentServicePreview items={currentQueue} />

                <label className="save-service-form__field">
                  <span>Service name</span>
                  <input
                    type="text"
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

                <button type="submit" className="btn-primary save-service-panel__submit" disabled={saving || !currentQueue.length}>
                  <Save size={15} /> {saving ? 'Saving service…' : 'Save to my library'}
                </button>
                <p className="save-queue-box__hint">Saved services are private to your account.</p>
              </form>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
