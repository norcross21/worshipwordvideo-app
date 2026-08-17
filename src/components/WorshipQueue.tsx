import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  CheckCircle2,
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
import { ProjectionSetupGuide } from './ProjectionSetupGuide';
import {
  openProjectionWindow,
  publishProjectionState,
  readProjectionState,
  subscribeToProjectionCommands,
  subscribeToProjectionState,
  type ProjectionLaunchResult,
} from '../data/projection';
import type { SavedUserPlaylist } from '../lib/supabase';
import {
  WORSHIP_QUEUE_LIMIT,
  formatPlaybackTime,
  moveWorshipQueueItem,
  parsePlaybackTime,
  playbackTimingError,
  type WorshipQueueItem,
} from '../data/worshipQueue';
import { recordUsageEvent } from '../lib/usageAnalytics';

interface WorshipQueueProps {
  queue: WorshipQueueItem[];
  onChange: (queue: WorshipQueueItem[]) => void;
  activeService: SavedUserPlaylist | null;
  serviceLoading?: boolean;
  onOpenSavedPlaylists?: () => void;
  onBrowseSongs?: () => void;
}

export function WorshipQueue({
  queue,
  onChange,
  activeService,
  serviceLoading = false,
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
  const [projectionActive, setProjectionActive] = useState(false);
  const [readiness, setReadiness] = useState<{ issues: string[]; warnings: string[] } | null>(null);
  const projectionWindowRef = useRef<Window | null>(null);
  const projectionLaunchIdRef = useRef('');
  const queueRef = useRef(queue);
  const playingIndexRef = useRef<number | null>(playingIndex);
  const playbackRevisionRef = useRef(playbackRevision);
  queueRef.current = queue;
  playingIndexRef.current = playingIndex;
  playbackRevisionRef.current = playbackRevision;
  const playingItem = !activeService || playingIndex == null ? null : queue[playingIndex] ?? null;

  const selectVideo = useCallback((index: number) => {
    if (!activeService || !queue[index]) return;
    const nextRevision = playbackRevisionRef.current + 1;
    playingIndexRef.current = index;
    playbackRevisionRef.current = nextRevision;
    setPlayingIndex(index);
    setPlaybackRevision(nextRevision);
    const currentProjection = readProjectionState();
    const hasPresentationSession = Boolean(currentProjection.launchId && currentProjection.playingIndex != null);
    // The persisted controller state is authoritative. A service component can
    // retain an older launch ref after the operator presents a separate single
    // video, and must never pull the receiver back into that retired session.
    const launchId = hasPresentationSession ? currentProjection.launchId : projectionLaunchIdRef.current;
    if (projectionActive || hasPresentationSession) {
      projectionLaunchIdRef.current = launchId;
      publishProjectionState({
        queue,
        playingIndex: index,
        playbackRevision: nextRevision,
        launchId,
        stopped: false,
      });
    }
  }, [activeService, projectionActive, queue]);

  useEffect(() => {
    setReadiness(null);
  }, [activeService?.id]);

  useEffect(() => {
    if (playingIndex != null && playingIndex >= queue.length) setPlayingIndex(queue.length ? queue.length - 1 : null);
  }, [playingIndex, queue]);

  useEffect(() => {
    if (!activeService || !projectionActive || playingIndex == null || !queue[playingIndex]) return;
    const current = readProjectionState();
    publishProjectionState({
      queue,
      playingIndex,
      playbackRevision,
      launchId: projectionLaunchIdRef.current || current.launchId,
      stopped: current.stopped,
    });
  }, [activeService, projectionActive, queue, playingIndex, playbackRevision]);

  useEffect(() => subscribeToProjectionCommands((command) => {
    if (!command.launchId) return;
    if (command.type === 'ready' || command.type === 'heartbeat') {
      const stored = readProjectionState();
      if (stored.launchId !== command.launchId) return;
      const storedItem = stored.playingIndex == null ? null : stored.queue[stored.playingIndex];
      const matchingIndex = storedItem ? queueRef.current.findIndex((entry) => entry.id === storedItem.id) : -1;
      if (matchingIndex < 0) return;
      projectionLaunchIdRef.current = command.launchId;
      setProjectionActive(true);
      playingIndexRef.current = matchingIndex;
      playbackRevisionRef.current = stored.playbackRevision;
      setPlayingIndex(matchingIndex);
      setPlaybackRevision(stored.playbackRevision);
      if (command.type === 'ready') {
        publishProjectionState({
          queue: queueRef.current,
          playingIndex: matchingIndex,
          playbackRevision: playbackRevisionRef.current,
          launchId: projectionLaunchIdRef.current,
          stopped: stored.stopped,
          autoAdvance: stored.autoAdvance,
        });
        setShowProjectionGuide(false);
        setProjectionMessage('Church screen connected. Every video choice here will update it automatically.');
      }
      return;
    }
    if (command.launchId !== projectionLaunchIdRef.current) return;
    if (command.type === 'start' && queue.length) {
      setProjectionActive(true);
      selectVideo(0);
      setShowProjectionGuide(false);
      setProjectionMessage('Live on the church screen. Use the private controls here to change videos.');
    }
    if (command.type === 'closed') {
      setProjectionActive(false);
      playingIndexRef.current = null;
      setPlayingIndex(null);
      setShowProjectionGuide(false);
      setProjectionMessage('The church projection window was closed.');
    }
  }), [queue.length, selectVideo]);

  useEffect(() => subscribeToProjectionState((state) => {
    if (!state.launchId) return;
    if (state.playingIndex == null) {
      if (state.launchId !== projectionLaunchIdRef.current) return;
      projectionLaunchIdRef.current = '';
      playingIndexRef.current = null;
      setPlayingIndex(null);
      setProjectionActive(false);
      return;
    }
    const projectedItem = state.queue[state.playingIndex];
    if (!projectedItem) return;
    const matchingIndex = queueRef.current.findIndex((entry) => entry.id === projectedItem.id);
    if (matchingIndex < 0) return;
    projectionLaunchIdRef.current = state.launchId;
    playingIndexRef.current = matchingIndex;
    playbackRevisionRef.current = state.playbackRevision;
    setPlayingIndex(matchingIndex);
    setPlaybackRevision(state.playbackRevision);
    setProjectionActive(true);
  }), []);

  useEffect(() => {
    if (!projectionActive) return;
    const checkWindow = window.setInterval(() => {
      if (!projectionWindowRef.current?.closed) return;
      projectionWindowRef.current = null;
      setProjectionActive(false);
      playingIndexRef.current = null;
      setPlayingIndex(null);
      setProjectionMessage('The church-screen window was closed. Choose Present to open it again.');
    }, 1_500);
    return () => window.clearInterval(checkWindow);
  }, [projectionActive]);

  const update = (next: WorshipQueueItem[]) => onChange(next.slice(0, WORSHIP_QUEUE_LIMIT));

  const removeAt = (index: number) => {
    update(queue.filter((_, itemIndex) => itemIndex !== index));
    if (playingIndex === index) {
      playingIndexRef.current = null;
      setPlayingIndex(null);
      if (projectionActive) {
        publishProjectionState({
          queue: queue.filter((_, itemIndex) => itemIndex !== index),
          playingIndex: null,
          playbackRevision: playbackRevisionRef.current + 1,
          launchId: projectionLaunchIdRef.current,
          stopped: true,
          autoAdvance: false,
        });
      }
    }
    else if (playingIndex != null && playingIndex > index) setPlayingIndex(playingIndex - 1);
  };

  const clearQueue = () => {
    if (window.confirm('Clear all songs from current service playlist?')) {
      update([]);
      playingIndexRef.current = null;
      setPlayingIndex(null);
      const nextRevision = playbackRevisionRef.current + 1;
      playbackRevisionRef.current = nextRevision;
      setPlaybackRevision(nextRevision);
      if (projectionActive) {
        publishProjectionState({
          queue: [],
          playingIndex: null,
          playbackRevision: nextRevision,
          launchId: projectionLaunchIdRef.current,
          stopped: true,
          autoAdvance: false,
        });
      }
    }
  };

  const moveAt = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    update(moveWorshipQueueItem(queue, index, direction));
    if (playingIndex === index) setPlayingIndex(destination);
    else if (playingIndex === destination) setPlayingIndex(index);
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
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('projection', '1');
    url.hash = '';
    const launchId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    projectionLaunchIdRef.current = launchId;
    url.searchParams.set('launch', launchId);

    const nextRevision = playbackRevisionRef.current + 1;
    projectionWindowRef.current = null;
    playingIndexRef.current = 0;
    playbackRevisionRef.current = nextRevision;
    setPlayingIndex(0);
    setPlaybackRevision(nextRevision);
    setProjectionActive(true);
    publishProjectionState({ queue, playingIndex: 0, playbackRevision: nextRevision, launchId, stopped: false, autoAdvance: false });

    const launch = await openProjectionWindow(url);
    if (launch.result === 'blocked') {
      projectionLaunchIdRef.current = '';
      setProjectionActive(false);
      playingIndexRef.current = null;
      setPlayingIndex(null);
      setProjectionMessage('Your browser blocked the projection window. Allow pop-ups for this site, then try again.');
      return 'blocked';
    }
    projectionWindowRef.current = launch.popup;
    if (launch.result === 'single-screen') {
      projectionWindowRef.current = null;
      setProjectionActive(false);
      playingIndexRef.current = null;
      setPlayingIndex(null);
      setProjectionMessage('Only one display was detected. Connect the church screen and choose Extend, then try again.');
      return launch.result;
    }
    publishProjectionState({ queue, playingIndex: 0, playbackRevision: nextRevision, launchId, stopped: false, autoAdvance: false });
    recordUsageEvent('projection_open');
    setProjectionMessage(launch.result === 'placed'
        ? 'Opening automatically on the church screen…'
        : 'The clean screen is linked. Playback starts without another confirmation.');
    return launch.result;
  };

  const checkService = () => {
    const issues: string[] = [];
    const warnings: string[] = [];
    if (!queue.length) issues.push('Add at least one worship video.');
    const invalidTimings = queue.filter((item) => playbackTimingError(item.startSeconds, item.endSeconds, item.durationSeconds));
    if (invalidTimings.length) issues.push(`${invalidTimings.length} video${invalidTimings.length === 1 ? ' has' : 's have'} invalid start or finish markers.`);
    const withoutWordEvidence = queue.filter((item) => !item.hasWords);
    if (withoutWordEvidence.length) warnings.push(`Preview ${withoutWordEvidence.length} video${withoutWordEvidence.length === 1 ? '' : 's'} whose uploader wording does not clearly confirm words or subtitles.`);
    const withoutDuration = queue.filter((item) => !item.durationSeconds);
    if (withoutDuration.length) warnings.push(`${withoutDuration.length} video${withoutDuration.length === 1 ? '' : 's'} should be played through because the catalogue has no confirmed duration.`);
    setReadiness({ issues, warnings });
  };

  return (
    <section className="worship-queue" aria-labelledby="worship-queue-title">
      <div className="worship-queue__heading">
        <div>
          <span className="worship-queue__eyebrow"><ListMusic size={16} /> Service plan</span>
          <h2 id="worship-queue-title">{serviceLoading ? 'Loading…' : activeService ? 'Running order' : 'Choose a service'} {activeService ? <span>{queue.length}/{WORSHIP_QUEUE_LIMIT}</span> : null}</h2>
          <p>{activeService ? 'Select any video to preview it or change the linked church screen.' : 'Use the service selector above, or create a new service.'}</p>
        </div>

        <div className="worship-queue__heading-actions">
          {!user && (
            <button type="button" className="worship-queue__btn-login" onClick={() => setShowAuthModal(true)}><LogIn size={14} /> Log in to save</button>
          )}
          {activeService && queue.length > 0 && (
            <>
              <button type="button" className="worship-queue__btn-project" onClick={() => setShowProjectionGuide(true)}><MonitorUp size={15} /> Present</button>
              <button type="button" className="worship-queue__btn-check" onClick={checkService}><CheckCircle2 size={15} /> Check service</button>
              <button type="button" className="worship-queue__btn-icon-danger" onClick={clearQueue} title="Clear playlist" aria-label="Clear playlist"><Trash2 size={15} /><span>Clear</span></button>
            </>
          )}
        </div>
      </div>

      {projectionMessage && <div className="projection-message" role="status"><Info size={17} /><span>{projectionMessage}</span><button type="button" onClick={() => setProjectionMessage('')} aria-label="Dismiss projection message"><X size={15} /></button></div>}

      {readiness && (
        <div className={`service-readiness ${readiness.issues.length ? 'has-issues' : 'is-ready'}`} role="status">
          <span className="service-readiness__icon">{readiness.issues.length ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}</span>
          <div>
            <strong>{readiness.issues.length ? 'A few things need attention' : 'Service basics look ready'}</strong>
            {[...readiness.issues, ...readiness.warnings].length ? (
              <ul>{[...readiness.issues, ...readiness.warnings].map((message) => <li key={message}>{message}</li>)}</ul>
            ) : <p>All videos have word evidence, duration information and valid playback markers. Please still preview the complete running order before church.</p>}
          </div>
          <button type="button" onClick={() => setReadiness(null)} aria-label="Close service check"><X size={15} /></button>
        </div>
      )}

      {playingItem && !projectionActive && (
        <div className="worship-queue__player-card">
          <div className="worship-queue__player-header">
            <div>
              <span className="worship-queue__now-playing">NOW PLAYING #{playingIndex! + 1}</span>
              <h3>{playingItem.title}</h3>
              <p>{playingItem.artist}</p>
            </div>
            <button type="button" className="worship-queue__icon-btn" onClick={() => {
              playingIndexRef.current = null;
              setPlayingIndex(null);
              const nextRevision = playbackRevisionRef.current + 1;
              playbackRevisionRef.current = nextRevision;
              setPlaybackRevision(nextRevision);
            }} title="Close player" aria-label="Close player"><X size={18} /></button>
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
            <button type="button" disabled={playingIndex! <= 0} onClick={() => selectVideo(playingIndex! - 1)}><SkipBack size={16} /> Previous</button>
            <button type="button" onClick={() => selectVideo(playingIndex!)}><RotateCcw size={16} /> Restart video</button>
            <button type="button" disabled={playingIndex! >= queue.length - 1} onClick={() => selectVideo(playingIndex! + 1)}>Next <SkipForward size={16} /></button>
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
                  <button type="button" className="worship-queue__btn-play" onClick={() => selectVideo(index)}><Play size={13} /> {isPlaying ? 'Restart' : projectionActive ? 'Show' : 'Play'}</button>
                  {user && <button type="button" className={`worship-queue__btn-trim ${hasTrim ? 'has-trim' : ''}`} onClick={() => isEditingTiming ? setTimingEditorId(null) : startTimingEdit(item)} title="Set clean start and stop times"><Scissors size={14} /><span>Trim</span></button>}
                  <button type="button" disabled={index === 0} onClick={() => moveAt(index, -1)} title="Move up" aria-label={`Move ${item.title} up`}><ArrowUp size={14} /></button>
                  <button type="button" disabled={index === queue.length - 1} onClick={() => moveAt(index, 1)} title="Move down" aria-label={`Move ${item.title} down`}><ArrowDown size={14} /></button>
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
          onClose={() => setShowProjectionGuide(false)}
        />
      )}
    </section>
  );
}
