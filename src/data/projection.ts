import type { WorshipQueueItem } from './worshipQueue';

const PROJECTION_STORAGE_KEY = 'worship_word_video_projection_v1';
const PROJECTION_CHANNEL_NAME = 'worship-word-video-projection';
const PROJECTION_COMMAND_STORAGE_KEY = 'worship_word_video_projection_command_v1';
const PROJECTION_COMMAND_CHANNEL_NAME = 'worship-word-video-projection-command';
const PROJECTION_MESSAGE_SOURCE = 'worship-word-video-projection-link';
export const PROJECTION_WINDOW_NAME = 'worship-word-video-projection';
export const PROJECTION_HEARTBEAT_INTERVAL_MS = 3_000;

let statePublisherChannel: BroadcastChannel | null = null;
let commandPublisherChannel: BroadcastChannel | null = null;
let activeProjectionWindow: Window | null = null;

export interface ProjectionScreenInfo {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary?: boolean;
  isInternal?: boolean;
}

export interface ProjectionScreenDetails {
  screens: ProjectionScreenInfo[];
  currentScreen?: ProjectionScreenInfo;
}

export type WindowWithScreenDetails = Window & {
  getScreenDetails?: () => Promise<ProjectionScreenDetails>;
};

export type ProjectionCommandType = 'start' | 'ready' | 'heartbeat' | 'closed' | 'ended';

export interface ProjectionCommand {
  id: string;
  type: ProjectionCommandType;
  launchId: string;
  itemId?: string;
  issuedAt: number;
}

export interface ProjectionState {
  queue: WorshipQueueItem[];
  playingIndex: number | null;
  playbackRevision: number;
  launchId: string;
  updatedAt: number;
}

type ProjectionStateInput = Omit<ProjectionState, 'updatedAt' | 'launchId'> & { launchId?: string };

interface ProjectionMessageEnvelope<T> {
  source: typeof PROJECTION_MESSAGE_SOURCE;
  kind: 'state' | 'command';
  payload: T;
}

export type ProjectionLaunchResult = 'opened' | 'placed' | 'single-screen' | 'blocked';

export interface ProjectionWindowLaunch {
  result: ProjectionLaunchResult;
  popup: Window | null;
  reused: boolean;
}

export const EMPTY_PROJECTION_STATE: ProjectionState = {
  queue: [],
  playingIndex: null,
  playbackRevision: 0,
  launchId: '',
  updatedAt: 0,
};

function sameScreen(left: ProjectionScreenInfo, right: ProjectionScreenInfo): boolean {
  return left === right || (
    left.availLeft === right.availLeft
    && left.availTop === right.availTop
    && left.availWidth === right.availWidth
    && left.availHeight === right.availHeight
  );
}

/** Select a screen other than the dashboard, preferring an external display. */
export function chooseProjectionScreen(details: ProjectionScreenDetails): ProjectionScreenInfo | null {
  const alternatives = details.currentScreen
    ? details.screens.filter((screen) => !sameScreen(screen, details.currentScreen!))
    : details.screens.filter((screen) => !screen.isPrimary);
  return alternatives.find((screen) => screen.isInternal === false)
    ?? alternatives.find((screen) => !screen.isPrimary)
    ?? alternatives[0]
    ?? null;
}

/** Ask browsers for a true minimal popup rather than another dashboard tab. */
export function projectionPopupFeatures(screen?: ProjectionScreenInfo): string {
  const features = [
    'popup=yes',
    'toolbar=no',
    'location=no',
    'menubar=no',
    'status=no',
    'scrollbars=no',
    'resizable=yes',
  ];
  if (screen) {
    features.push(
      `left=${Math.round(screen.availLeft)}`,
      `top=${Math.round(screen.availTop)}`,
      `width=${Math.max(640, Math.round(screen.availWidth))}`,
      `height=${Math.max(360, Math.round(screen.availHeight))}`,
    );
  } else {
    features.push('width=1280', 'height=720');
  }
  return features.join(',');
}

function placePopup(popup: Window, screen: ProjectionScreenInfo): void {
  try {
    popup.moveTo(screen.availLeft, screen.availTop);
    popup.resizeTo(screen.availWidth, screen.availHeight);
  } catch {
    // Some browsers deliberately prevent programmatic placement.
  }
}

