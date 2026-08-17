import type { WorshipQueueItem } from './worshipQueue';

const PROJECTION_STORAGE_KEY = 'worship_word_video_projection_v1';
const PROJECTION_CHANNEL_NAME = 'worship-word-video-projection';
const PROJECTION_COMMAND_STORAGE_KEY = 'worship_word_video_projection_command_v1';
const PROJECTION_COMMAND_CHANNEL_NAME = 'worship-word-video-projection-command';
const PROJECTION_MESSAGE_SOURCE = 'worship-word-video-projection-link';
// v2 deliberately avoids reusing an older Chrome tab that may have been opened
// by the first projection implementation. Chrome will now create/reuse a clean
// popup window instead of bringing the old dashboard tab back to the front.
export const PROJECTION_WINDOW_NAME = 'worship-word-video-projection-v2';
export const PROJECTION_HEARTBEAT_INTERVAL_MS = 3_000;
const PROJECTION_TARGET_SCREEN_KEY = 'worship_word_video_projection_target_v1';
const PROJECTION_TARGET_GEOMETRY_KEY = 'worship_word_video_projection_geometry_v1';

let statePublisherChannel: BroadcastChannel | null = null;
let commandPublisherChannel: BroadcastChannel | null = null;
let activeProjectionWindow: Window | null = null;

export interface ProjectionScreenInfo {
  label?: string;
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

export type ProjectionCommandType = 'start' | 'ready' | 'heartbeat' | 'close' | 'closed' | 'ended';

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
  stopped: boolean;
  autoAdvance: boolean;
  launchId: string;
  updatedAt: number;
}

type ProjectionStateInput = Omit<ProjectionState, 'updatedAt' | 'launchId' | 'stopped' | 'autoAdvance'> & {
  launchId?: string;
  stopped?: boolean;
  autoAdvance?: boolean;
};

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

export interface ProjectionWindowOptions {
  /** Move a linked receiver to the next available external display. */
  cycleScreen?: boolean;
  /** Open on a screen explicitly chosen by the user. */
  preferredScreenKey?: string;
}

export interface ProjectionScreenChoice {
  key: string;
  label: string;
  isPrimary: boolean;
  isInternal: boolean;
}

export interface ProjectionEndedTransition {
  playingIndex: number;
  stopped: boolean;
  autoAdvance: boolean;
  completed: boolean;
}

export const EMPTY_PROJECTION_STATE: ProjectionState = {
  queue: [],
  playingIndex: null,
  playbackRevision: 0,
  stopped: false,
  autoAdvance: false,
  launchId: '',
  updatedAt: 0,
};

/** Decide what the universal controller should do when the receiver reports an ended video. */
export function projectionEndedTransition(state: ProjectionState): ProjectionEndedTransition | null {
  if (!state.autoAdvance || state.playingIndex == null || !state.queue[state.playingIndex]) return null;
  const nextIndex = state.playingIndex + 1;
  if (nextIndex < state.queue.length) {
    return { playingIndex: nextIndex, stopped: false, autoAdvance: true, completed: false };
  }
  return { playingIndex: state.playingIndex, stopped: true, autoAdvance: false, completed: true };
}

function sameScreen(left: ProjectionScreenInfo, right: ProjectionScreenInfo): boolean {
  return left === right || (
    left.availLeft === right.availLeft
    && left.availTop === right.availTop
    && left.availWidth === right.availWidth
    && left.availHeight === right.availHeight
  );
}

export function projectionScreenKey(screen: ProjectionScreenInfo): string {
  return [
    screen.label ?? '',
    screen.availLeft,
    screen.availTop,
    screen.availWidth,
    screen.availHeight,
  ].join('|');
}

export function projectionScreenOptions(details: ProjectionScreenDetails): ProjectionScreenInfo[] {
  const alternatives = details.currentScreen
    ? details.screens.filter((screen) => !sameScreen(screen, details.currentScreen!))
    : details.screens.filter((screen) => !screen.isPrimary);
  return alternatives.sort((left, right) => {
    if (left.isInternal !== right.isInternal) return left.isInternal === false ? -1 : 1;
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? 1 : -1;
    return left.availLeft - right.availLeft || left.availTop - right.availTop;
  });
}

/** Select a screen other than the dashboard, preferring an external display. */
export function chooseProjectionScreen(details: ProjectionScreenDetails): ProjectionScreenInfo | null {
  return projectionScreenOptions(details)[0] ?? null;
}

