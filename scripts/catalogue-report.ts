import { getFullSongLibrary } from '../src/data/songLibraryStore';
import { inferLanguagePresentation, inferWorshipArrangement } from '../src/data/songPresentation';

const library = getFullSongLibrary();
const playable = library.filter((song) => song.youtubeId);
const namedLanguages = new Set(
  playable
    .map((song) => song.language ?? 'English')
    .filter((language) => language !== 'Language not stated'),
);

const countBy = <T>(items: T[], getLabel: (item: T) => string) => {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const label = getLabel(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
};

const summary = {
  catalogueEntries: library.length,
  playableVideos: playable.length,
  uniquePlayableVideos: new Set(playable.map((song) => song.youtubeId)).size,
  namedLanguages: namedLanguages.size,
  languageLabelsIncludingUnstated: new Set(playable.map((song) => song.language ?? 'English')).size,
  videosByLanguage: countBy(playable, (song) => song.language ?? 'English'),
  arrangements: countBy(playable, inferWorshipArrangement),
  presentations: countBy(playable, inferLanguagePresentation),
};

console.log(JSON.stringify(summary, null, 2));