function popupAlreadyShowsProjection(popup: Window): boolean {
  try {
    return popup.location.origin === window.location.origin
      && new URL(popup.location.href).searchParams.get('projection') === '1';
  } catch {
    return true;
  }
}

/**
 * Open the clean receiver synchronously, then use the Window Management API to
 * move it to an external display when the browser grants access. Repeated calls
 * reuse the named receiver so choosing another song never creates stray windows.
 */
export async function openProjectionWindow(url: URL): Promise<ProjectionWindowLaunch> {
  const initialPlacement: ProjectionScreenInfo = {
    availLeft: window.screenX + 32,
    availTop: window.screenY + 32,
    availWidth: Math.min(1280, window.screen.availWidth),
    availHeight: Math.min(720, window.screen.availHeight),
  };
  const popup = window.open('', PROJECTION_WINDOW_NAME, projectionPopupFeatures(initialPlacement));
  if (!popup) return { result: 'blocked', popup: null, reused: false };

  activeProjectionWindow = popup;
  const reused = popupAlreadyShowsProjection(popup);
  if (!reused) {
    try {
      popup.document.title = 'Preparing church screen…';
      popup.document.body.style.cssText = 'display:grid;place-items:center;min-height:100vh;margin:0;color:#fff;background:#06162d;font:700 22px system-ui,sans-serif';
      popup.document.body.textContent = 'Preparing the church screen…';
    } catch {
      // The same-origin projection URL will still load.
    }
  }

  let result: ProjectionLaunchResult = 'opened';
  let target: ProjectionScreenInfo | null = null;
  const multiScreenWindow = window as WindowWithScreenDetails;
  if (multiScreenWindow.getScreenDetails) {
    try {
      const details = await multiScreenWindow.getScreenDetails();
      target = chooseProjectionScreen(details);
      if (target) {
        result = 'placed';
        url.searchParams.set('placed', '1');
        url.searchParams.set('left', String(Math.round(target.availLeft)));
        url.searchParams.set('top', String(Math.round(target.availTop)));
        url.searchParams.set('width', String(Math.round(target.availWidth)));
        url.searchParams.set('height', String(Math.round(target.availHeight)));
        placePopup(popup, target);
      } else if (details.screens.length < 2) {
        result = 'single-screen';
      }
    } catch {
      // Firefox, Safari and denied permissions keep the clean popup fallback.
    }
  }

  if (result === 'single-screen') {
    popup.close();
    if (activeProjectionWindow === popup) activeProjectionWindow = null;
    return { result, popup: null, reused };
  }

  if (!reused) popup.location.replace(url.toString());
  if (target) {
    // Chrome can ignore the first move while a new document is loading. Retrying
    // after navigation makes automatic placement substantially more reliable.
    [80, 350, 1_000].forEach((delay) => window.setTimeout(() => {
      if (!popup.closed) placePopup(popup, target!);
    }, delay));
  }
  popup.focus();
  return { result, popup, reused };
}

export function closeProjectionWindow(): void {
  try {
    if (activeProjectionWindow && !activeProjectionWindow.closed) activeProjectionWindow.close();
  } catch {
    // The receiver may already have been closed by the user.
  }
  activeProjectionWindow = null;
}

function validProjectionState(value: unknown): value is ProjectionState {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as ProjectionState).queue));
}

function validEnvelope<T>(value: unknown, kind: ProjectionMessageEnvelope<T>['kind']): value is ProjectionMessageEnvelope<T> {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Partial<ProjectionMessageEnvelope<T>>;
  return envelope.source === PROJECTION_MESSAGE_SOURCE && envelope.kind === kind && Boolean(envelope.payload);
}

export function readProjectionState(): ProjectionState {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTION_STORAGE_KEY) ?? 'null') as Partial<ProjectionState> | null;
    return parsed && Array.isArray(parsed.queue)
      ? {
          queue: parsed.queue,
          playingIndex: parsed.playingIndex ?? null,
          playbackRevision: parsed.playbackRevision ?? 0,
          launchId: parsed.launchId ?? '',
          updatedAt: parsed.updatedAt ?? 0,
        }
      : EMPTY_PROJECTION_STATE;
  } catch {
    return EMPTY_PROJECTION_STATE;
  }
}

