import { describe, expect, it } from 'vitest';
import { inferLanguagePresentation } from './songPresentation';

describe('inferLanguagePresentation', () => {
  it('recognises English subtitles on a native-language performance', () => {
    expect(inferLanguagePresentation({
      title: 'Mungu ni Mwema — Kiswahili worship with English subtitles',
      language: 'Swahili',
    })).toBe('Native-language vocal with English subtitles');
  });

  it('recognises translated subtitles in several uploader languages', () => {
    expect(inferLanguagePresentation({
      title: 'Goodness of God — lirik dan terjemahan Indonesia',
      language: 'Indonesian',
    })).toBe('English vocal with translated subtitles');

    expect(inferLanguagePresentation({
      title: 'Way Maker — lyrics + traduction française',
      language: 'French',
    })).toBe('English vocal with translated subtitles');
  });

  it('keeps native-language lyric videos distinct from translated subtitles', () => {
    expect(inferLanguagePresentation({
      title: 'سرود پرستشی فارسی با متن',
      language: 'Persian/Farsi',
      versionType: 'Native-language worship',
    })).toBe('Native-language vocal with native words');
  });
});
