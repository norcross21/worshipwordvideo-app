import { describe, expect, it } from 'vitest';
import { inferWorshipSeasons } from './songSeason';
import type { WorshipSong } from './worshipSongs';

function song(title: string): WorshipSong {
  return {
    id: title,
    title,
    artist: 'Church video',
    category: 'Traditional Hymn',
    youtubeId: 'abcdefghijk',
  };
}

describe('inferWorshipSeasons', () => {
  it.each([
    ['O Come, O Come Emmanuel', 'Advent'],
    ['Hark! The Herald Angels Sing', 'Christmas'],
    ['When I Survey the Wondrous Cross', 'Lent & Holy Week'],
    ['Jesus Christ Is Risen Today', 'Easter'],
    ['Spirit of the Living God', 'Pentecost'],
    ['Come, Ye Thankful People, Come', 'Harvest & Thanksgiving'],
  ] as const)('places %s in %s', (title, season) => {
    expect(inferWorshipSeasons(song(title))).toContain(season);
  });

  it('does not force a general worship song into a season', () => {
    expect(inferWorshipSeasons(song('Goodness of God'))).toEqual([]);
  });

  it('does not treat an artist name as seasonal evidence', () => {
    expect(inferWorshipSeasons({ ...song('All Heaven Declares'), artist: 'Noel Richards' })).toEqual([]);
  });
});
