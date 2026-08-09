import type { WorshipQueueItem } from './worshipQueue';

const PROJECTION_STORAGE_KEY = 'worship_word_video_projection_v1';
const PROJECTION_CHANNEL_NAME = 'worship-word-video-projection';

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
