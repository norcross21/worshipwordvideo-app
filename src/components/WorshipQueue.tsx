import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Cloud,
  Info,
  ListMusic,
  LogIn,
  MonitorUp,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react';
import { YouTubePlayer } from './YouTubePlayer';
import { VideoTrimEditor } from './VideoTrimEditor';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';
import { ProjectionSetupGuide, type ProjectionLaunchResult } from './ProjectionSetupGuide';
import { publishProjectionState } from '../data/projection';
import type { SavedUserPlaylist } from '../lib/supabase';
import {
  WORSHIP_QUEUE_LIMIT,
  formatPlaybackTime,
  moveWorshipQueueItem,
  parsePlaybackTime,
  playbackTimingError,
  type WorshipQueueItem,
} from '../data/worshipQueue';

interface WorshipQueueProps {
  queue: WorshipQueueItem[];
  onChange: (queue: WorshipQueueItem[]) => void;
  activeService: SavedUserPlaylist | null;
  serviceLoading?: boolean;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  onOpenSavedPlaylists?: () => void;
  onBrowseSongs?: () => void;
}

interface ScreenPlacement {
  screens: Array<{ isPrimary?: boolean; availLeft: number; availTop: number; availWidth: number; availHeight: number }>;
}

type WindowWithScreenDetails = Window & { getScreenDetails?: () => Promise<ScreenPlacement> };

