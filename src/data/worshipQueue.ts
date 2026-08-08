import type { WorshipSong } from './worshipSongs';

export const WORSHIP_QUEUE_LIMIT = 10;
const WORSHIP_QUEUE_KEY = 'liturgy_worship_video_queue_v1';

export interface WorshipQueueItem {
  id: string;
  songId?: string;
  title: string;
  artist: string;
  youtubeId: string;
}

export function worshipQueueItem(song: Pick<WorshipSong, 'id' | 'title' | 'artist' | 'youtubeId'>): WorshipQueueItem {
  return {
    id: `${song.id}-${song.youtubeId}`,
    songId: song.id,
    title: song.title,
    artist: song.artist,
    youtubeId: song.youtubeId,
  };
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

export function getWorshipQueue(): WorshipQueueItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORSHIP_QUEUE_KEY) ?? '[]') as WorshipQueueItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.youtubeId && item?.title).slice(0, WORSHIP_QUEUE_LIMIT) : [];
  } catch {
    return [];
  }
}

export function saveWorshipQueue(queue: WorshipQueueItem[]) {
  try {
    localStorage.setItem(WORSHIP_QUEUE_KEY, JSON.stringify(queue.slice(0, WORSHIP_QUEUE_LIMIT)));
  } catch {
    // The queue remains available for this session when storage is unavailable.
  }
}
