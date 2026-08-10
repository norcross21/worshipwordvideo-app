import type { WorshipQueueItem } from './worshipQueue';

const PROJECTION_STORAGE_KEY = 'worship_word_video_projection_v1';
const PROJECTION_CHANNEL_NAME = 'worship-word-video-projection';
const PROJECTION_COMMAND_STORAGE_KEY = 'worship_word_video_projection_command_v1';
const PROJECTION_COMMAND_CHANNEL_NAME = 'worship-word-video-projection-command';

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

export type ProjectionCommandType = 'start' | 'closed' | 'ended';

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
  updatedAt: number;
}

export const EMPTY_PROJECTION_STATE: ProjectionState = {
  queue: [],
  playingIndex: null,
  playbackRevision: 0,
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

export function readProjectionState(): ProjectionState {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTION_STORAGE_KEY) ?? 'null') as ProjectionState | null;
    return parsed && Array.isArray(parsed.queue) ? parsed : EMPTY_PROJECTION_STATE;
  } catch {
    return EMPTY_PROJECTION_STATE;
  }
}

export function publishProjectionState(state: Omit<ProjectionState, 'updatedAt'>): ProjectionState {
  const next = { ...state, updatedAt: Date.now() };
  try {
    localStorage.setItem(PROJECTION_STORAGE_KEY, JSON.stringify(next));
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(PROJECTION_CHANNEL_NAME);
      channel.postMessage(next);
      channel.close();
    }
  } catch {
    // The controller remains usable in strict privacy modes.
  }
  return next;
}

export function subscribeToProjectionState(onState: (state: ProjectionState) => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === PROJECTION_STORAGE_KEY) onState(readProjectionState());
  };
  window.addEventListener('storage', handleStorage);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(PROJECTION_CHANNEL_NAME) : null;
  if (channel) channel.onmessage = (event: MessageEvent<ProjectionState>) => onState(event.data);
  return () => {
    window.removeEventListener('storage', handleStorage);
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
  try {
    localStorage.setItem(PROJECTION_COMMAND_STORAGE_KEY, JSON.stringify(command));
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(PROJECTION_COMMAND_CHANNEL_NAME);
      channel.postMessage(command);
      channel.close();
    }
  } catch {
    // The projection window can still be controlled manually in strict privacy modes.
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
  window.addEventListener('storage', handleStorage);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(PROJECTION_COMMAND_CHANNEL_NAME) : null;
  if (channel) channel.onmessage = (event: MessageEvent<ProjectionCommand>) => deliver(event.data);
  return () => {
    window.removeEventListener('storage', handleStorage);
    channel?.close();
  };
}