export function WorshipQueue({
  queue,
  onChange,
  activeService,
  serviceLoading = false,
  saveState = 'idle',
  onOpenSavedPlaylists,
  onBrowseSongs,
}: WorshipQueueProps) {
  const { user } = useAuth();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [timingEditorId, setTimingEditorId] = useState<string | null>(null);
  const [startDraft, setStartDraft] = useState('');
  const [endDraft, setEndDraft] = useState('');
  const [timingError, setTimingError] = useState('');
  const [projectionMessage, setProjectionMessage] = useState('');
  const [showProjectionGuide, setShowProjectionGuide] = useState(false);
  const playingItem = !activeService || playingIndex == null ? null : queue[playingIndex] ?? null;

  useEffect(() => {
    if (playingIndex != null && playingIndex >= queue.length) setPlayingIndex(queue.length ? queue.length - 1 : null);
  }, [playingIndex, queue]);

  useEffect(() => {
    publishProjectionState({ queue: activeService ? queue : [], playingIndex: activeService ? playingIndex : null, playbackRevision });
  }, [activeService?.id, queue, playingIndex, playbackRevision]);

  const update = (next: WorshipQueueItem[]) => onChange(next.slice(0, WORSHIP_QUEUE_LIMIT));

  const removeAt = (index: number) => {
    update(queue.filter((_, itemIndex) => itemIndex !== index));
    if (playingIndex === index) setPlayingIndex(null);
    else if (playingIndex != null && playingIndex > index) setPlayingIndex(playingIndex - 1);
  };

  const clearQueue = () => {
    if (window.confirm('Clear all songs from current service playlist?')) {
      update([]);
      setPlayingIndex(null);
    }
  };

  const playAt = (index: number) => {
    if (playingIndex === index) setPlaybackRevision((value) => value + 1);
    setPlayingIndex(index);
  };

  const startTimingEdit = (item: WorshipQueueItem) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setTimingEditorId(item.id);
    setStartDraft(formatPlaybackTime(item.startSeconds));
    setEndDraft(formatPlaybackTime(item.endSeconds));
    setTimingError('');
  };

  const applyTiming = (item: WorshipQueueItem) => {
    const startSeconds = parsePlaybackTime(startDraft);
    const endSeconds = parsePlaybackTime(endDraft);
    if (startDraft.trim() && startSeconds == null) {
      setTimingError('Enter the start as seconds or m:ss, for example 26 or 0:26.');
      return;
    }
    if (endDraft.trim() && endSeconds == null) {
      setTimingError('Enter the stop time as seconds or m:ss, for example 238 or 3:58.');
      return;
    }
    const error = playbackTimingError(startSeconds, endSeconds, item.durationSeconds);
    if (error) {
      setTimingError(error);
      return;
    }
    update(queue.map((entry) => entry.id === item.id ? { ...entry, startSeconds, endSeconds } : entry));
    if (playingItem?.id === item.id) setPlaybackRevision((value) => value + 1);
    setTimingEditorId(null);
    setTimingError('');
  };

  const openProjection = async (): Promise<ProjectionLaunchResult> => {
    setPlayingIndex(null);
    publishProjectionState({ queue, playingIndex: null, playbackRevision: playbackRevision + 1 });

    const url = new URL(window.location.href);
    url.search = '?projection=1';
    url.hash = '';
    const popup = window.open(url.toString(), 'worship-word-video-projection', 'popup=yes,width=1280,height=720');
    if (!popup) {
      setProjectionMessage('Your browser blocked the projection window. Allow pop-ups for this site, then try again.');
      return 'blocked';
    }
    setPlaybackRevision((value) => value + 1);
    setProjectionMessage('Projection window opened. Follow the final step to make it full screen, then start the service here.');

    const multiScreenWindow = window as WindowWithScreenDetails;
    if (multiScreenWindow.getScreenDetails) {
      try {
        const details = await multiScreenWindow.getScreenDetails();
        const target = details.screens.find((screen) => !screen.isPrimary);
        if (target) {
          popup.moveTo(target.availLeft, target.availTop);
          popup.resizeTo(target.availWidth, target.availHeight);
          popup.focus();
          setProjectionMessage('Projection placed on the second screen. Choose Full screen in that window.');
          return 'placed';
        }
      } catch {
        popup.focus();
      }
    } else {
      popup.focus();
    }
    return 'opened';
  };

  const startProjection = () => {
    if (!queue.length) return;
    playAt(0);
    setShowProjectionGuide(false);
    setProjectionMessage('Service started on the projection screen. Use Previous and Next here while the congregation sees only the video.');
  };

  return (
    <section className="worship-queue" aria-labelledby="worship-queue-title">
      <div className="worship-queue__heading">
        <div>
          <span className="worship-queue__eyebrow"><ListMusic size={16} /> {activeService ? 'Active service' : 'Service planning'}</span>
          <h2 id="worship-queue-title">{serviceLoading ? 'Loading your service…' : activeService?.title || 'Create or choose a service'} {activeService ? `(${queue.length}/${WORSHIP_QUEUE_LIMIT})` : ''}</h2>
          <p>{activeService ? 'Changes save automatically. Arrange the running order, set clean video timing, then present it.' : 'Start with a named service so every video, trim and running-order change has somewhere to save.'}</p>
          {activeService && <span className={`service-save-status is-${saveState}`}>{saveState === 'saving' ? 'Saving changes…' : saveState === 'error' ? 'Could not save—check your connection' : saveState === 'saved' ? 'Saved' : 'Saved to your account'}</span>}
        </div>

        <div className="worship-queue__heading-actions">
          {user ? (
            <button type="button" className="worship-queue__btn-cloud" onClick={onOpenSavedPlaylists}>{activeService ? <Cloud size={15} /> : <Plus size={15} />} {activeService ? 'Switch or add service' : 'Add service'}</button>
          ) : (
            <button type="button" className="worship-queue__btn-login" onClick={() => setShowAuthModal(true)}><LogIn size={14} /> Log in to save</button>
          )}
          {activeService && queue.length > 0 && (
            <>
              <button type="button" className="worship-queue__btn-project" onClick={() => setShowProjectionGuide(true)}><MonitorUp size={15} /> Present on second screen</button>
              <button type="button" className="worship-queue__btn-secondary" onClick={() => playAt(0)}><Play size={14} /> Start here</button>
              <button type="button" className="worship-queue__btn-icon-danger" onClick={clearQueue} title="Clear playlist" aria-label="Clear playlist"><Trash2 size={15} /><span>Clear</span></button>
            </>
          )}
        </div>
      </div>

      {projectionMessage && <div className="projection-message" role="status"><Info size={17} /><span>{projectionMessage}</span><button type="button" onClick={() => setProjectionMessage('')} aria-label="Dismiss projection message"><X size={15} /></button></div>}

      {playingItem && (
        <div className="worship-queue__player-card">
          <div className="worship-queue__player-header">
            <div>
              <span className="worship-queue__now-playing">NOW PLAYING #{playingIndex! + 1}</span>
              <h3>{playingItem.title}</h3>
              <p>{playingItem.artist}</p>
            </div>
            <button type="button" className="worship-queue__icon-btn" onClick={() => setPlayingIndex(null)} title="Close player" aria-label="Close player"><X size={18} /></button>
          </div>
          <div className="worship-queue__video-container">
            <YouTubePlayer
              key={`${playingItem.id}-${playingItem.startSeconds ?? 0}-${playingItem.endSeconds ?? 0}-${playbackRevision}`}
              videoId={playingItem.youtubeId}
              title={`${playingItem.title} - ${playingItem.artist}`}
              autoplay
              startSeconds={playingItem.startSeconds}
              endSeconds={playingItem.endSeconds}
            />
          </div>
          <div className="worship-queue__player-controls">
            <button type="button" disabled={playingIndex! <= 0} onClick={() => setPlayingIndex((previous) => previous != null && previous > 0 ? previous - 1 : previous)}><SkipBack size={16} /> Previous</button>
            <button type="button" onClick={() => setPlaybackRevision((value) => value + 1)}><RotateCcw size={16} /> Restart video</button>
            <button type="button" disabled={playingIndex! >= queue.length - 1} onClick={() => setPlayingIndex((previous) => previous != null && previous < queue.length - 1 ? previous + 1 : previous)}>Next <SkipForward size={16} /></button>
          </div>
        </div>
      )}

      {!activeService || queue.length === 0 ? (
        <div className="worship-queue__empty">
          <ListMusic size={32} />
          <p>{activeService ? `${activeService.title} is ready for its first video.` : 'Create a service before adding videos.'}</p>
          <span>{activeService ? `Choose a worship video and add it to this service. You can add up to ${WORSHIP_QUEUE_LIMIT} videos.` : 'You can keep several services and switch between them whenever you plan.'}</span>
          <div className="worship-queue__empty-actions">
            {!activeService && onOpenSavedPlaylists && <button type="button" className="btn-primary" onClick={onOpenSavedPlaylists}><Plus size={15} /> Create a service</button>}
            {activeService && onBrowseSongs && <button type="button" className="btn-primary" onClick={onBrowseSongs}>Browse worship videos</button>}
          </div>
        </div>
      ) : (
        <ol className="worship-queue__list">
          {queue.map((item, index) => {
            const isPlaying = playingIndex === index;
            const hasTrim = item.startSeconds != null || item.endSeconds != null;
            const isEditingTiming = timingEditorId === item.id;
            return (
              <li key={item.id} className={`worship-queue__item ${isPlaying ? 'is-playing' : ''} ${isEditingTiming ? 'is-editing-timing' : ''}`}>
                <div className="worship-queue__item-index">{index + 1}</div>
                <div className="worship-queue__item-body">
                  <div className="worship-queue__item-title">
                    <strong>{item.title}</strong>
                    {item.hasWords === true && <span className="badge-verified-words">✓ Words</span>}
                  </div>
                  <div className="worship-queue__item-sub">{item.artist}</div>
                  {hasTrim && <div className="worship-queue__trim-summary"><Scissors size={12} /> Play {formatPlaybackTime(item.startSeconds) || 'from start'} to {formatPlaybackTime(item.endSeconds) || 'video end'}</div>}
                </div>
                <div className="worship-queue__item-actions">
                  <button type="button" className="worship-queue__btn-play" onClick={() => playAt(index)}><Play size={13} /> {isPlaying ? 'Restart' : 'Play'}</button>
                  {user && <button type="button" className={`worship-queue__btn-trim ${hasTrim ? 'has-trim' : ''}`} onClick={() => isEditingTiming ? setTimingEditorId(null) : startTimingEdit(item)} title="Set clean start and stop times"><Scissors size={14} /><span>Trim</span></button>}
                  <button type="button" disabled={index === 0} onClick={() => update(moveWorshipQueueItem(queue, index, -1))} title="Move up" aria-label={`Move ${item.title} up`}><ArrowUp size={14} /></button>
                  <button type="button" disabled={index === queue.length - 1} onClick={() => update(moveWorshipQueueItem(queue, index, 1))} title="Move down" aria-label={`Move ${item.title} down`}><ArrowDown size={14} /></button>
                  <button type="button" className="worship-queue__btn-remove" onClick={() => removeAt(index)} title="Remove" aria-label={`Remove ${item.title}`}><Trash2 size={14} /></button>
                </div>
                {isEditingTiming && (
                  <div className="queue-timing-editor">
                    <div className="queue-timing-editor__heading">
                      <span className="queue-timing-editor__heading-icon"><Scissors size={16} /></span>
                      <div><strong>Choose the clean part of the video</strong><span>Watch the video and mark exactly where worship should begin and finish.</span></div>
                    </div>

                    <div className="queue-timing-editor__layout">
                      <VideoTrimEditor
                        videoId={item.youtubeId}
                        title={`${item.title} - ${item.artist}`}
                        startValue={startDraft}
                        endValue={endDraft}
                        initialStartSeconds={item.startSeconds}
                        durationSeconds={item.durationSeconds}
                        onStartChange={(value) => { setStartDraft(value); setTimingError(''); }}
                        onEndChange={(value) => { setEndDraft(value); setTimingError(''); }}
                      />

                      <div className="queue-timing-editor__settings">
                        <div className="queue-timing-editor__settings-intro">
                          <strong>Your playback markers</strong>
                          <span>The buttons under the video fill these times automatically. You can still type an exact time.</span>
                        </div>
                        <label>Start at<input value={startDraft} onChange={(event) => setStartDraft(event.target.value)} placeholder="0:26" inputMode="numeric" /></label>
                        <label>Finish at<input value={endDraft} onChange={(event) => setEndDraft(event.target.value)} placeholder={item.durationSeconds ? formatPlaybackTime(item.durationSeconds) : '3:58'} inputMode="numeric" /></label>
                        <div className="queue-timing-editor__selection-summary">
                          <span>Selected playback</span>
                          <strong>{startDraft || 'Start'} <span aria-hidden="true">→</span> {endDraft || 'Video end'}</strong>
                        </div>
                      </div>
                    </div>

                    {timingError && <p className="queue-timing-editor__error" role="alert">{timingError}</p>}
                    <div className="queue-timing-editor__footer">
                      <small>YouTube may begin up to about two seconds before the exact marker. Preview it before the service.</small>
                      <div className="queue-timing-editor__actions">
                        <button type="button" className="btn-link" onClick={() => { setStartDraft(''); setEndDraft(''); setTimingError(''); }}>Clear markers</button>
                        <button type="button" className="btn-link" onClick={() => setTimingEditorId(null)}>Cancel</button>
                        <button type="button" className="btn-primary-sm" onClick={() => applyTiming(item)}>Save trim</button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {showAuthModal && <AuthModal initialTab="signin" onClose={() => setShowAuthModal(false)} />}
      {showProjectionGuide && (
        <ProjectionSetupGuide
          serviceTitle={activeService?.title || 'Current service'}
          songCount={queue.length}
          onOpenProjection={openProjection}
          onStartService={startProjection}
          onClose={() => setShowProjectionGuide(false)}
        />
      )}
    </section>
  );
}
