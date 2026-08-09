import { getFullSongLibrary } from '../src/data/songLibraryStore';
import { inferLanguagePresentation, inferWorshipArrangement } from '../src/data/songPresentation';

const library = getFullSongLibrary();
const playable = library.filter((song) => song.youtubeId);
const summary = {
  catalogueEntries: library.length,
  playableVideos: playable.length,
  uniquePlayableVideos: new Set(playable.map((song) => song.youtubeId)).size,
  languages: new Set(playable.map((song) => song.language ?? 'English')).size,
  arrangements: Object.fromEntries(
    [...new Set(playable.map(inferWorshipArrangement))].map((label) => [label, playable.filter((song) => inferWorshipArrangement(song) === label).length]),
  ),
  presentations: Object.fromEntries(
    [...new Set(playable.map(inferLanguagePresentation))].map((label) => [label, playable.filter((song) => inferLanguagePresentation(song) === label).length]),
  ),
};

console.log(JSON.stringify(summary, null, 2));
