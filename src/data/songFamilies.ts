import type { WorshipSong } from './worshipSongs';

export interface SongFamilyDefinition {
  slug: string;
  title: string;
  matchingTitles: string[];
}

export const SONG_FAMILIES: SongFamilyDefinition[] = [
  { slug: 'goodness-of-god', title: 'Goodness of God', matchingTitles: ['Goodness of God'] },
  { slug: 'way-maker', title: 'Way Maker', matchingTitles: ['Way Maker'] },
  { slug: 'the-blessing', title: 'The Blessing', matchingTitles: ['The Blessing'] },
  { slug: 'what-a-beautiful-name', title: 'What a Beautiful Name', matchingTitles: ['What a Beautiful Name'] },
  { slug: 'oceans-where-feet-may-fail', title: 'Oceans (Where Feet May Fail)', matchingTitles: ['Oceans (Where Feet May Fail)', 'Oceans Where Feet May Fail'] },
  { slug: '10000-reasons-bless-the-lord', title: '10,000 Reasons (Bless the Lord)', matchingTitles: ['10,000 Reasons (Bless the Lord)', '10,000 Reasons'] },
  { slug: 'build-my-life', title: 'Build My Life', matchingTitles: ['Build My Life'] },
  { slug: 'holy-forever', title: 'Holy Forever', matchingTitles: ['Holy Forever'] },
  { slug: 'living-hope', title: 'Living Hope', matchingTitles: ['Living Hope'] },
  { slug: 'amazing-grace-my-chains-are-gone', title: 'Amazing Grace (My Chains Are Gone)', matchingTitles: ['Amazing Grace (My Chains Are Gone)', 'Amazing Grace My Chains Are Gone'] },
  { slug: 'amazing-grace', title: 'Amazing Grace', matchingTitles: ['Amazing Grace'] },
  { slug: 'how-great-is-our-god', title: 'How Great Is Our God', matchingTitles: ['How Great Is Our God'] },
  { slug: 'here-i-am-to-worship', title: 'Here I Am to Worship', matchingTitles: ['Here I Am to Worship'] },
  { slug: 'great-are-you-lord', title: 'Great Are You Lord', matchingTitles: ['Great Are You Lord'] },
  { slug: 'king-of-kings', title: 'King of Kings', matchingTitles: ['King of Kings'] },
  { slug: 'in-christ-alone', title: 'In Christ Alone', matchingTitles: ['In Christ Alone'] },
  { slug: 'cornerstone', title: 'Cornerstone', matchingTitles: ['Cornerstone'] },
  { slug: 'mighty-to-save', title: 'Mighty to Save', matchingTitles: ['Mighty to Save'] },
  { slug: 'good-good-father', title: 'Good Good Father', matchingTitles: ['Good Good Father'] },
  { slug: 'reckless-love', title: 'Reckless Love', matchingTitles: ['Reckless Love'] },
  { slug: 'o-come-to-the-altar', title: 'O Come to the Altar', matchingTitles: ['O Come to the Altar'] },
  { slug: 'no-longer-slaves', title: 'No Longer Slaves', matchingTitles: ['No Longer Slaves'] },
  { slug: 'who-you-say-i-am', title: 'Who You Say I Am', matchingTitles: ['Who You Say I Am'] },
  { slug: 'how-great-thou-art', title: 'How Great Thou Art', matchingTitles: ['How Great Thou Art'] },
];

export function normaliseSongFamilyTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const FAMILY_BY_TITLE = new Map(
  SONG_FAMILIES.flatMap((family) => family.matchingTitles.map((title) => [normaliseSongFamilyTitle(title), family] as const)),
);

export function songFamilyForSong(song: WorshipSong): SongFamilyDefinition | null {
  for (const value of [song.englishTitle, song.title]) {
    if (!value) continue;
    const family = FAMILY_BY_TITLE.get(normaliseSongFamilyTitle(value));
    if (family) return family;
  }
  return null;
}

export function songBelongsToFamily(song: WorshipSong, family: SongFamilyDefinition): boolean {
  return [song.englishTitle, song.title]
    .filter((value): value is string => Boolean(value))
    .some((value) => family.matchingTitles.some((title) => normaliseSongFamilyTitle(value) === normaliseSongFamilyTitle(title)));
}

export function songFamilyForQuery(query: string): SongFamilyDefinition | null {
  return FAMILY_BY_TITLE.get(normaliseSongFamilyTitle(query)) ?? null;
}
