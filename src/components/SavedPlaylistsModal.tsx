import { useState } from 'react';
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  HardDrive,
  Library,
  ListMusic,
  Music2,
  Plus,
  Play,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  createSavedService,
  deleteSavedService,
  loadSavedServices,
  upsertSavedService,
  type SavedService,
} from '../data/localServices';
import { formatPlaybackTime, type WorshipQueueItem } from '../data/worshipQueue';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
import { recordUsageEvent } from '../lib/usageAnalytics';

interface SavedPlaylistsModalProps {
  activePlaylistId: string | null;
  activePlaylist?: SavedService | null;
  pendingItem?: WorshipQueueItem | null;
  initialMode?: 'create' | 'manage';
  onActivatePlaylist: (playlist: SavedService) => Promise<void> | void;
  onPlaylistUpsert?: (playlist: SavedService) => void;
  onPlaylistDeleted?: (playlistId: string) => void;
  onClose: () => void;
}

interface VideoThumbnailProps {
  item?: WorshipQueueItem;
  className?: string;
}

interface SavedServiceCardProps {
  playlist: SavedService;
  deleteCandidateId: string | null;
  deletingId: string | null;
  openingId: string | null;
  isActive: boolean;
  isArchived: boolean;
  onOpen: (playlist: SavedService) => void;
  onDuplicate: (playlist: SavedService) => void;
  onArchive: (playlist: SavedService) => void;
  onRename: (playlist: SavedService, title: string) => Promise<boolean>;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (playlist: SavedService) => void;
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
  isArchived,
  onOpen,
  onDuplicate,
  onArchive,
  onRename,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: SavedServiceCardProps) {
  const items = Array.isArray(playlist.items) ? playlist.items : [];
  const serviceDate = formatServiceDate(playlist.service_date);
  const isConfirmingDelete = deleteCandidateId === playlist.id;
  const isDeleting = deletingId === playlist.id;
  const previewItems = items.slice(0, 3);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(playlist.title);
  const [renaming, setRenaming] = useState(false);

  const saveTitle = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextTitle = titleDraft.trim();
    if (!nextTitle || nextTitle === playlist.title) {
      setTitleDraft(playlist.title);
      setEditingTitle(false);
      return;
    }
    setRenaming(true);
    const renamed = await onRename(playlist, nextTitle);
    setRenaming(false);
    if (renamed) setEditingTitle(false);
  };

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
            {editingTitle ? (
              <form className="saved-service-card__rename" onSubmit={(event) => void saveTitle(event)}>
                <input autoFocus maxLength={120} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} aria-label={`Rename ${playlist.title}`} />
                <button type="submit" disabled={renaming}>{renaming ? 'Saving…' : 'Save'}</button>
                <button type="button" onClick={() => { setTitleDraft(playlist.title); setEditingTitle(false); }}>Cancel</button>
              </form>
            ) : <h5>{playlist.title}</h5>}
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
            {!isArchived && <button type="button" className="saved-service-card__open" onClick={() => onOpen(playlist)} disabled={openingId === playlist.id}>
              <Play size={15} fill="currentColor" /> {openingId === playlist.id ? 'Opening…' : isActive ? 'Continue service' : 'Open service'}
            </button>}
            {!isArchived && <button type="button" className="saved-service-card__utility" onClick={() => setEditingTitle(true)} aria-label={`Rename ${playlist.title}`} title="Rename service"><Pencil size={15} /></button>}
            {!isArchived && <button type="button" className="saved-service-card__utility" onClick={() => onDuplicate(playlist)} aria-label={`Duplicate ${playlist.title}`} title="Duplicate service"><Copy size={15} /></button>}
            <button type="button" className="saved-service-card__utility" onClick={() => onArchive(playlist)} aria-label={`${isArchived ? 'Restore' : 'Archive'} ${playlist.title}`} title={`${isArchived ? 'Restore' : 'Archive'} service`}>{isArchived ? <RotateCcw size={15} /> : <Archive size={15} />}</button>
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
  onPlaylistUpsert,
  onPlaylistDeleted,
  onClose,
}: SavedPlaylistsModalProps) {
  const [playlists, setPlaylists] = useState<SavedService[]>(loadSavedServices);
  const [newTitle, setNewTitle] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const dialogRef = useAccessibleDialog<HTMLDivElement>(onClose);
  const displayedPlaylists = playlists.map((playlist) => playlist.id === activePlaylist?.id
    ? { ...playlist, items: activePlaylist.items, updated_at: activePlaylist.updated_at }
    : playlist).filter((playlist) => showArchived ? Boolean(playlist.archived_at) : !playlist.archived_at);

  const handleCreateService = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!newTitle.trim()) {
      setError('Give this service a name before saving it.');
      return;
    }

    try {
      setSaving(true);
      const playlist = createSavedService({ title: newTitle, serviceDate, notes });
      const next = upsertSavedService(playlist);
      setSuccess(`Created “${playlist.title}”.`);
      setNewTitle('');
      setServiceDate('');
      setNotes('');
      recordUsageEvent('service_create');
      setPlaylists(next);
      await onActivatePlaylist(playlist);
      onClose();
    } catch {
      setError('This service could not be saved in your browser. Check that site storage is allowed and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlaylist = (playlist: SavedService) => {
    try {
      setError('');
      setSuccess('');
      setDeletingId(playlist.id);
      setPlaylists(deleteSavedService(playlist.id));
      onPlaylistDeleted?.(playlist.id);
      setSuccess(`Deleted “${playlist.title}”.`);
    } catch {
      setError('This service could not be deleted from your browser.');
    } finally {
      setDeletingId(null);
      setDeleteCandidateId(null);
    }
  };

  const handleRenamePlaylist = async (playlist: SavedService, title: string): Promise<boolean> => {
    setError('');
    const renamed = { ...playlist, title, updated_at: new Date().toISOString() };
    setPlaylists(upsertSavedService(renamed));
    onPlaylistUpsert?.(renamed);
    if (activePlaylistId === renamed.id) await onActivatePlaylist(renamed);
    setSuccess(`Renamed service to “${renamed.title}”.`);
    return true;
  };

  const handleDuplicatePlaylist = (playlist: SavedService) => {
    setError('');
    setSuccess('');
    const copyTitle = `${playlist.title} — copy`.slice(0, 120);
    const duplicate = {
      ...createSavedService({ title: copyTitle, notes: playlist.notes ?? undefined }),
      items: Array.isArray(playlist.items) ? playlist.items : [],
    };
    setPlaylists(upsertSavedService(duplicate));
    onPlaylistUpsert?.(duplicate);
    setSuccess(`Created “${duplicate.title}” with ${duplicate.items.length} video${duplicate.items.length === 1 ? '' : 's'}.`);
  };

  const handleArchivePlaylist = (playlist: SavedService) => {
    setError('');
    setSuccess('');
    const archivedAt = playlist.archived_at ? null : new Date().toISOString();
    const updated = { ...playlist, archived_at: archivedAt, updated_at: new Date().toISOString() };
    setPlaylists(upsertSavedService(updated));
    if (archivedAt && activePlaylistId === playlist.id) onPlaylistDeleted?.(playlist.id);
    else if (!archivedAt) onPlaylistUpsert?.(updated);
    setSuccess(`${archivedAt ? 'Archived' : 'Restored'} “${playlist.title}”.`);
  };

  const openPlaylist = async (playlist: SavedService) => {
    setError('');
    setOpeningId(playlist.id);
    try {
      await onActivatePlaylist(playlist);
      onClose();
    } catch {
      setError('This service could not be opened.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
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
                  <span><HardDrive size={15} /> Saved privately on this device</span>
                  <h4 id="service-library-heading">Your service library</h4>
                </div>
                <div className="service-library__view-controls">
                  <strong>{displayedPlaylists.length} {showArchived ? 'archived' : 'saved'}</strong>
                  <button type="button" onClick={() => setShowArchived((value) => !value)}>{showArchived ? 'Show current' : 'Show archive'}</button>
                </div>
              </div>

              {displayedPlaylists.length === 0 ? (
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
                      isArchived={Boolean(playlist.archived_at)}
                      onOpen={openPlaylist}
                      onDuplicate={(item) => void handleDuplicatePlaylist(item)}
                      onArchive={(item) => void handleArchivePlaylist(item)}
                      onRename={handleRenamePlaylist}
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
                <p className="save-queue-box__hint">Services are saved automatically on this device. Clearing this site's browser data will remove them.</p>
              </form>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
