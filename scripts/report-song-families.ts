import { getFullSongLibrary } from '../src/data/songLibraryStore';
import { videoTitleIndicatesWords } from '../src/data/videoApproval';
import { WORSHIP_VIDEO_AUDIT } from '../src/data/worshipVideoAudit';

const requestedTitles = process.argv.slice(2);
const defaultTitles = [
  '10,000 Reasons (Bless the Lord)',
  'Build My Life',
  'Holy Forever',
  'Living Hope',
  'Amazing Grace (My Chains Are Gone)',
  'Amazing Grace',
  'How Great Is Our God',
  'Here I Am to Worship',
  'Great Are You Lord',
  'King of Kings',
  'In Christ Alone',
  'Cornerstone',
  'Mighty to Save',
  'Good Good Father',
  'Reckless Love',
  'O Come to the Altar',
  'No Longer Slaves',
  'Who You Say I Am',
  'What a Friend We Have in Jesus',
  'How Great Thou Art',
  'Blessed Assurance',
];

function normaliseTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const songs = getFullSongLibrary().filter((song) => (
  Boolean(song.youtubeId)
  && (
    song.wordsIndicated === true
    || Boolean(song.wordEvidence)
    || videoTitleIndicatesWords(song.title)
    || videoTitleIndicatesWords(WORSHIP_VIDEO_AUDIT[song.youtubeId]?.title ?? '')
  )
));

let qualifyingFamilies = 0;
let qualifyingWordVideos = 0;

for (const title of requestedTitles.length ? requestedTitles : defaultTitles) {
  const key = normaliseTitle(title);
  const matches = songs.filter((song) => (
    [song.title, song.englishTitle]
      .filter((value): value is string => Boolean(value))
      .some((value) => normaliseTitle(value) === key)
  ));
  const languages = [...new Set(matches.map((song) => song.language ?? 'English'))].sort();
  const namedLanguages = languages.filter((language) => language !== 'Language not stated');
  const namedVideos = matches.filter((song) => (song.language ?? 'English') !== 'Language not stated').length;
  if (namedLanguages.length >= 3) {
    qualifyingFamilies += 1;
    qualifyingWordVideos += namedVideos;
  }
  console.log(JSON.stringify({
    title,
    wordVideos: namedVideos,
    namedLanguages: namedLanguages.length,
    languageNames: namedLanguages,
    unclassifiedVideos: matches.length - namedVideos,
  }));
}

console.log(JSON.stringify({ summary: { qualifyingFamilies, qualifyingWordVideos, minimumNamedLanguages: 3 } }));
