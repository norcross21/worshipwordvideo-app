import { describe, expect, it } from 'vitest';
import {
  effectiveVideoWordsStatus,
  setWorshipVideoApproved,
  setWorshipVideoWords,
  videoTitleIndicatesWords,
} from './videoApproval';

describe('worship video approval', () => {
  it('adds and removes an exact video without mutating the original set', () => {
    const current = new Set(['abcdefghijk']);
    const approved = setWorshipVideoApproved(current, '12345678901', true);
    expect([...approved]).toEqual(['abcdefghijk', '12345678901']);
    expect([...current]).toEqual(['abcdefghijk']);
    expect([...setWorshipVideoApproved(approved, 'abcdefghijk', false)]).toEqual(['12345678901']);
  });

  it('records whether an exact video shows words', () => {
    const reviewed = setWorshipVideoWords({}, '12345678901', 'words-shown');
    expect(reviewed).toEqual({ '12345678901': 'words-shown' });
    expect(setWorshipVideoWords(reviewed, '12345678901')).toEqual({});
  });

  it('recognises explicit word-video metadata without guessing from ordinary music titles', () => {
    expect(videoTitleIndicatesWords('Amazing Grace (Official Lyric Video)')).toBe(true);
    expect(videoTitleIndicatesWords('Salve Regina - Latin/English Text')).toBe(true);
    expect(videoTitleIndicatesWords('Great Is Thy Faithfulness (Official Music Video)')).toBe(false);
  });

  it('lets a local review override catalogue metadata', () => {
    expect(effectiveVideoWordsStatus({}, 'SmqLKr6gF-Q')).toBe('words-shown');
    expect(effectiveVideoWordsStatus({ 'SmqLKr6gF-Q': 'no-words' }, 'SmqLKr6gF-Q')).toBe('no-words');
  });
});