/** Request display names after a user click, which is also when Chrome prompts for permission. */
export async function getProjectionScreenChoices(): Promise<ProjectionScreenChoice[]> {
  const multiScreenWindow = window as WindowWithScreenDetails;
  if (!multiScreenWindow.getScreenDetails) return [];
  const details = await multiScreenWindow.getScreenDetails();
  return projectionScreenOptions(details).map((screen, index) => ({
    key: projectionScreenKey(screen),
    label: screen.label?.trim() || `Screen ${index + 2}`,
    isPrimary: Boolean(screen.isPrimary),
    isInternal: Boolean(screen.isInternal),
  }));
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

function isProjectionScreenInfo(value: unknown): value is ProjectionScreenInfo {
  if (!value || typeof value !== 'object') return false;
  const screen = value as Partial<ProjectionScreenInfo>;
  return [screen.availLeft, screen.availTop, screen.availWidth, screen.availHeight]
    .every((part) => typeof part === 'number' && Number.isFinite(part));
}

function readRememberedProjectionScreen(): ProjectionScreenInfo | null {
  try {
    const value = JSON.parse(localStorage.getItem(PROJECTION_TARGET_GEOMETRY_KEY) ?? 'null') as unknown;
    return isProjectionScreenInfo(value) ? value : null;
  } catch {
    return null;
  }
}

function rememberProjectionScreen(screen: ProjectionScreenInfo): void {
  try {
    localStorage.setItem(PROJECTION_TARGET_SCREEN_KEY, projectionScreenKey(screen));
    localStorage.setItem(PROJECTION_TARGET_GEOMETRY_KEY, JSON.stringify(screen));
  } catch {
    // Placement still works for the current launch.
  }
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
export async function openProjectionWindow(url: URL, options: ProjectionWindowOptions = {}): Promise<ProjectionWindowLaunch> {
  const multiScreenWindow = window as WindowWithScreenDetails;
  const rememberedScreen = readRememberedProjectionScreen();
  const initialPlacement: ProjectionScreenInfo = rememberedScreen ?? {
    availLeft: window.screenX + 32,
    availTop: window.screenY + 32,
    availWidth: Math.min(1280, window.screen.availWidth),
    availHeight: Math.min(720, window.screen.availHeight),
  };

  // Open synchronously from the click so Chrome recognises this as a permitted
  // popup. Only this clean receiver is moved; the controller document is never
  // fullscreened or repositioned. A remembered display opens in the right place
  // immediately, before the asynchronous screen check completes.
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

  let target: ProjectionScreenInfo | null = rememberedScreen;
  let result: ProjectionLaunchResult = target ? 'placed' : 'opened';
  if (multiScreenWindow.getScreenDetails) {
    try {
      const details = await multiScreenWindow.getScreenDetails();
      const availableTargets = projectionScreenOptions(details);
      const rememberedKey = (() => {
        try { return localStorage.getItem(PROJECTION_TARGET_SCREEN_KEY) ?? ''; } catch { return ''; }
      })();
      const desiredKey = options.preferredScreenKey || rememberedKey;
      const rememberedIndex = availableTargets.findIndex((screen) => projectionScreenKey(screen) === desiredKey);
      const targetIndex = options.cycleScreen && availableTargets.length > 1
        ? (Math.max(rememberedIndex, 0) + 1) % availableTargets.length
        : rememberedIndex >= 0 ? rememberedIndex : 0;
      target = availableTargets[targetIndex] ?? chooseProjectionScreen(details);
      if (target) {
        result = 'placed';
        rememberProjectionScreen(target);
      } else if (details.screens.length < 2) {
        result = 'single-screen';
        target = null;
      }
    } catch {
      // A stored position remains usable if permission was previously granted.
      // Other browsers retain the clean, manually full-screenable popup.
    }
  }

  if (result === 'single-screen') {
    popup.close();
    if (activeProjectionWindow === popup) activeProjectionWindow = null;
    return { result, popup: null, reused };
  }

  if (target) {
    url.searchParams.set('placed', '1');
    url.searchParams.set('left', String(Math.round(target.availLeft)));
    url.searchParams.set('top', String(Math.round(target.availTop)));
    url.searchParams.set('width', String(Math.round(target.availWidth)));
    url.searchParams.set('height', String(Math.round(target.availHeight)));
    placePopup(popup, target);
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
          stopped: parsed.stopped ?? false,
          autoAdvance: parsed.autoAdvance ?? false,
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
    stopped: state.stopped ?? previous.stopped,
    autoAdvance: state.autoAdvance ?? previous.autoAdvance,
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
    onState({
      ...state,
      stopped: state.stopped ?? false,
      autoAdvance: state.autoAdvance ?? false,
      launchId: state.launchId ?? '',
    });
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
