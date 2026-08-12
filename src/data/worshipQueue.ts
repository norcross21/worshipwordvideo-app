import type { WorshipSong } from './worshipSongs';

export const WORSHIP_QUEUE_LIMIT = 30;
const WORSHIP_QUEUE_KEY_PREFIX = 'worship_word_video_queue_v2';
const ACTIVE_SERVICE_KEY_PREFIX = 'worship_word_video_active_service_v1';

export interface WorshipQueueItem {
  id: string;
  songId?: string;
  title: string;
  artist: string;
  youtubeId: string;
  hasWords?: boolean;
  startSeconds?: number;
  endSeconds?: number;
  durationSeconds?: number;
}

export function worshipQueueItem(song: Pick<WorshipSong, 'id' | 'title' | 'artist' | 'youtubeId' | 'wordsIndicated' | 'durationSeconds'>): WorshipQueueItem {
  return {
    id: `${song.id}-${song.youtubeId}`,
    songId: song.id,
    title: song.title,
    artist: song.artist,
    youtubeId: song.youtubeId,
    hasWords: song.wordsIndicated,
    durationSeconds: song.durationSeconds,
  };
}

/** Accept seconds, m:ss or h:mm:ss. A blank field means no trim. */
export function parsePlaybackTime(value: string): number | undefined {
  const input = value.trim();
  if (!input) return undefined;
  if (/^\d+$/.test(input)) return Number(input);
  const parts = input.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return undefined;
  if (parts.some((part, index) => index > 0 && Number(part) > 59)) return undefined;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

export function formatPlaybackTime(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '';
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export function playbackTimingError(startSeconds?: number, endSeconds?: number, durationSeconds?: number): string {
  if (startSeconds != null && startSeconds < 0) return 'Start time cannot be negative.';
  if (endSeconds != null && endSeconds <= 0) return 'Stop time must be later than zero.';
  if (startSeconds != null && endSeconds != null && endSeconds <= startSeconds) return 'Stop time must be later than the start time.';
  if (durationSeconds && startSeconds != null && startSeconds >= durationSeconds) return 'Start time must be before the video ends.';
  if (durationSeconds && endSeconds != null && endSeconds > durationSeconds + 2) return 'Stop time is beyond the video length.';
  return '';
}

export function addToWorshipQueue(queue: WorshipQueueItem[], item: WorshipQueueItem): WorshipQueueItem[] {
  if (!item.youtubeId || queue.some((entry) => entry.youtubeId === item.youtubeId)) return queue;
  return [...queue, item].slice(0, WORSHIP_QUEUE_LIMIT);
}

export function moveWorshipQueueItem(queue: WorshipQueueItem[], index: number, direction: -1 | 1): WorshipQueueItem[] {
  const destination = index + direction;
  if (index < 0 || index >= queue.length || destination < 0 || destination >= queue.length) return queue;
  const next = [...queue];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

/** Return the next playable position, or null when the service has finished. */
export function nextWorshipQueueIndex(currentIndex: number | null, queueLength: number): number | null {
  if (currentIndex == null || currentIndex < 0 || queueLength <= 0) return null;
  return currentIndex + 1 < queueLength ? currentIndex + 1 : null;
}

function worshipQueueKey(userId: string): string {
  return `${WORSHIP_QUEUE_KEY_PREFIX}:${userId}`;
}

export function getWorshipQueue(userId?: string): WorshipQueueItem[] {
  if (!userId) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(worshipQueueKey(userId)) ?? '[]') as WorshipQueueItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.youtubeId && item?.title).slice(0, WORSHIP_QUEUE_LIMIT) : [];
  } catch {
    return [];
  }
}

export function saveWorshipQueue(queue: WorshipQueueItem[], userId?: string) {
  if (!userId) return;
  try {
    localStorage.setItem(worshipQueueKey(userId), JSON.stringify(queue.slice(0, WORSHIP_QUEUE_LIMIT)));
  } catch {
    // The queue remains available for this session when storage is unavailable.
  }
}

function activeServiceKey(userId: string): string {
  return `${ACTIVE_SERVICE_KEY_PREFIX}:${userId}`;
}

export function getActiveServiceId(userId?: string): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(activeServiceKey(userId));
  } catch {
    return null;
  }
}

export function saveActiveServiceId(serviceId: string | null, userId?: string) {
  if (!userId) return;
  try {
    if (serviceId) localStorage.setItem(activeServiceKey(userId), serviceId);
    else localStorage.removeItem(activeServiceKey(userId));
  } catch {
    // The selected service still remains active for the current session.
  }
}
