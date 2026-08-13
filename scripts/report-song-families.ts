import { getFullSongLibrary } from '../src/data/songLibraryStore';
import { SONG_FAMILIES, songBelongsToFamily, type SongFamilyDefinition } from '../src/data/songFamilies';
import { videoTitleIndicatesWords } from '../src/data/videoApproval';
import { WORSHIP_VIDEO_AUDIT } from '../src/data/worshipVideoAudit';

const requestedTitles = process.argv.slice(2);
const requestedFamilies: SongFamilyDefinition[] = requestedTitles.length
  ? requestedTitles.map((title) => ({
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    title,
    matchingTitles: [title],
  }))
  : SONG_FAMILIES;

const songs = getFullSongLibrary().filter((song) => (
  Boolean(song.youtubeId)
  && (
    song.wordsIndicated === true
    || Boolean(song.wordEvidence)
    || videoTitleIndicatesWords(song.title)
    || videoTitleIndicatesWords(WORSHIP_VIDEO_AUDIT[song.youtubeId]?.title ?? '')
  )
));

let pickerQualifyingFamilies = 0;
let seoQualifyingFamilies = 0;
let qualifyingWordVideos = 0;

for (const family of requestedFamilies) {
  const matches = songs.filter((song) => songBelongsToFamily(song, family));
  const languages = [...new Set(matches.map((song) => song.language ?? 'English'))].sort();
  const namedLanguages = languages.filter((language) => language !== 'Language not stated');
  const namedVideos = matches.filter((song) => (song.language ?? 'English') !== 'Language not stated').length;
  if (namedLanguages.length >= 2) pickerQualifyingFamilies += 1;
  if (namedLanguages.length >= 3) {
    seoQualifyingFamilies += 1;
    qualifyingWordVideos += namedVideos;
  }
  console.log(JSON.stringify({
    title: family.title,
    wordVideos: namedVideos,
    namedLanguages: namedLanguages.length,
    languageNames: namedLanguages,
    unclassifiedVideos: matches.length - namedVideos,
  }));
}

console.log(JSON.stringify({
  summary: {
    configuredFamilies: requestedFamilies.length,
    pickerQualifyingFamilies,
    pickerMinimumNamedLanguages: 2,
    seoQualifyingFamilies,
    seoMinimumNamedLanguages: 3,
    qualifyingWordVideos,
  },
}));
