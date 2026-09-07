import { describe, expect, it } from 'vitest';
import { finderParameter, finderUrl } from './finderLocation';

describe('finder locations', () => {
  it('opens language and vocal-format selections together', () => {
    const language = 'Luganda';
    const presentation = 'Native-language vocal with English subtitles';
    const url = finderUrl(new URLSearchParams({ language, presentation }));
    const hash = url.slice(url.indexOf('#'));
    expect(finderParameter('', hash, 'language')).toBe(language);
    expect(finderParameter('', hash, 'presentation')).toBe(presentation);
    expect(url.startsWith('/#')).toBe(true);
  });
  it('builds filter links without crawlable query parameters', () => {
    const parameters = new URLSearchParams({ q: 'Goodness of God', language: 'Italian' });

    expect(finderUrl(parameters)).toBe('/#main-content?q=Goodness+of+God&language=Italian');
  });

  it('reads the new fragment parameters', () => {
    expect(finderParameter('', '#main-content?language=Persian+%2F+Farsi', 'language'))
      .toBe('Persian / Farsi');
  });

  it('keeps legacy query-string links working', () => {
    expect(finderParameter('?language=Italian', '#main-content?language=French', 'language'))
      .toBe('Italian');
  });
});
