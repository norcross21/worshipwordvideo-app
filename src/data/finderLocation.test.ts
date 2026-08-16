import { describe, expect, it } from 'vitest';
import { finderParameter, finderUrl } from './finderLocation';

describe('finder locations', () => {
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
