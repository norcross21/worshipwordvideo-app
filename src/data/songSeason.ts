import type { WorshipSong } from './worshipSongs';

export const WORSHIP_SEASONS = [
  'Advent',
  'Christmas',
  'Lent & Holy Week',
  'Easter',
  'Pentecost',
  'Harvest & Thanksgiving',
] as const;

export type WorshipSeason = typeof WORSHIP_SEASONS[number];

type SeasonalSong = Pick<
  WorshipSong,
  'title' | 'englishTitle' | 'artist' | 'tune' | 'searchAliases'
>;

const SEASON_PATTERNS: Record<WorshipSeason, RegExp> = {
  Advent: /\badvent\b|o come,? o come emmanuel|come thou long[- ]expected jesus|lo!? he comes|people,? look east|hills of the north|on jordan'?s bank/i,
  Christmas: /\bchristmas\b|\bno[eë]l\b|\bnativity\b|\bmanger\b|\bbethlehem\b|silent night|hark!? the herald|once in royal david|o come,? all ye faithful|away in a manger|infant holy|angels from the realms|joy to the world|see amid the winter|ding dong merrily|while shepherds watched|in the bleak midwinter|god rest ye merry|first nowell|o little town/i,
  'Lent & Holy Week': /\blent\b|ash wednesday|holy week|palm sunday|good friday|\bpassion\b|\bgethsemane\b|hosanna,? loud hosanna|when i survey|power of the cross|old rugged cross|all glory,? laud|ride on,? ride on|there is a green hill|my song is love unknown|o sacred head|beneath the cross/i,
  Easter: /\beaster\b|\bresurrection\b|christ the lord is risen|jesus christ is risen|thine be the glory|see,? what a morning|because he lives|living hope|up from the grave|low in the grave|hallelujah,? christ is risen|this joyful eastertide/i,
  Pentecost: /\bpentecost\b|\bholy spirit\b|spirit of (?:the )?living god|come,? holy spirit|breathe on me,? breath of god|o breath of life|send the fire|spirit break out/i,
  'Harvest & Thanksgiving': /\bharvest\b|\bthanksgiving\b|we plough the fields|come,? ye thankful people|give thanks with a grateful heart|all good gifts|for the fruits|praise and thanksgiving/i,
};

export function inferWorshipSeasons(song: SeasonalSong): WorshipSeason[] {
  const identity = [
    song.title,
    song.englishTitle,
    song.tune,
    ...(song.searchAliases ?? []),
  ].filter(Boolean).join(' ');

  return WORSHIP_SEASONS.filter((season) => SEASON_PATTERNS[season].test(identity));
}
