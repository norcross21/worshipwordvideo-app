import type { WorshipSong } from './worshipSongs';

/** Choose the first usable video in the newly displayed result list. */
export function firstPlayableSong(songs: WorshipSong[]): WorshipSong | null {
  return songs.find((song) => Boolean(song.youtubeId?.trim())) ?? songs[0] ?? null;
}