export function publishProjectionState(state: ProjectionStateInput): ProjectionState {
  const previous = readProjectionState();
  const next: ProjectionState = {
    ...state,
    launchId: state.launchId ?? previous.launchId,
    updatedAt: Date.now(),
  };
  try { localStorage.setItem(PROJECTION_STORAGE_KEY, JSON.stringify(next)); } catch { /* Use the live transports below. */ }
  try {
    if ('BroadcastChannel' in window) {
      statePublisherChannel ??= new BroadcastChannel(PROJECTION_CHANNEL_NAME);
      statePublisherChannel.postMessage(next);
    }
  } catch {
    // Direct messaging remains available when BroadcastChannel is restricted.
  }
  try {
    if (activeProjectionWindow && !activeProjectionWindow.closed) {
      const envelope: ProjectionMessageEnvelope<ProjectionState> = {
        source: PROJECTION_MESSAGE_SOURCE,
        kind: 'state',
        payload: next,
      };
      activeProjectionWindow.postMessage(envelope, window.location.origin);
    }
  } catch {
    // The storage or BroadcastChannel transport may still have delivered it.
  }
  return next;
}

export function subscribeToProjectionState(onState: (state: ProjectionState) => void): () => void {
  let latestUpdate = readProjectionState().updatedAt;
  const deliver = (state: ProjectionState) => {
    if (!validProjectionState(state) || state.updatedAt < latestUpdate) return;
    latestUpdate = state.updatedAt;
    onState({ ...state, launchId: state.launchId ?? '' });
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === PROJECTION_STORAGE_KEY) deliver(readProjectionState());
  };
  const handleMessage = (event: MessageEvent<unknown>) => {
    if (event.origin !== window.location.origin || !validEnvelope<ProjectionState>(event.data, 'state')) return;
    deliver(event.data.payload);
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener('message', handleMessage);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(PROJECTION_CHANNEL_NAME) : null;
  if (channel) channel.onmessage = (event: MessageEvent<ProjectionState>) => deliver(event.data);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('message', handleMessage);
    channel?.close();
  };
}

export function publishProjectionCommand(type: ProjectionCommandType, launchId: string, itemId?: string): ProjectionCommand {
  const command: ProjectionCommand = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    launchId,
    itemId,
    issuedAt: Date.now(),
  };
  try { localStorage.setItem(PROJECTION_COMMAND_STORAGE_KEY, JSON.stringify(command)); } catch { /* Use the live transports below. */ }
  try {
    if ('BroadcastChannel' in window) {
      commandPublisherChannel ??= new BroadcastChannel(PROJECTION_COMMAND_CHANNEL_NAME);
      commandPublisherChannel.postMessage(command);
    }
  } catch {
    // Direct opener messaging remains available.
  }
  try {
    if (window.opener && !window.opener.closed) {
      const envelope: ProjectionMessageEnvelope<ProjectionCommand> = {
        source: PROJECTION_MESSAGE_SOURCE,
        kind: 'command',
        payload: command,
      };
      window.opener.postMessage(envelope, window.location.origin);
    }
  } catch {
    // The storage or BroadcastChannel transport may still have delivered it.
  }
  return command;
}

export function subscribeToProjectionCommands(onCommand: (command: ProjectionCommand) => void): () => void {
  let lastCommandId = '';
  const deliver = (command: ProjectionCommand | null) => {
    if (!command || command.id === lastCommandId) return;
    lastCommandId = command.id;
    onCommand(command);
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== PROJECTION_COMMAND_STORAGE_KEY || !event.newValue) return;
    try { deliver(JSON.parse(event.newValue) as ProjectionCommand); } catch { /* Ignore malformed browser storage. */ }
  };
  const handleMessage = (event: MessageEvent<unknown>) => {
    if (event.origin !== window.location.origin || !validEnvelope<ProjectionCommand>(event.data, 'command')) return;
    activeProjectionWindow = event.source as Window | null;
    deliver(event.data.payload);
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener('message', handleMessage);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(PROJECTION_COMMAND_CHANNEL_NAME) : null;
  if (channel) channel.onmessage = (event: MessageEvent<ProjectionCommand>) => deliver(event.data);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('message', handleMessage);
    channel?.close();
  };
}
