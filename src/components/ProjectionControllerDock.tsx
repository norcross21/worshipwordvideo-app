import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, MonitorUp, Power, RotateCcw, SkipBack, SkipForward, Square, X } from 'lucide-react';
import {
  PROJECTION_HEARTBEAT_INTERVAL_MS,
  closeProjectionWindow,
  getProjectionScreenChoices,
  openProjectionWindow,
  projectionEndedTransition,
  publishProjectionCommand,
  publishProjectionState,
  readProjectionState,
  subscribeToProjectionCommands,
  subscribeToProjectionState,
  type ProjectionLaunchResult,
  type ProjectionScreenChoice,
  type ProjectionState,
} from '../data/projection';

const CONNECTED_GRACE_MS = PROJECTION_HEARTBEAT_INTERVAL_MS * 3;

function projectionUrl(launchId: string): URL {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('projection', '1');
  url.searchParams.set('launch', launchId);
  url.hash = '';
  return url;
}

export function ProjectionControllerDock() {
  const [projection, setProjection] = useState<ProjectionState>(readProjectionState);
  const [lastHeartbeat, setLastHeartbeat] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [screenMessage, setScreenMessage] = useState('');
  const [moving, setMoving] = useState(false);
  const [screenChoices, setScreenChoices] = useState<ProjectionScreenChoice[]>([]);
  const [showScreenChoices, setShowScreenChoices] = useState(false);
  const item = projection.playingIndex == null ? null : projection.queue[projection.playingIndex] ?? null;
  const connected = Boolean(item && lastHeartbeat && now - lastHeartbeat < CONNECTED_GRACE_MS);

  useEffect(() => subscribeToProjectionState(setProjection), []);

  useEffect(() => subscribeToProjectionCommands((command) => {
    if (!projection.launchId || command.launchId !== projection.launchId) return;
    if (command.type === 'ready' || command.type === 'heartbeat') {
      setLastHeartbeat(Date.now());
      if (command.type === 'ready') setScreenMessage('');
    }
    if (command.type === 'closed') {
      setLastHeartbeat(0);
      setScreenMessage('The church-screen window was closed. Choose Show screen to continue.');
    }
    if (command.type === 'ended') {
      const current = readProjectionState();
      const currentItem = current.playingIndex == null ? null : current.queue[current.playingIndex];
      // A retiring YouTube iframe can report "ended" just after the operator
      // has selected another video. Never let that stale event move the new one.
      if (!currentItem || command.itemId !== currentItem.id) return;
      const transition = projectionEndedTransition(current);
      if (!transition) {
        publishProjectionState({
          queue: current.queue,
          playingIndex: current.playingIndex,
          playbackRevision: current.playbackRevision + 1,
          launchId: current.launchId,
          stopped: true,
        });
        setScreenMessage('Video finished. Choose Restart, Previous or Next when you are ready.');
        return;
      }
      if (!transition.completed) {
        publishProjectionState({
          queue: current.queue,
          playingIndex: transition.playingIndex,
          playbackRevision: current.playbackRevision + 1,
          launchId: current.launchId,
          stopped: transition.stopped,
          autoAdvance: transition.autoAdvance,
        });
        setScreenMessage(`Auto-next: starting ${current.queue[transition.playingIndex].title}.`);
      } else {
        publishProjectionState({
          queue: current.queue,
          playingIndex: transition.playingIndex,
          playbackRevision: current.playbackRevision + 1,
          launchId: current.launchId,
          stopped: transition.stopped,
          autoAdvance: transition.autoAdvance,
        });
        setScreenMessage('Service complete. Auto-next has switched off.');
      }
    }
  }), [projection.launchId]);

  useEffect(() => {
    if (!item) return;
    const timer = window.setInterval(() => setNow(Date.now()), PROJECTION_HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [item]);

  const selectIndex = useCallback((index: number) => {
    const current = readProjectionState();
    if (!current.queue[index]) return;
    publishProjectionState({
      queue: current.queue,
      playingIndex: index,
      playbackRevision: current.playbackRevision + 1,
      launchId: current.launchId,
      stopped: false,
    });
  }, []);

  const stopVideo = useCallback(() => {
    const current = readProjectionState();
    if (current.playingIndex == null) return;
    publishProjectionState({
      queue: current.queue,
      playingIndex: current.playingIndex,
      playbackRevision: current.playbackRevision + 1,
      launchId: current.launchId,
      stopped: true,
    });
    setScreenMessage('Video stopped. The church screen remains connected and ready.');
  }, []);

  const toggleAutoAdvance = useCallback(() => {
    const current = readProjectionState();
    if (current.queue.length < 2) return;
    const autoAdvance = !current.autoAdvance;
    publishProjectionState({
      queue: current.queue,
      playingIndex: current.playingIndex,
      playbackRevision: current.playbackRevision,
      launchId: current.launchId,
      autoAdvance,
    });
    setScreenMessage(autoAdvance
      ? 'Auto-next is on. The next video will start when this one finishes.'
      : 'Auto-next is off. The screen will wait for you after each video.');
  }, []);

  const launchScreen = useCallback(async (cycleScreen = false, preferredScreenKey?: string) => {
    const current = readProjectionState();
    if (current.playingIndex == null || !current.queue[current.playingIndex]) return;
    const launchId = current.launchId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!current.launchId) {
      publishProjectionState({
        queue: current.queue,
        playingIndex: current.playingIndex,
        playbackRevision: current.playbackRevision + 1,
        launchId,
        stopped: false,
      });
    }
    setMoving(true);
    setShowScreenChoices(false);
    const launch = await openProjectionWindow(projectionUrl(launchId), { cycleScreen, preferredScreenKey });
    setMoving(false);
    const messages: Record<ProjectionLaunchResult, string> = {
      placed: cycleScreen
        ? 'The church screen was moved to the next connected display.'
        : 'The clean video window is on the church display. This controller stays on your laptop.',
      opened: 'The clean screen is linked. This Chrome installation did not allow automatic display placement.',
      'single-screen': 'Chrome detected only one display. Connect the church screen and choose Extended Display, then try again.',
      blocked: 'Chrome blocked the church-screen window. Allow pop-ups for this site, then choose Reopen screen.',
    };
    setScreenMessage(messages[launch.result]);
    if (launch.result === 'placed' || launch.result === 'opened') {
      publishProjectionState({
        queue: current.queue,
        playingIndex: current.playingIndex,
        playbackRevision: current.playbackRevision + 1,
        launchId,
        stopped: false,
      });
    }
  }, []);

  const discoverScreens = useCallback(async () => {
    setMoving(true);
    setScreenMessage('');
    try {
      const choices = await getProjectionScreenChoices();
      setScreenChoices(choices);
      if (!choices.length) {
        setScreenMessage('No extended display was detected. Connect the projector and choose Extended Display in your computer settings.');
        setShowScreenChoices(false);
      } else {
        setShowScreenChoices(true);
      }
    } catch {
      setScreenMessage('Chrome needs Window management permission. Open the site controls beside the address bar, allow Window management, then try again.');
      setShowScreenChoices(false);
    } finally {
      setMoving(false);
    }
  }, []);

  const closeScreen = useCallback(() => {
    const current = readProjectionState();
    if (current.launchId) publishProjectionCommand('close', current.launchId);
    closeProjectionWindow();
    setLastHeartbeat(0);
    setScreenMessage('Church screen closed. Your presentation is still here and ready to reopen.');
    setShowScreenChoices(false);
  }, []);

  const endProjection = useCallback(() => {
    const current = readProjectionState();
    if (current.launchId) publishProjectionCommand('close', current.launchId);
    closeProjectionWindow();
    publishProjectionState({
      queue: [],
      playingIndex: null,
      playbackRevision: current.playbackRevision + 1,
      launchId: current.launchId,
      stopped: true,
      autoAdvance: false,
    });
    setLastHeartbeat(0);
    setScreenMessage('');
    setShowScreenChoices(false);
  }, []);

  const position = projection.playingIndex ?? 0;
  if (!projection.launchId || !item) return null;

  return (
    <section className="global-projection-controller" aria-label="Church screen controller">
      <div className="global-projection-controller__status">
        <span className={connected ? 'is-connected' : 'is-waiting'}><i aria-hidden="true" /> {projection.stopped ? 'Video stopped' : connected ? 'Screen live' : 'Screen ready'}</span>
        <strong>{item.title}</strong>
        <small>{item.artist}{projection.queue.length > 1 ? ` · ${position + 1} of ${projection.queue.length}` : ''}</small>
      </div>

      <div className="global-projection-controller__transport" aria-label="Video controls">
        <button type="button" disabled={position <= 0} onClick={() => selectIndex(position - 1)}><SkipBack size={16} /> Previous</button>
        <button type="button" onClick={() => selectIndex(position)}><RotateCcw size={16} /> Restart</button>
        <button type="button" disabled={position >= projection.queue.length - 1} onClick={() => selectIndex(position + 1)}>Next <SkipForward size={16} /></button>
        <button type="button" disabled={projection.stopped} onClick={stopVideo}><Square size={14} /> Stop</button>
        <button type="button" className={projection.autoAdvance ? 'is-active' : ''} disabled={projection.queue.length < 2} aria-pressed={projection.autoAdvance} onClick={toggleAutoAdvance}>Auto-next {projection.autoAdvance ? 'on' : 'off'}</button>
      </div>

      <div className="global-projection-controller__screen-actions">
        <button type="button" className="is-primary" disabled={moving} onClick={() => void launchScreen(false)} title="Open or bring forward the clean church-screen window"><MonitorUp size={16} /> Show screen</button>
        <button type="button" className="is-display-picker" disabled={moving} aria-haspopup="menu" aria-expanded={showScreenChoices} onClick={() => void discoverScreens()}>
          Displays <ChevronDown size={15} />
        </button>
        <button type="button" className="is-close-screen" disabled={!connected} onClick={closeScreen} title="Close only the church-screen window; keep this presentation ready"><X size={15} /> Close screen</button>
        <button type="button" className="is-stop" onClick={endProjection} title="Finish the presentation and hide these controls"><Power size={16} /> End</button>

        {showScreenChoices && (
          <div className="global-projection-controller__display-menu" role="menu" aria-label="Choose church display">
            <strong>Choose the church screen</strong>
            <span>Chrome will remember it for next time.</span>
            {screenChoices.map((choice) => (
              <button key={choice.key} type="button" role="menuitem" onClick={() => void launchScreen(false, choice.key)}>
                <MonitorUp size={16} />
                <span><strong>{choice.label}</strong><small>{choice.isInternal ? 'Built-in display' : 'External display'}</small></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {screenMessage && <p className="global-projection-controller__message" role="status">{screenMessage}</p>}
    </section>
  );
}
