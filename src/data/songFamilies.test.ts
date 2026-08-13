import { describe, expect, it } from 'vitest';
import { getFullSongLibrary } from './songLibraryStore';
import { SONG_FAMILIES, songFamilyForSong } from './songFamilies';
import { videoTitleIndicatesWords } from './videoApproval';
import { WORSHIP_VIDEO_AUDIT } from './worshipVideoAudit';

describe('multilingual familiar-song collections', () => {
  it('keeps exactly 100 alphabetised, uniquely addressed choices', () => {
    expect(SONG_FAMILIES).toHaveLength(100);
    expect(new Set(SONG_FAMILIES.map((family) => family.slug)).size).toBe(100);
    expect(SONG_FAMILIES.map((family) => family.title)).toEqual(
      [...SONG_FAMILIES.map((family) => family.title)].sort((left, right) => left.localeCompare(right)),
    );
  });

  it('only offers songs with word videos in at least two named languages', () => {
    const languagesByFamily = new Map<string, Set<string>>();

    for (const song of getFullSongLibrary()) {
      const hasWordEvidence = song.wordsIndicated === true
        || Boolean(song.wordEvidence)
        || videoTitleIndicatesWords(song.title)
        || videoTitleIndicatesWords(WORSHIP_VIDEO_AUDIT[song.youtubeId]?.title ?? '');
      const language = song.language ?? 'English';
      if (!song.youtubeId || !hasWordEvidence || language === 'Language not stated') continue;
      const family = songFamilyForSong(song);
      if (!family) continue;
      const languages = languagesByFamily.get(family.slug) ?? new Set<string>();
      languages.add(language);
      languagesByFamily.set(family.slug, languages);
    }

    const underfilledFamilies = SONG_FAMILIES
      .filter((family) => (languagesByFamily.get(family.slug)?.size ?? 0) < 2)
      .map((family) => family.title);
    expect(underfilledFamilies).toEqual([]);
  });
});
