import { useCallback, useEffect, useMemo, useState } from 'react';
import { Maximize2, MonitorUp, RotateCcw, SkipBack, SkipForward, X } from 'lucide-react';
import {
  PROJECTION_HEARTBEAT_INTERVAL_MS,
  closeProjectionWindow,
  openProjectionWindow,
  publishProjectionState,
  readProjectionState,
  subscribeToProjectionCommands,
  subscribeToProjectionState,
  type ProjectionLaunchResult,
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
  const item = projection.playingIndex == null ? null : projection.queue[projection.playingIndex] ?? null;
  const connected = Boolean(item && lastHeartbeat && now - lastHeartbeat < CONNECTED_GRACE_MS);

  useEffect(() => subscribeToProjectionState(setProjection), []);

  useEffect(() => subscribeToProjectionCommands((command) => {
    if (!projection.launchId || command.launchId !== projection.launchId) return;
    if (command.type === 'ready' || command.type === 'heartbeat') {
      setLastHeartbeat(Date.now());
      if (command.type === 'ready') setScreenMessage('Church screen connected.');
    }
    if (command.type === 'closed') {
      setLastHeartbeat(0);
      setScreenMessage('The church-screen window was closed. Choose Reopen screen to continue.');
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
    });
  }, []);

  const launchScreen = useCallback(async (cycleScreen = false) => {
    const current = readProjectionState();
    if (current.playingIndex == null || !current.queue[current.playingIndex]) return;
    const launchId = current.launchId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!current.launchId) {
      publishProjectionState({
        queue: current.queue,
        playingIndex: current.playingIndex,
        playbackRevision: current.playbackRevision + 1,
        launchId,
      });
    }
    setMoving(true);
    const launch = await openProjectionWindow(projectionUrl(launchId), { cycleScreen });
    setMoving(false);
    const messages: Record<ProjectionLaunchResult, string> = {
      placed: cycleScreen
        ? 'The church screen was moved to the next connected display.'
        : 'The church screen was placed automatically on the connected display.',
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
      });
    }
  }, []);

  const stopProjection = useCallback(() => {
    const current = readProjectionState();
    closeProjectionWindow();
    publishProjectionState({
      queue: [],
      playingIndex: null,
      playbackRevision: current.playbackRevision + 1,
      launchId: current.launchId,
    });
    setLastHeartbeat(0);
    setScreenMessage('');
  }, []);

  const position = projection.playingIndex ?? 0;
  const statusLabel = useMemo(() => connected ? 'CHURCH SCREEN CONNECTED' : 'CHURCH SCREEN LINKED', [connected]);
  if (!item) return null;

  return (
    <section className="global-projection-controller" aria-label="Church screen controller">
      <div className="global-projection-controller__status">
        <span className={connected ? 'is-connected' : 'is-waiting'}><i aria-hidden="true" /> {statusLabel}</span>
        <strong>{item.title}</strong>
        <small>{item.artist}{projection.queue.length > 1 ? ` · ${position + 1} of ${projection.queue.length}` : ''}</small>
      </div>

      <div className="global-projection-controller__controls">
        {projection.queue.length > 1 && (
          <button type="button" disabled={position <= 0} onClick={() => selectIndex(position - 1)}><SkipBack size={16} /> Previous</button>
        )}
        <button type="button" onClick={() => selectIndex(position)}><RotateCcw size={16} /> Restart</button>
        {projection.queue.length > 1 && (
          <button type="button" disabled={position >= projection.queue.length - 1} onClick={() => selectIndex(position + 1)}>Next <SkipForward size={16} /></button>
        )}
        <button type="button" disabled={moving} onClick={() => void launchScreen(false)}><MonitorUp size={16} /> {connected ? 'Show screen' : 'Reopen screen'}</button>
        <button type="button" disabled={moving} onClick={() => void launchScreen(true)}><Maximize2 size={16} /> Move display</button>
        <button type="button" className="is-stop" onClick={stopProjection}><X size={16} /> Stop</button>
      </div>

      {screenMessage && <p className="global-projection-controller__message" role="status">{screenMessage}</p>}
    </section>
  );
}
