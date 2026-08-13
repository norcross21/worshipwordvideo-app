import type { WorshipSong } from './worshipSongs';

export interface SongFamilyDefinition {
  slug: string;
  title: string;
  matchingTitles: string[];
}

export const SONG_FAMILIES: SongFamilyDefinition[] = [
  { slug: '10000-reasons-bless-the-lord', title: '10,000 Reasons (Bless the Lord)', matchingTitles: ['10,000 Reasons (Bless the Lord)', '10,000 Reasons'] },
  { slug: 'a-thousand-hallelujahs', title: 'A Thousand Hallelujahs', matchingTitles: ['A Thousand Hallelujahs'] },
  { slug: 'above-all', title: 'Above All', matchingTitles: ['Above All'] },
  { slug: 'all-hail-king-jesus', title: 'All Hail King Jesus', matchingTitles: ['All Hail King Jesus'] },
  { slug: 'amazing-grace', title: 'Amazing Grace', matchingTitles: ['Amazing Grace'] },
  { slug: 'amazing-grace-my-chains-are-gone', title: 'Amazing Grace (My Chains Are Gone)', matchingTitles: ['Amazing Grace (My Chains Are Gone)', 'Amazing Grace My Chains Are Gone'] },
  { slug: 'awesome-god', title: 'Awesome God', matchingTitles: ['Awesome God'] },
  { slug: 'battle-belongs', title: 'Battle Belongs', matchingTitles: ['Battle Belongs'] },
  { slug: 'behold-our-god', title: 'Behold Our God', matchingTitles: ['Behold Our God'] },
  { slug: 'blessed-be-your-name', title: 'Blessed Be Your Name', matchingTitles: ['Blessed Be Your Name'] },
  { slug: 'breathe', title: 'Breathe', matchingTitles: ['Breathe'] },
  { slug: 'build-my-life', title: 'Build My Life', matchingTitles: ['Build My Life'] },
  { slug: 'change-my-heart-o-god', title: 'Change My Heart, O God', matchingTitles: ['Change My Heart, O God'] },
  { slug: 'christ-be-magnified', title: 'Christ Be Magnified', matchingTitles: ['Christ Be Magnified'] },
  { slug: 'christ-our-hope-in-life-and-death', title: 'Christ Our Hope in Life and Death', matchingTitles: ['Christ Our Hope in Life and Death'] },
  { slug: 'come-jesus-come', title: 'Come Jesus Come', matchingTitles: ['Come Jesus Come'] },
  { slug: 'cornerstone', title: 'Cornerstone', matchingTitles: ['Cornerstone'] },
  { slug: 'create-in-me-a-clean-heart', title: 'Create in Me a Clean Heart', matchingTitles: ['Create in Me a Clean Heart'] },
  { slug: 'do-it-again', title: 'Do It Again', matchingTitles: ['Do It Again'] },
  { slug: 'everlasting-god', title: 'Everlasting God', matchingTitles: ['Everlasting God', 'Everlasting God (Strength Will Rise)'] },
  { slug: 'firm-foundation-he-wont', title: "Firm Foundation (He Won't)", matchingTitles: ["Firm Foundation (He Won't)", 'Firm Foundation He Won’t'] },
  { slug: 'god-i-look-to-you', title: 'God I Look to You', matchingTitles: ['God I Look to You'] },
  { slug: 'god-of-wonders', title: 'God of Wonders', matchingTitles: ['God of Wonders'] },
  { slug: 'god-so-loved', title: 'God So Loved', matchingTitles: ['God So Loved'] },
  { slug: 'good-good-father', title: 'Good Good Father', matchingTitles: ['Good Good Father'] },
  { slug: 'goodness-of-god', title: 'Goodness of God', matchingTitles: ['Goodness of God'] },
  { slug: 'gratitude', title: 'Gratitude', matchingTitles: ['Gratitude'] },
  { slug: 'graves-into-gardens', title: 'Graves Into Gardens', matchingTitles: ['Graves Into Gardens'] },
  { slug: 'great-are-you-lord', title: 'Great Are You Lord', matchingTitles: ['Great Are You Lord'] },
  { slug: 'great-is-thy-faithfulness', title: 'Great Is Thy Faithfulness', matchingTitles: ['Great Is Thy Faithfulness'] },
  { slug: 'great-things', title: 'Great Things', matchingTitles: ['Great Things'] },
  { slug: 'he-is-exalted', title: 'He Is Exalted', matchingTitles: ['He Is Exalted'] },
  { slug: 'here-i-am-to-worship', title: 'Here I Am to Worship', matchingTitles: ['Here I Am to Worship'] },
  { slug: 'holy-forever', title: 'Holy Forever', matchingTitles: ['Holy Forever'] },
  { slug: 'holy-is-the-lord', title: 'Holy Is the Lord', matchingTitles: ['Holy Is the Lord'] },
  { slug: 'hosanna', title: 'Hosanna', matchingTitles: ['Hosanna'] },
  { slug: 'hosanna-praise-is-rising', title: 'Hosanna (Praise Is Rising)', matchingTitles: ['Hosanna (Praise Is Rising)'] },
  { slug: 'house-of-the-lord', title: 'House of the Lord', matchingTitles: ['House of the Lord'] },
  { slug: 'how-deep-the-fathers-love-for-us', title: "How Deep the Father's Love for Us", matchingTitles: ["How Deep the Father's Love for Us"] },
  { slug: 'how-great-is-our-god', title: 'How Great Is Our God', matchingTitles: ['How Great Is Our God'] },
  { slug: 'how-great-thou-art', title: 'How Great Thou Art', matchingTitles: ['How Great Thou Art'] },
  { slug: 'how-he-loves', title: 'How He Loves', matchingTitles: ['How He Loves'] },
  { slug: 'hymn-of-heaven', title: 'Hymn of Heaven', matchingTitles: ['Hymn of Heaven'] },
  { slug: 'i-speak-jesus', title: 'I Speak Jesus', matchingTitles: ['I Speak Jesus'] },
  { slug: 'i-thank-god', title: 'I Thank God', matchingTitles: ['I Thank God'] },
  { slug: 'in-christ-alone', title: 'In Christ Alone', matchingTitles: ['In Christ Alone'] },
  { slug: 'indescribable', title: 'Indescribable', matchingTitles: ['Indescribable'] },
  { slug: 'is-he-worthy', title: 'Is He Worthy?', matchingTitles: ['Is He Worthy?'] },
  { slug: 'jesus-all-for-jesus', title: 'Jesus, All for Jesus', matchingTitles: ['Jesus, All for Jesus'] },
  { slug: 'jesus-lover-of-my-soul', title: 'Jesus, Lover of My Soul', matchingTitles: ['Jesus, Lover of My Soul'] },
  { slug: 'jireh', title: 'Jireh', matchingTitles: ['Jireh'] },
  { slug: 'king-of-kings', title: 'King of Kings', matchingTitles: ['King of Kings'] },
  { slug: 'king-of-kings-majesty', title: 'King of Kings, Majesty', matchingTitles: ['King of Kings, Majesty'] },
  { slug: 'king-of-my-heart', title: 'King of My Heart', matchingTitles: ['King of My Heart'] },
  { slug: 'living-hope', title: 'Living Hope', matchingTitles: ['Living Hope'] },
  { slug: 'look-up-child', title: 'Look Up Child', matchingTitles: ['Look Up Child'] },
  { slug: 'lord-i-need-you', title: 'Lord I Need You', matchingTitles: ['Lord I Need You'] },
  { slug: 'lord-i-lift-your-name-on-high', title: 'Lord, I Lift Your Name on High', matchingTitles: ['Lord, I Lift Your Name on High'] },
  { slug: 'mighty-to-save', title: 'Mighty to Save', matchingTitles: ['Mighty to Save'] },
  { slug: 'million-little-miracles', title: 'Million Little Miracles', matchingTitles: ['Million Little Miracles'] },
  { slug: 'my-lighthouse', title: 'My Lighthouse', matchingTitles: ['My Lighthouse'] },
  { slug: 'no-longer-slaves', title: 'No Longer Slaves', matchingTitles: ['No Longer Slaves'] },
  { slug: 'o-come-to-the-altar', title: 'O Come to the Altar', matchingTitles: ['O Come to the Altar'] },
  { slug: 'o-praise-the-name', title: 'O Praise the Name (Anástasis)', matchingTitles: ['O Praise the Name (Anástasis)', 'O Praise the Name'] },
  { slug: 'oceans-where-feet-may-fail', title: 'Oceans (Where Feet May Fail)', matchingTitles: ['Oceans (Where Feet May Fail)', 'Oceans Where Feet May Fail'] },
  { slug: 'one-way', title: 'One Way', matchingTitles: ['One Way'] },
  { slug: 'only-a-holy-god', title: 'Only a Holy God', matchingTitles: ['Only a Holy God'] },
  { slug: 'open-the-eyes-of-my-heart', title: 'Open the Eyes of My Heart', matchingTitles: ['Open the Eyes of My Heart'] },
  { slug: 'our-god-is-greater', title: 'Our God Is Greater', matchingTitles: ['Our God Is Greater'] },
  { slug: 'praise', title: 'Praise', matchingTitles: ['Praise'] },
  { slug: 'promises', title: 'Promises', matchingTitles: ['Promises'] },
  { slug: 'psalm-23-i-am-not-alone', title: 'Psalm 23 (I Am Not Alone)', matchingTitles: ['Psalm 23 (I Am Not Alone)'] },
  { slug: 'raise-a-hallelujah', title: 'Raise a Hallelujah', matchingTitles: ['Raise a Hallelujah'] },
  { slug: 'reckless-love', title: 'Reckless Love', matchingTitles: ['Reckless Love'] },
  { slug: 'same-god', title: 'Same God', matchingTitles: ['Same God'] },
  { slug: 'shine-jesus-shine', title: 'Shine, Jesus, Shine', matchingTitles: ['Shine, Jesus, Shine'] },
  { slug: 'shout-to-the-lord', title: 'Shout to the Lord', matchingTitles: ['Shout to the Lord'] },
  { slug: 'spirit-break-out', title: 'Spirit Break Out', matchingTitles: ['Spirit Break Out'] },
  { slug: 'surrender', title: 'Surrender', matchingTitles: ['Surrender'] },
  { slug: 'thank-god-i-do', title: 'Thank God I Do', matchingTitles: ['Thank God I Do'] },
  { slug: 'thank-you-jesus-for-the-blood', title: 'Thank You Jesus for the Blood', matchingTitles: ['Thank You Jesus for the Blood'] },
  { slug: 'the-blessing', title: 'The Blessing', matchingTitles: ['The Blessing'] },
  { slug: 'the-heart-of-worship', title: 'The Heart of Worship', matchingTitles: ['The Heart of Worship'] },
  { slug: 'the-lord-is-my-salvation', title: 'The Lord Is My Salvation', matchingTitles: ['The Lord Is My Salvation'] },
  { slug: 'this-i-believe-the-creed', title: 'This I Believe (The Creed)', matchingTitles: ['This I Believe (The Creed)', 'This I Believe The Creed'] },
  { slug: 'this-is-amazing-grace', title: 'This Is Amazing Grace', matchingTitles: ['This Is Amazing Grace'] },
  { slug: 'this-is-our-god', title: 'This Is Our God', matchingTitles: ['This Is Our God'] },
  { slug: 'tremble', title: 'Tremble', matchingTitles: ['Tremble'] },
  { slug: 'trust-in-god', title: 'Trust in God', matchingTitles: ['Trust in God'] },
  { slug: 'trust-in-you', title: 'Trust in You', matchingTitles: ['Trust in You'] },
  { slug: 'turn-your-eyes-upon-jesus', title: 'Turn Your Eyes Upon Jesus', matchingTitles: ['Turn Your Eyes Upon Jesus', 'Turn Your Eyes'] },
  { slug: 'wait-on-you', title: 'Wait on You', matchingTitles: ['Wait on You'] },
  { slug: 'way-maker', title: 'Way Maker', matchingTitles: ['Way Maker'] },
  { slug: 'what-a-beautiful-name', title: 'What a Beautiful Name', matchingTitles: ['What a Beautiful Name'] },
  { slug: 'who-you-say-i-am', title: 'Who You Say I Am', matchingTitles: ['Who You Say I Am'] },
  { slug: 'worthy-is-the-lamb', title: 'Worthy Is the Lamb', matchingTitles: ['Worthy Is the Lamb'] },
  { slug: 'worthy-of-it-all', title: 'Worthy of It All', matchingTitles: ['Worthy of It All'] },
  { slug: 'yet-not-i-but-through-christ-in-me', title: 'Yet Not I But Through Christ in Me', matchingTitles: ['Yet Not I But Through Christ in Me'] },
  { slug: 'you-never-let-go', title: 'You Never Let Go', matchingTitles: ['You Never Let Go'] },
  { slug: 'you-say', title: 'You Say', matchingTitles: ['You Say'] },
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

const NORMALISED_TITLES_BY_FAMILY = new Map(
  SONG_FAMILIES.map((family) => [
    family.slug,
    new Set(family.matchingTitles.map(normaliseSongFamilyTitle)),
  ] as const),
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
  const matchingTitles = NORMALISED_TITLES_BY_FAMILY.get(family.slug);
  if (!matchingTitles) return false;
  return [song.englishTitle, song.title]
    .filter((value): value is string => Boolean(value))
    .some((value) => matchingTitles.has(normaliseSongFamilyTitle(value)));
}

export function songFamilyForQuery(query: string): SongFamilyDefinition | null {
  return FAMILY_BY_TITLE.get(normaliseSongFamilyTitle(query)) ?? null;
}
