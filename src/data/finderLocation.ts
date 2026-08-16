const FINDER_ANCHOR = 'main-content';

/**
 * Keep finder state in the URL fragment so search engines do not crawl every
 * filter combination as a separate page. The fragment is still available to
 * the client-side finder after the page loads.
 */
export function finderUrl(parameters?: URLSearchParams): string {
  const query = parameters?.toString();
  return query ? `/#${FINDER_ANCHOR}?${query}` : `/#${FINDER_ANCHOR}`;
}

/**
 * Continue accepting legacy query-string links while preferring the new
 * fragment parameters used by generated SEO pages.
 */
export function finderParameter(search: string, hash: string, name: string): string {
  const queryValue = new URLSearchParams(search).get(name)?.trim();
  if (queryValue) return queryValue;

  const queryStart = hash.indexOf('?');
  if (queryStart < 0) return '';
  return new URLSearchParams(hash.slice(queryStart + 1)).get(name)?.trim() ?? '';
}
