import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getFullSongLibrary } from '../src/data/songLibraryStore';
import { inferWorshipSeasons, WORSHIP_SEASONS, type WorshipSeason } from '../src/data/songSeason';
import { LANGUAGE_PRESENTATIONS, inferLanguagePresentation, inferWorshipArrangement } from '../src/data/songPresentation';
import { videoTitleIndicatesWords } from '../src/data/videoApproval';
import { WORSHIP_VIDEO_AUDIT } from '../src/data/worshipVideoAudit';
import type { LanguagePresentation, WorshipSong } from '../src/data/worshipSongs';
import { canonicaliseSongLanguage } from '../src/data/songLanguage';
import { SONG_FAMILIES, songBelongsToFamily, type SongFamilyDefinition } from '../src/data/songFamilies';

const SITE = 'https://www.worshipwordvideo.org';
const PUBLIC_DIR = resolve(process.cwd(), 'public');
const LAST_MODIFIED = '2026-08-12';
const FEED_DATE = 'Wed, 12 Aug 2026 00:00:00 GMT';
const INDEXNOW_KEY = 'b2b960d2c713e3e71a89a4f6e34345d1';
const MIN_LANGUAGE_PAGE_VIDEOS = 3;

interface SeoPage {
  path: string;
  title: string;
  description: string;
  body: string;
  schema: Record<string, unknown> | Array<Record<string, unknown>>;
  openGraphType?: 'website' | 'article';
}

const PRESENTATION_PAGE_DETAILS: Record<LanguagePresentation, {
  slug: string;
  title: string;
  heading: string;
  description: string;
  explanation: string;
}> = {
  'English vocal with English words': {
    slug: 'english-worship-videos-with-lyrics',
    title: 'English Worship Videos with Lyrics | Church Finder',
    heading: 'English worship videos with lyrics and words',
    description: 'Find English worship songs and hymns with on-screen lyrics or words for church services, playlists and second-screen projection.',
    explanation: 'The singing and the displayed words are both in English, making these videos a practical starting point for English-speaking congregations.',
  },
  'English vocal with translated subtitles': {
    slug: 'english-worship-translated-subtitles',
    title: 'English Worship Songs with Translated Subtitles',
    heading: 'English worship songs with translated subtitles',
    description: 'Find English-language worship videos with translated subtitles for multilingual churches and congregations where English is a second language.',
    explanation: 'The vocal is in English while the visible subtitles provide another language, helping multilingual congregations follow the meaning of a familiar recording.',
  },
  'Native-language vocal with English subtitles': {
    slug: 'native-worship-english-subtitles',
    title: 'Native-Language Worship with English Subtitles',
    heading: 'Native-language worship videos with English subtitles',
    description: 'Find native-language Christian worship songs with English subtitles for international and multilingual church services.',
    explanation: 'The song is sung in a language other than English and the video identifies English subtitles, helping English-speaking worshippers understand a native-language performance.',
  },
  'Native-language vocal with native words': {
    slug: 'native-language-worship-with-lyrics',
    title: 'Native-Language Worship Videos with Lyrics & Words',
    heading: 'Native-language worship videos with lyrics and words',
    description: 'Explore Christian worship songs sung with on-screen words in their native language for international churches and language-speaking congregations.',
    explanation: 'The vocal and the visible words are in the same native language, supporting congregational singing for fluent speakers.',
  },
  'Bilingual vocal or subtitles': {
    slug: 'bilingual-worship-videos',
    title: 'Bilingual Worship Videos with Lyrics or Subtitles',
    heading: 'Bilingual worship videos with lyrics or subtitles',
    description: 'Find bilingual Christian worship videos that combine two languages in the vocal, lyrics or subtitles for multilingual church services.',
    explanation: 'These videos indicate two languages in the vocal or on-screen presentation and can help a mixed-language congregation participate together.',
  },
  'Words or subtitles indicated': {
    slug: 'worship-videos-with-words-or-subtitles',
    title: 'Worship Videos with Words or Subtitles | Church Finder',
    heading: 'Worship videos with words or subtitles',
    description: 'Search worship and hymn videos whose uploaders indicate lyrics, words or subtitles, with tools for church playlists and projection.',
    explanation: 'The public uploader information indicates words or subtitles, but does not state enough detail for a more specific language-presentation label.',
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function hasPublicWordEvidence(song: WorshipSong): boolean {
  const audit = WORSHIP_VIDEO_AUDIT[song.youtubeId];
  return song.wordsIndicated === true
    || Boolean(song.wordEvidence)
    || videoTitleIndicatesWords(song.title)
    || videoTitleIndicatesWords(audit?.title ?? '');
}

function hasNamedLanguage(song: WorshipSong): boolean {
  return (song.language ?? 'English') !== 'Language not stated';
}

function buildCompactCatalogue(songs: WorshipSong[]) {
  const dictionaryKeys = ['category', 'language', 'region', 'arrangement', 'languagePresentation'] as const;
  const dictionaries = Object.fromEntries(dictionaryKeys.map((key) => [
    key,
    [...new Set(songs.map((song) => song[key]).filter((value): value is string => Boolean(value)))],
  ])) as Record<(typeof dictionaryKeys)[number], string[]>;
  const indexes = Object.fromEntries(dictionaryKeys.map((key) => [
    key,
    new Map(dictionaries[key].map((value, index) => [value, index + 1])),
  ])) as Record<(typeof dictionaryKeys)[number], Map<string, number>>;
  const checkedOn = songs
    .map((song) => song.qualityCheckedOn)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? LAST_MODIFIED;

  const rows = songs.map((song) => {
    const flags = Number(song.wordsIndicated === true)
      | (song.catalogueReview ? 2 : 0)
      | (song.metadataConfidence === 'Uploader-stated' ? 4 : 0);
    return [
      song.id,
      song.title,
      song.artist,
      indexes.category.get(song.category) ?? 0,
      song.youtubeId,
      indexes.language.get(song.language ?? 'English') ?? 0,
      indexes.region.get(song.region ?? '') ?? 0,
      song.englishTitle ?? '',
      song.ccliUkRank ?? 0,
      flags,
      indexes.arrangement.get(song.arrangement ?? '') ?? 0,
      indexes.languagePresentation.get(song.languagePresentation ?? '') ?? 0,
      song.durationSeconds ?? 0,
      song.hymnalReferences?.length ? song.hymnalReferences : 0,
      song.transliteration ?? '',
    ];
  });

  return { version: 2, checkedOn, dictionaries, songs: rows };
}

function starterCatalogue(songs: WorshipSong[], limit = 2500): WorshipSong[] {
  const score = (song: WorshipSong) => (
    (song.catalogueReview ? 5000 : 0)
    + (song.wordsIndicated ? 3500 : 0)
    + (song.metadataConfidence === 'Uploader-stated' ? 1400 : 0)
    + (song.ccliUkRank ? 1200 - Math.min(song.ccliUkRank, 1000) : 0)
    + (hasNamedLanguage(song) ? 250 : 0)
    + (song.languagePresentation?.includes('English subtitles') ? 300 : 0)
  );
  const ranked = [...songs].sort((left, right) => score(right) - score(left) || left.title.localeCompare(right.title));
  const chosen: WorshipSong[] = [];
  const ids = new Set<string>();
  const add = (song: WorshipSong) => {
    if (ids.has(song.youtubeId) || chosen.length >= limit) return;
    ids.add(song.youtubeId);
    chosen.push(song);
  };

  // Put a small, strong sample from every named language in the first response.
  const byLanguage = new Map<string, WorshipSong[]>();
  for (const song of ranked) {
    if (!song.wordsIndicated || !hasNamedLanguage(song)) continue;
    const language = song.language ?? 'English';
    byLanguage.set(language, [...(byLanguage.get(language) ?? []), song]);
  }
  for (const languageSongs of byLanguage.values()) languageSongs.slice(0, 8).forEach(add);
  ranked.filter((song) => song.wordsIndicated).forEach(add);
  ranked.forEach(add);
  return chosen;
}

function canonicalUrl(path: string): string {
  return `${SITE}${path}`;
}

function formatList(items: Array<[string, number]>, limit = 3): string {
  return items.slice(0, limit).map(([label, count]) => `${label} (${count.toLocaleString('en-GB')})`).join(', ');
}

function countBy(songs: WorshipSong[], getValue: (song: WorshipSong) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const song of songs) {
    const value = getValue(song);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function breadcrumbSchema(items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

function pageShell(page: SeoPage): string {
  const url = canonicalUrl(page.path);
  const schemas = Array.isArray(page.schema) ? page.schema : [page.schema];
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE}/#organization`,
        name: 'Worship Word Video',
        url: `${SITE}/`,
        logo: `${SITE}/worship-word-video-logo-512.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        url: `${SITE}/`,
        name: 'Worship Word Video',
        alternateName: ['Worship Word Lyrics', 'Worship Lyric Video Finder', 'Worship Video Word Finder'],
        description: 'A worship word lyrics and lyric-video finder for English-speaking and multilingual churches.',
        inLanguage: 'en-GB',
        publisher: { '@id': `${SITE}/#organization` },
      },
      ...schemas,
    ],
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="${url}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="stylesheet" href="/seo-pages.css">
  <meta property="og:site_name" content="Worship Word Video">
  <meta property="og:type" content="${page.openGraphType ?? 'website'}">
  <meta property="og:locale" content="en_GB">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${url}">
${page.openGraphType === 'article' ? `  <meta property="article:modified_time" content="${LAST_MODIFIED}">` : ''}
  <meta property="og:image" content="${SITE}/og-cover.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Worship Word Video — free worship videos with words for churches">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(page.title)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  <meta name="twitter:image" content="${SITE}/og-cover.png">
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
  <header class="seo-header">
    <a class="seo-brand" href="/"><img src="/favicon.svg" width="42" height="42" alt=""><span>Worship Word Video</span></a>
    <a class="seo-button seo-button--quiet" href="/#main-content">Open the free finder</a>
  </header>
  <main>${page.body}</main>
  <footer class="seo-footer">
    <nav aria-label="Useful links"><a href="/guides/worship-word-lyrics/">Worship word lyrics</a><a href="/songs/">Songs across languages</a><a href="/languages/">Languages</a><a href="/seasons/">Church seasons</a><a href="/formats/">Lyrics & subtitle formats</a><a href="/arrangements/">Worship styles</a><a href="/guides/">Church guides</a><a href="/#main-content">Song finder</a></nav>
    <p>Worship Word Video is a free directory and playlist-planning tool. Videos remain hosted by YouTube and subject to the uploader's and YouTube's terms. Always preview a video and confirm church licensing before public use.</p>
    <p><a href="mailto:stephen@kairoshousing.org.uk?subject=Worship%20Word%20Video%20enquiry">Contact: stephen@kairoshousing.org.uk</a> · <a href="mailto:stephen@kairoshousing.org.uk?subject=Worship%20Word%20Video%20content%20report">Report a content concern</a></p>
  </footer>
</body>
</html>`;
}

function songRows(songs: WorshipSong[], language?: string): string {
  return songs.slice(0, 18).map((song) => {
    const query = new URLSearchParams({ q: song.englishTitle || song.title });
    if (language) query.set('language', language);
    const presentation = inferLanguagePresentation(song);
    return `<li>
      <a href="/?${query.toString()}#main-content"><strong>${escapeHtml(song.title)}</strong></a>
      ${song.englishTitle && song.englishTitle !== song.title ? `<span class="seo-translation">English: ${escapeHtml(song.englishTitle)}</span>` : ''}
      <span>${escapeHtml(song.artist)} · ${escapeHtml(presentation)}</span>
    </li>`;
  }).join('\n');
}

function languagePage(language: string, songs: WorshipSong[], related: string[]): SeoPage {
  const slug = slugify(language);
  const arrangements = countBy(songs, inferWorshipArrangement);
  const presentations = countBy(songs, inferLanguagePresentation);
  const count = songs.length;
  const appQuery = new URLSearchParams({ language });
  const description = `Find ${count.toLocaleString('en-GB')} ${language} Christian worship and hymn videos with lyrics, on-screen words or subtitles. Free church playlist and projection tools.`;
  const examples = songs.slice(0, 18);
  const body = `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/languages/">Languages</a><span>›</span><span>${escapeHtml(language)}</span></nav>
  <article class="seo-hero">
    <p class="seo-eyebrow">Multilingual worship catalogue</p>
    <h1>${escapeHtml(language)} worship videos with words</h1>
    <p class="seo-lead">Explore ${count.toLocaleString('en-GB')} playable Christian worship and hymn videos catalogued for ${escapeHtml(language)}-speaking churches, international congregations and services where English is a second language.</p>
    <div class="seo-actions"><a class="seo-button" href="/?${appQuery.toString()}#main-content">Search all ${escapeHtml(language)} videos</a><a class="seo-button seo-button--quiet" href="/guides/multilingual-worship/">Plan multilingual worship</a></div>
  </article>
  <section class="seo-stats" aria-label="Catalogue summary">
    <div><strong>${count.toLocaleString('en-GB')}</strong><span>playable videos</span></div>
    <div><strong>${arrangements.length}</strong><span>musical styles</span></div>
    <div><strong>${presentations.length}</strong><span>word and subtitle formats</span></div>
  </section>
  <section class="seo-section">
    <h2>What is in the ${escapeHtml(language)} collection?</h2>
    <p>The catalogue includes ${escapeHtml(formatList(arrangements))}. Presentation labels distinguish native-language vocals with native words, English vocals with translated subtitles, native vocals with English subtitles and bilingual versions where the uploader's wording supports that distinction.</p>
    <p>These labels are based on public uploader metadata and conservative catalogue checks. They are a practical starting point, not a linguistic or theological endorsement. Preview the exact video, ask a fluent speaker to review translated words, and confirm the music and streaming permissions used by your church.</p>
  </section>
  <section class="seo-section">
    <h2>Example ${escapeHtml(language)} worship word videos</h2>
    <ul class="seo-song-list">${songRows(examples, language)}</ul>
    <p><a class="seo-text-link" href="/?${appQuery.toString()}#main-content">View the complete filtered catalogue →</a></p>
  </section>
  <section class="seo-section seo-help">
    <h2>Use a video confidently in church</h2>
    <ol><li>Open the filtered finder and preview the exact linked upload.</li><li>Check whether the vocals, on-screen words and subtitles match your congregation.</li><li>Add it to a service playlist and trim silence or spoken introductions.</li><li>Open the clean projection window on the church's second screen.</li></ol>
    <p><a class="seo-text-link" href="/guides/review-multilingual-worship-videos/">Help review this language collection →</a></p>
  </section>
  <section class="seo-section"><h2>Explore other language collections</h2><div class="seo-link-grid">${related.map((item) => `<a href="/languages/${slugify(item)}/">${escapeHtml(item)} worship videos</a>`).join('')}</div></section>`;

  return {
    path: `/languages/${slug}/`,
    title: language.length > 20
      ? `${language} Worship Videos | Lyrics`
      : `${language} Worship Songs with Lyrics | Church Videos`,
    description,
    body,
    schema: [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE}/languages/${slug}/#page`,
        url: `${SITE}/languages/${slug}/`,
        name: `${language} worship videos with words`,
        description,
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'en-GB',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: count,
          itemListElement: examples.map((song, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: song.englishTitle ? `${song.title} (${song.englishTitle})` : song.title,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Languages', item: `${SITE}/languages/` },
          { '@type': 'ListItem', position: 3, name: language, item: `${SITE}/languages/${slug}/` },
        ],
      },
    ],
  };
}

function arrangementPage(arrangement: string, songs: WorshipSong[]): SeoPage {
  const slug = slugify(arrangement);
  const titleLabel = arrangement.replace(/\s+worship$/i, '');
  const languages = countBy(songs, (song) => song.language ?? 'English');
  const count = songs.length;
  const query = new URLSearchParams({ arrangement });
  const description = `Find ${count.toLocaleString('en-GB')} ${arrangement.toLowerCase()} worship and hymn videos with on-screen words or subtitles. Build and project a free church playlist.`;
  const body = `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/arrangements/">Worship styles</a><span>›</span><span>${escapeHtml(arrangement)}</span></nav>
  <article class="seo-hero"><p class="seo-eyebrow">Worship style collection</p><h1>${escapeHtml(arrangement)} videos with words</h1><p class="seo-lead">Search ${count.toLocaleString('en-GB')} playable ${escapeHtml(arrangement.toLowerCase())} videos selected for church use, with lyrics, words or subtitles indicated by the uploader.</p><div class="seo-actions"><a class="seo-button" href="/?${query.toString()}#main-content">Open this collection</a><a class="seo-button seo-button--quiet" href="/guides/church-youtube-lyric-videos/">Video selection guide</a></div></article>
  <section class="seo-stats"><div><strong>${count.toLocaleString('en-GB')}</strong><span>playable videos</span></div><div><strong>${languages.length}</strong><span>language labels</span></div><div><strong>Free</strong><span>playlist planning</span></div></section>
  <section class="seo-section"><h2>Languages represented</h2><p>${escapeHtml(formatList(languages, 8))}.</p><p>Arrangement labels are taken from uploader wording where possible and otherwise conservatively inferred from titles and catalogue metadata. Preview every video to confirm that the performance style suits your service.</p></section>
  <section class="seo-section"><h2>Examples in this collection</h2><ul class="seo-song-list">${songRows(songs)}</ul><p><a class="seo-text-link" href="/?${query.toString()}#main-content">Search the full ${escapeHtml(arrangement.toLowerCase())} collection →</a></p></section>`;
  return {
    path: `/arrangements/${slug}/`,
    title: `${titleLabel} Worship Videos with Lyrics | Churches`,
    description,
    body,
    schema: [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE}/arrangements/${slug}/#page`,
        url: `${SITE}/arrangements/${slug}/`,
        name: `${arrangement} worship videos with words`,
        description,
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'en-GB',
      },
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Worship styles', path: '/arrangements/' },
        { name: arrangement, path: `/arrangements/${slug}/` },
      ]),
    ],
  };
}

function seasonPage(season: WorshipSeason, songs: WorshipSong[]): SeoPage {
  const slug = slugify(season);
  const count = songs.length;
  const languages = countBy(songs, (song) => song.language ?? 'English');
  const arrangements = countBy(songs, inferWorshipArrangement);
  const query = new URLSearchParams({ season });
  const title = `${season} Worship Songs with Lyrics | Churches`;
  const description = `Find ${count.toLocaleString('en-GB')} ${season} worship songs and hymns with on-screen lyrics, words or subtitles for church services and projection.`;
  const examples = songs.slice(0, 18);
  const body = `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/seasons/">Church seasons</a><span>›</span><span>${escapeHtml(season)}</span></nav>
  <article class="seo-hero"><p class="seo-eyebrow">Seasonal church worship</p><h1>${escapeHtml(season)} worship songs with lyrics and words</h1><p class="seo-lead">Explore ${count.toLocaleString('en-GB')} playable worship and hymn videos associated with ${escapeHtml(season)}, with on-screen lyrics, words or subtitles indicated in the catalogue.</p><div class="seo-actions"><a class="seo-button" href="/?${query.toString()}#main-content">Search ${escapeHtml(season)} videos</a><a class="seo-button seo-button--quiet" href="/guides/church-youtube-lyric-videos/">Preview checklist</a></div></article>
  <section class="seo-stats"><div><strong>${count.toLocaleString('en-GB')}</strong><span>playable videos</span></div><div><strong>${languages.length}</strong><span>language labels</span></div><div><strong>${arrangements.length}</strong><span>musical arrangements</span></div></section>
  <section class="seo-section"><h2>Plan ${escapeHtml(season)} worship</h2><p>Use this collection to begin a service plan, then preview the exact recording for theology, verse order, key, tempo, audio quality and readable word timing. Seasonal labels are inferred conservatively from song titles, familiar hymn names and public catalogue metadata.</p><p>The collection includes ${escapeHtml(formatList(arrangements, 5))}. Languages represented include ${escapeHtml(formatList(languages, 6))}.</p></section>
  <section class="seo-section"><h2>Example ${escapeHtml(season)} worship lyric videos</h2><ul class="seo-song-list">${songRows(examples)}</ul><p><a class="seo-text-link" href="/?${query.toString()}#main-content">Open the complete ${escapeHtml(season)} collection →</a></p></section>
  <section class="seo-section seo-help"><h2>Prepare it for church</h2><ol><li>Preview the complete video and check the visible words.</li><li>Confirm that the arrangement and language suit your congregation.</li><li>Members can save the running order and tidy any silent beginning or ending.</li><li>Rehearse the service using the same internet connection and projection screen.</li></ol></section>`;
  return {
    path: `/seasons/${slug}/`,
    title,
    description,
    body,
    schema: [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE}/seasons/${slug}/#page`,
        url: `${SITE}/seasons/${slug}/`,
        name: `${season} worship songs with lyrics and words`,
        description,
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'en-GB',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: count,
          itemListElement: examples.map((song, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: song.englishTitle ? `${song.title} (${song.englishTitle})` : song.title,
          })),
        },
      },
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Church seasons', path: '/seasons/' },
        { name: season, path: `/seasons/${slug}/` },
      ]),
    ],
  };
}

function presentationPage(presentation: LanguagePresentation, songs: WorshipSong[]): SeoPage {
  const details = PRESENTATION_PAGE_DETAILS[presentation];
  const count = songs.length;
  const languages = countBy(songs, (song) => song.language ?? 'English');
  const arrangements = countBy(songs, inferWorshipArrangement);
  const query = new URLSearchParams({ presentation });
  const examples = songs.slice(0, 18);
  const body = `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/formats/">Lyrics & subtitle formats</a><span>›</span><span>${escapeHtml(presentation)}</span></nav>
  <article class="seo-hero"><p class="seo-eyebrow">Words and language format</p><h1>${escapeHtml(details.heading)}</h1><p class="seo-lead">${escapeHtml(details.explanation)} Search ${count.toLocaleString('en-GB')} playable catalogue entries in this format.</p><div class="seo-actions"><a class="seo-button" href="/?${query.toString()}#main-content">Search this format</a><a class="seo-button seo-button--quiet" href="/guides/multilingual-worship/">Multilingual worship guide</a></div></article>
  <section class="seo-stats"><div><strong>${count.toLocaleString('en-GB')}</strong><span>playable videos</span></div><div><strong>${languages.length}</strong><span>language labels</span></div><div><strong>${arrangements.length}</strong><span>musical arrangements</span></div></section>
  <section class="seo-section"><h2>What this format label means</h2><p>${escapeHtml(details.explanation)} Labels are based on public uploader wording and conservative catalogue checks. Preview the exact video and ask a fluent speaker to review translated words before using it in public worship.</p><p>Languages represented include ${escapeHtml(formatList(languages, 8))}. Common arrangements include ${escapeHtml(formatList(arrangements, 5))}.</p></section>
  <section class="seo-section"><h2>Example worship videos in this format</h2><ul class="seo-song-list">${songRows(examples)}</ul><p><a class="seo-text-link" href="/?${query.toString()}#main-content">Search all ${count.toLocaleString('en-GB')} matching videos →</a></p></section>
  <section class="seo-section seo-help"><h2>Check before your service</h2><p>Catalogue wording helps narrow a large YouTube search, but it is not a guarantee of translation accuracy, theology, video availability or permission for public use. Watch the complete upload and confirm the licences needed by your church.</p></section>`;
  return {
    path: `/formats/${details.slug}/`,
    title: details.title,
    description: details.description,
    body,
    schema: [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE}/formats/${details.slug}/#page`,
        url: `${SITE}/formats/${details.slug}/`,
        name: details.heading,
        description: details.description,
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'en-GB',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: count,
          itemListElement: examples.map((song, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: song.englishTitle ? `${song.title} (${song.englishTitle})` : song.title,
          })),
        },
      },
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Lyrics and subtitle formats', path: '/formats/' },
        { name: presentation, path: `/formats/${details.slug}/` },
      ]),
    ],
  };
}

function songFamilyPage(family: SongFamilyDefinition, songs: WorshipSong[]): SeoPage {
  const orderedSongs = [...songs].sort((left, right) => {
    const languageOrder = (left.language ?? 'English').localeCompare(right.language ?? 'English');
    return languageOrder || (right.viewCountAtReview ?? 0) - (left.viewCountAtReview ?? 0);
  });
  const languageGroups = new Map<string, WorshipSong[]>();
  for (const song of orderedSongs) {
    const language = song.language ?? 'English';
    languageGroups.set(language, [...(languageGroups.get(language) ?? []), song]);
  }
  const languages = [...languageGroups.entries()].sort((left, right) => {
    if (left[0] === 'English') return -1;
    if (right[0] === 'English') return 1;
    return right[1].length - left[1].length || left[0].localeCompare(right[0]);
  });
  const count = songs.length;
  const presentationFormatCount = new Set(songs.map(inferLanguagePresentation)).size;
  const query = new URLSearchParams({ q: family.title });
  const description = `Find ${family.title} in ${languages.length} languages, with lyric, subtitle and translated worship videos for multilingual church services.`;
  const fullPageTitle = `${family.title} in Different Languages | Worship Videos`;
  const pageTitle = fullPageTitle.length <= 65
    ? fullPageTitle
    : `${family.title} Languages | Worship Videos`;
  const languageCards = languages.map(([language, languageSongs]) => {
    const languageQuery = new URLSearchParams({ q: family.title, language });
    const formats = countBy(languageSongs, inferLanguagePresentation);
    return `<a class="seo-card" href="/?${languageQuery.toString()}#main-content"><strong>${escapeHtml(language)}</strong><span>${languageSongs.length.toLocaleString('en-GB')} playable ${languageSongs.length === 1 ? 'version' : 'versions'} · ${escapeHtml(formatList(formats, 2))}</span></a>`;
  }).join('');
  const body = `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/songs/">Songs across languages</a><span>›</span><span>${escapeHtml(family.title)}</span></nav>
  <article class="seo-hero"><p class="seo-eyebrow">Well-known worship across languages</p><h1>${escapeHtml(family.title)} in different languages</h1><p class="seo-lead">Compare ${count.toLocaleString('en-GB')} playable versions across ${languages.length.toLocaleString('en-GB')} languages. Use the language and presentation labels to distinguish native-language vocals, translated subtitles, English subtitles and bilingual versions where the uploader's metadata supports that description.</p><div class="seo-actions"><a class="seo-button" href="/?${query.toString()}#main-content">Search every ${escapeHtml(family.title)} video</a><a class="seo-button seo-button--quiet" href="/formats/">Understand lyrics and subtitle labels</a></div></article>
  <section class="seo-stats"><div><strong>${count.toLocaleString('en-GB')}</strong><span>playable word videos</span></div><div><strong>${languages.length.toLocaleString('en-GB')}</strong><span>languages represented</span></div><div><strong>${presentationFormatCount.toLocaleString('en-GB')}</strong><span>lyrics and subtitle formats</span></div></section>
  <section class="seo-section"><h2>Choose a language version</h2><div class="seo-card-grid">${languageCards}</div></section>
  <section class="seo-section"><h2>Example ${escapeHtml(family.title)} lyric and subtitle videos</h2><ul class="seo-song-list">${songRows(orderedSongs)}</ul><p><a class="seo-text-link" href="/?${query.toString()}#main-content">Open all ${count.toLocaleString('en-GB')} matching videos in the finder →</a></p></section>
  <section class="seo-section seo-help"><h2>Check the exact version before church</h2><p>These are links to public YouTube uploads, not copies of the song or lyrics. A familiar English title can refer to a translation, adaptation, cover or subtitled original. Preview the complete video, ask a fluent speaker to review translated words and theology, and confirm the licences needed for your service.</p></section>`;
  return {
    path: `/songs/${family.slug}/`,
    title: pageTitle,
    description,
    body,
    schema: [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE}/songs/${family.slug}/#page`,
        url: `${SITE}/songs/${family.slug}/`,
        name: `${family.title} in different languages`,
        description,
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'en-GB',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: count,
          itemListElement: orderedSongs.slice(0, 30).map((song, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: `${song.title} — ${song.language ?? 'English'}`,
          })),
        },
      },
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Songs across languages', path: '/songs/' },
        { name: family.title, path: `/songs/${family.slug}/` },
      ]),
    ],
  };
}

const GUIDE_PAGES: SeoPage[] = [
  {
    path: '/guides/worship-word-lyrics/',
    title: 'Worship Word Lyrics Videos for Churches | Free Finder',
    description: 'Find worship word lyrics videos, hymns with lyrics and multilingual worship songs with subtitles for church services, playlists and projection.',
    openGraphType: 'article',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/guides/">Guides</a><span>›</span><span>Worship word lyrics</span></nav><article class="seo-hero"><p class="seo-eyebrow">Church worship video finder</p><h1>Find worship word lyrics videos for church services</h1><p class="seo-lead">Search public YouTube worship videos that show the words people need to sing. The catalogue brings together English worship songs, traditional hymns and multilingual videos with on-screen lyrics or subtitles, without copying or republishing the lyrics.</p><div class="seo-actions"><a class="seo-button" href="/#main-content">Search worship videos</a><a class="seo-button seo-button--quiet" href="/languages/english/">Browse English worship videos</a></div></article><section class="seo-section"><h2>What are worship word lyrics videos?</h2><p>Church leaders use several names for the same practical resource: worship lyric videos, worship songs with words, YouTube worship videos with lyrics and church sing-along videos. Worship Word Video helps people find the original public uploads and compare whether an uploader identifies on-screen words, native-language lyrics, English subtitles or a bilingual presentation.</p><p>This is especially useful for churches without musicians every week, small congregations and service leaders who would otherwise spend hours opening unrelated YouTube results.</p></section><section class="seo-section"><h2>Search by song, hymn, language or worship style</h2><div class="seo-card-grid"><a class="seo-card" href="/arrangements/contemporary-worship/"><strong>Contemporary worship lyric videos</strong><span>Modern worship songs and familiar church music with words.</span></a><a class="seo-card" href="/arrangements/traditional-hymn/"><strong>Traditional hymns with lyrics</strong><span>Classic hymn videos prepared for congregational singing.</span></a><a class="seo-card" href="/arrangements/gospel/"><strong>Gospel worship videos</strong><span>Gospel praise and worship arrangements with words indicated.</span></a><a class="seo-card" href="/languages/"><strong>Multilingual worship songs</strong><span>Native words, English translations, subtitles and bilingual formats.</span></a></div></section><section class="seo-section"><h2>Prepare the video for a church service</h2><ol><li>Search the song title, artist, hymn number or language.</li><li>Preview the exact YouTube upload and check every visible word, verse and subtitle.</li><li>Choose an arrangement, key and tempo that your congregation can sing.</li><li>Members can place videos in a saved service order and set clean start or stop points.</li><li>Use the separate projection screen so the congregation sees the video while the operator keeps the controls.</li></ol><p><a class="seo-text-link" href="/guides/church-youtube-lyric-videos/">Read the accuracy, suitability and church-licensing checklist →</a></p></section><section class="seo-section"><h2>English and multilingual worship</h2><p>The finder supports English-speaking churches as well as international congregations and churches where English is a second language. Presentation labels help distinguish native-language vocals with native words, English vocals with translated subtitles, native vocals with English subtitles and bilingual versions where the public uploader information supports that description.</p><p>Always ask a fluent speaker or trusted church leader to review translated words and theology before public use. A catalogue label helps narrow the search; it is not a linguistic or theological endorsement.</p><p><a class="seo-text-link" href="/guides/multilingual-worship/">Plan a clear, welcoming multilingual service →</a></p></section><section class="seo-section"><h2>Copyright and video availability</h2><p>Worship Word Video is a search and playlist-planning directory. It does not host recordings, download videos or reproduce song lyrics. Videos remain on YouTube and may be changed, restricted or removed by their uploaders. Churches should preview each video and confirm the music, words, performance, projection and streaming permissions needed for their own service.</p></section>`,
    schema: [
      {
        '@type': 'Article',
        '@id': `${SITE}/guides/worship-word-lyrics/#article`,
        headline: 'Find worship word lyrics videos for church services',
        description: 'A practical guide to finding worship lyric videos, hymns with lyrics and multilingual worship songs with subtitles for church services.',
        mainEntityOfPage: `${SITE}/guides/worship-word-lyrics/`,
        datePublished: LAST_MODIFIED,
        dateModified: LAST_MODIFIED,
        image: `${SITE}/og-cover.png`,
        author: { '@id': `${SITE}/#organization` },
        publisher: { '@id': `${SITE}/#organization` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE}/guides/` },
          { '@type': 'ListItem', position: 3, name: 'Worship word lyrics', item: `${SITE}/guides/worship-word-lyrics/` },
        ],
      },
    ],
  },
  {
    path: '/guides/worship-videos-for-churches-without-musicians/',
    title: 'Worship Videos for Churches Without Musicians | Guide',
    description: 'A practical guide to finding worship lyric videos, building a service playlist and projecting words when a church has no musicians available.',
    openGraphType: 'article',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/guides/">Guides</a><span>›</span><span>Churches without musicians</span></nav><article class="seo-hero"><p class="seo-eyebrow">Practical help for local churches</p><h1>Worship videos for churches without musicians</h1><p class="seo-lead">A small church, midweek gathering or occasional service can still help people sing together when no pianist, organist or worship band is available. A carefully checked worship lyric video provides the music and the words in one simple resource.</p><div class="seo-actions"><a class="seo-button" href="/#main-content">Find a worship video</a><a class="seo-button seo-button--quiet" href="/guides/worship-word-lyrics/">Worship lyrics guide</a></div></article><section class="seo-section"><h2>A simple service workflow</h2><ol><li>Choose familiar songs that fit the congregation, theme and season.</li><li>Find videos with clear on-screen words and an arrangement people can comfortably sing.</li><li>Watch every video completely, checking spelling, verse order, theology, audio and distracting introductions.</li><li>Create a named service playlist, place songs in running order and set any useful start or stop points.</li><li>Connect the church display in extended-screen mode and rehearse the complete service.</li></ol></section><section class="seo-section"><h2>Choose congregational versions</h2><p>A polished performance video is not always easy for a congregation to follow. Prefer a steady tempo, singable key, clear lead vocal and predictable structure. Look for uploader wording such as “official lyric video”, “with lyrics”, “with words”, “karaoke” or “sing along”, but treat these as clues rather than guarantees.</p><div class="seo-card-grid"><a class="seo-card" href="/formats/english-worship-videos-with-lyrics/"><strong>English worship videos with lyrics</strong><span>English vocals and on-screen English words.</span></a><a class="seo-card" href="/arrangements/traditional-hymn/"><strong>Traditional hymns with words</strong><span>Familiar hymns and congregational arrangements.</span></a><a class="seo-card" href="/seasons/"><strong>Church-season worship</strong><span>Advent, Christmas, Lent, Easter and more.</span></a></div></section><section class="seo-section"><h2>Make projection reliable</h2><p>Use the separate church-screen window so the congregation sees only the video while the operator keeps the playlist controls. Turn off notifications, connect power and sound, use wired internet where practical and test autoplay behaviour. Keep a simple backup because a third-party YouTube upload can be changed or removed.</p><p><a class="seo-text-link" href="/guides/second-screen-church-projection/">Follow the second-screen projection guide →</a></p></section><section class="seo-section"><h2>Words, copyright and permissions</h2><p>Worship Word Video links to public YouTube uploads; it does not copy song lyrics or host recordings. The presence of a video on YouTube does not by itself grant every permission a church may need. Confirm the music, performance, projection, recording and streaming licences relevant to your country and service.</p><p><a class="seo-text-link" href="/guides/church-youtube-lyric-videos/">Use the complete video-selection and licensing checklist →</a></p></section>`,
    schema: [
      {
        '@type': 'Article',
        '@id': `${SITE}/guides/worship-videos-for-churches-without-musicians/#article`,
        headline: 'Worship videos for churches without musicians',
        description: 'A practical workflow for finding, checking, arranging and projecting worship lyric videos when a church has no musicians available.',
        mainEntityOfPage: `${SITE}/guides/worship-videos-for-churches-without-musicians/`,
        datePublished: LAST_MODIFIED,
        dateModified: LAST_MODIFIED,
        image: `${SITE}/og-cover.png`,
        author: { '@id': `${SITE}/#organization` },
        publisher: { '@id': `${SITE}/#organization` },
      },
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Guides', path: '/guides/' },
        { name: 'Churches without musicians', path: '/guides/worship-videos-for-churches-without-musicians/' },
      ]),
    ],
  },
  {
    path: '/guides/church-youtube-lyric-videos/',
    title: 'How to Choose YouTube Lyric Videos for Church Worship',
    description: 'A practical checklist for choosing clear, suitable and legally responsible YouTube worship videos with words for a church service.',
    openGraphType: 'article',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/guides/">Guides</a><span>›</span><span>Choosing word videos</span></nav><article class="seo-hero"><p class="seo-eyebrow">Practical church guide</p><h1>How to choose YouTube lyric videos for church worship</h1><p class="seo-lead">A clear on-screen-words video can help a congregation sing, but the title “lyrics” alone does not guarantee accuracy, suitability or permission for public use.</p><a class="seo-button" href="/#main-content">Open the free video finder</a></article><section class="seo-section"><h2>A five-point preview check</h2><ol><li><strong>Words:</strong> watch the whole video and check spelling, verse order and theological suitability.</li><li><strong>Audio:</strong> confirm the key, tempo, arrangement and recording quality work for congregational singing.</li><li><strong>Presentation:</strong> look for readable contrast, sensible timing and no distracting introductions, adverts or end screens.</li><li><strong>Language:</strong> for translations, ask a fluent speaker or trusted church leader to review both meaning and theology.</li><li><strong>Permissions:</strong> confirm the licences and permissions appropriate to your church, country, stream and venue.</li></ol></section><section class="seo-section"><h2>Prepare a clean service playlist</h2><p>Add chosen videos in service order. Use the start and stop fields to remove silence or spoken sections, then rehearse the whole sequence on the actual church internet connection and projection equipment. YouTube timing starts near a video keyframe, so allow a small margin rather than relying on frame-perfect cuts.</p><p>Keep a backup plan. Third-party uploads can be removed, made private, geo-blocked or interrupted by platform changes.</p></section><section class="seo-section"><h2>What Worship Word Video does</h2><p>The finder indexes public YouTube links and useful metadata; it does not host recordings or reproduce song lyrics. It provides search, playlist planning, timing and a clean second-screen projection window. The church remains responsible for previewing content and meeting its licensing duties.</p></section>`,
    schema: [
      { '@type': 'Article', '@id': `${SITE}/guides/church-youtube-lyric-videos/#article`, headline: 'How to choose YouTube lyric videos for church worship', mainEntityOfPage: `${SITE}/guides/church-youtube-lyric-videos/`, datePublished: '2026-08-09', dateModified: LAST_MODIFIED, image: `${SITE}/og-cover.png`, author: { '@id': `${SITE}/#organization` }, publisher: { '@id': `${SITE}/#organization` } },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides/' }, { name: 'Choosing word videos', path: '/guides/church-youtube-lyric-videos/' }]),
    ],
  },
  {
    path: '/guides/multilingual-worship/',
    title: 'Planning Multilingual Worship with Lyrics and Subtitles',
    description: 'Practical guidance for finding, checking and presenting worship songs in Farsi, Urdu, Portuguese, African and other languages.',
    openGraphType: 'article',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/guides/">Guides</a><span>›</span><span>Multilingual worship</span></nav><article class="seo-hero"><p class="seo-eyebrow">Inclusive worship guide</p><h1>Planning multilingual worship with lyrics and subtitles</h1><p class="seo-lead">Multilingual worship is strongest when people can understand what they hear, read and sing—not simply when another language appears on screen.</p><a class="seo-button" href="/languages/">Explore language collections</a></article><section class="seo-section"><h2>Choose the right presentation format</h2><p>An English vocal with translated subtitles helps readers follow meaning while hearing a familiar recording. A native-language vocal with English subtitles helps an English-speaking congregation understand a local-language performance. Native vocals with native words support confident singing for fluent speakers. Bilingual videos can help a mixed congregation participate together.</p><p>Worship Word Video labels these formats separately where uploader metadata supports the distinction, so leaders can filter before previewing.</p></section><section class="seo-section"><h2>Review with people, not just software</h2><ol><li>Ask a fluent speaker to verify the visible words and natural phrasing.</li><li>Ask a trusted church leader to review theology and cultural context.</li><li>Check whether the song is a translation, adaptation or different composition with a similar title.</li><li>Rehearse transitions and explain unfamiliar language briefly and respectfully.</li></ol></section><section class="seo-section"><h2>Make participation easy</h2><p>Introduce one clear congregational response, chorus or repeated line rather than overwhelming people. Use readable subtitles, explain which language will be sung and make the English meaning available where helpful. Preview the exact video because public metadata can be incomplete or mistaken.</p></section>`,
    schema: [
      { '@type': 'Article', '@id': `${SITE}/guides/multilingual-worship/#article`, headline: 'Planning multilingual worship with lyrics and subtitles', mainEntityOfPage: `${SITE}/guides/multilingual-worship/`, datePublished: '2026-08-09', dateModified: LAST_MODIFIED, image: `${SITE}/og-cover.png`, author: { '@id': `${SITE}/#organization` }, publisher: { '@id': `${SITE}/#organization` } },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides/' }, { name: 'Multilingual worship', path: '/guides/multilingual-worship/' }]),
    ],
  },
  {
    path: '/guides/second-screen-church-projection/',
    title: 'Simple Second-Screen YouTube Projection for Churches',
    description: 'How to run a church worship playlist on a projector or second monitor while keeping the control dashboard private.',
    openGraphType: 'article',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/guides/">Guides</a><span>›</span><span>Second-screen projection</span></nav><article class="seo-hero"><p class="seo-eyebrow">Church technology guide</p><h1>Simple second-screen YouTube projection for churches</h1><p class="seo-lead">Keep service controls on the operator's laptop while the congregation sees only the worship video.</p><a class="seo-button" href="/#main-content">Build a service playlist</a></article><section class="seo-section"><h2>Basic setup</h2><ol><li>Connect the projector, television or second monitor and choose “Extend”, not “Mirror”, in Windows or macOS display settings.</li><li>Build the service playlist and set any start or stop points.</li><li>Select <strong>Present on second screen</strong>, confirm the display is connected and let the app create a separate clean presentation window.</li><li>On the church screen, select <strong>Full screen and start</strong> or press Enter. Where screen placement is supported, the app puts this window on the second display automatically.</li></ol></section><section class="seo-section"><h2>During the service</h2><p>Previous, Restart, Next and Stop remain private on the operator's dashboard. Optional <strong>Auto-next</strong> can start each following video when the current one finishes; it is deliberately off by default.</p></section><section class="seo-section"><h2>Before the service</h2><p>Test sound routing, screen resolution, Wi-Fi, autoplay behaviour and every video. Keep the laptop connected to power and turn off notifications. A wired network connection is preferable where available.</p><p>The projection window synchronises the selected playlist item and its start/stop timing with the dashboard. If the browser cannot place windows automatically, only the small clean presentation window needs to be moved to the church display before full screen is selected.</p></section>`,
    schema: [
      { '@type': 'HowTo', '@id': `${SITE}/guides/second-screen-church-projection/#howto`, name: 'Simple second-screen YouTube projection for churches', description: 'Open a clean church projection window while keeping playlist controls private.', image: `${SITE}/og-cover.png`, step: ['Connect and extend the second display', 'Build the service playlist', 'Open the clean church-screen window', 'Confirm full screen and start the service'].map((text, index) => ({ '@type': 'HowToStep', position: index + 1, text })) },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides/' }, { name: 'Second-screen projection', path: '/guides/second-screen-church-projection/' }]),
    ],
  },
  {
    path: '/guides/review-multilingual-worship-videos/',
    title: 'Help Review Multilingual Worship Videos | Churches',
    description: 'A careful review process for fluent speakers and church leaders checking multilingual worship videos, translations, subtitles and catalogue labels.',
    openGraphType: 'article',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/guides/">Guides</a><span>›</span><span>Language review</span></nav><article class="seo-hero"><p class="seo-eyebrow">Catalogue quality</p><h1>Help review multilingual worship videos</h1><p class="seo-lead">Automated checks can confirm a public video link and read uploader metadata, but only people can judge whether the language, translation, theology and cultural context are suitable for worship.</p><div class="seo-actions"><a class="seo-button" href="/languages/">Choose a language collection</a><a class="seo-button seo-button--quiet" href="mailto:stephen@kairoshousing.org.uk?subject=Worship%20Word%20Video%20language%20review">Volunteer to review</a></div></article><section class="seo-section"><h2>Who should review?</h2><p>A useful review normally combines a fluent or native speaker with a trusted church or worship leader. Fluency helps with spelling, natural phrasing and subtitle meaning; church experience helps with theology, denominational context and whether the arrangement is practical for congregational singing.</p></section><section class="seo-section"><h2>A clear review checklist</h2><ol><li>Record the exact Worship Word Video page and YouTube URL so the correct upload is reviewed.</li><li>Watch the complete video, including introductions, spoken sections and ending screens.</li><li>Identify the sung language and the language of any visible words or subtitles separately.</li><li>Check whether it is a translation of the familiar song, an adaptation, or a different song with a similar title.</li><li>Check spelling, meaning, verse order, theology, readable timing, sound quality and suitability for congregational singing.</li><li>Report any concern without copying full copyrighted lyrics into the message.</li></ol></section><section class="seo-section"><h2>How review credits will work</h2><p>A reviewer can choose whether to be credited by name, church or organisation. No credit will be published without permission. A review describes the exact video and date checked; it does not guarantee that a third-party upload will remain unchanged or available.</p><p><a class="seo-text-link" href="mailto:stephen@kairoshousing.org.uk?subject=Worship%20Word%20Video%20language%20review">Contact Worship Word Video about a language review →</a></p></section><section class="seo-section seo-help"><h2>What the catalogue currently means</h2><p>“Words indicated” means public uploader wording or maintained catalogue metadata signals lyrics, words or subtitles. It is not the same as a fluent-language review. Churches should continue to preview every exact upload before public use and confirm their own music, projection and streaming permissions.</p></section>`,
    schema: [
      { '@type': 'Article', '@id': `${SITE}/guides/review-multilingual-worship-videos/#article`, headline: 'Help review multilingual worship videos', description: 'A practical review process for fluent speakers and church leaders checking multilingual worship videos.', mainEntityOfPage: `${SITE}/guides/review-multilingual-worship-videos/`, datePublished: LAST_MODIFIED, dateModified: LAST_MODIFIED, image: `${SITE}/og-cover.png`, author: { '@id': `${SITE}/#organization` }, publisher: { '@id': `${SITE}/#organization` } },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides/' }, { name: 'Language review', path: '/guides/review-multilingual-worship-videos/' }]),
    ],
  },
];

async function writePage(page: SeoPage): Promise<void> {
  const directory = resolve(PUBLIC_DIR, page.path.replace(/^\//, ''));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'index.html'), pageShell(page), 'utf8');
}

async function removeStaleGeneratedDirectories(parent: string, expectedNames: Set<string>): Promise<void> {
  const directory = resolve(PUBLIC_DIR, parent);
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && !expectedNames.has(entry.name))
    .map((entry) => rm(resolve(directory, entry.name), { recursive: true, force: true })));
}

async function removeDuplicateIndexFiles(parent: string): Promise<void> {
  const directory = resolve(PUBLIC_DIR, parent);
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isFile() && /^index \d+\.html$/.test(entry.name))
    .map((entry) => rm(resolve(directory, entry.name), { force: true })));
}

async function generate(): Promise<void> {
  const playableSongs = getFullSongLibrary()
    .filter((song) => Boolean(song.youtubeId))
    .map(canonicaliseSongLanguage);
  const publicSongs = playableSongs.map((song) => ({
    ...song,
    wordsIndicated: hasPublicWordEvidence(song),
    catalogueReview: song.catalogueReview ?? (WORSHIP_VIDEO_AUDIT[song.youtubeId] && hasPublicWordEvidence(song)
      ? 'Word evidence and embed checked'
      : undefined),
    qualityCheckedOn: song.qualityCheckedOn ?? WORSHIP_VIDEO_AUDIT[song.youtubeId]?.auditedAt,
  }));
  await mkdir(resolve(PUBLIC_DIR, 'catalogue'), { recursive: true });
  await writeFile(
    resolve(PUBLIC_DIR, 'catalogue', 'worship-songs.json'),
    JSON.stringify(buildCompactCatalogue(publicSongs)),
    'utf8',
  );
  await writeFile(
    resolve(PUBLIC_DIR, 'catalogue', 'worship-songs-starter.json'),
    JSON.stringify(buildCompactCatalogue(starterCatalogue(publicSongs))),
    'utf8',
  );
  const uniquePlayableVideos = new Set(playableSongs.map((song) => song.youtubeId)).size;
  const namedLanguageCount = new Set(
    playableSongs
      .map((song) => song.language ?? 'English')
      .filter((language) => language !== 'Language not stated'),
  ).size;
  const languageGroups = new Map<string, WorshipSong[]>();
  const arrangementGroups = new Map<string, WorshipSong[]>();
  for (const song of playableSongs) {
    const language = song.language ?? 'English';
    languageGroups.set(language, [...(languageGroups.get(language) ?? []), song]);
    const arrangement = inferWorshipArrangement(song);
    arrangementGroups.set(arrangement, [...(arrangementGroups.get(arrangement) ?? []), song]);
  }

  const languages = [...languageGroups.entries()]
    .filter(([language, songs]) => language !== 'Language not stated' && songs.length >= MIN_LANGUAGE_PAGE_VIDEOS)
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]));
  const languageNames = languages.map(([language]) => language);
  const languagePages = languages.map(([language, songs], index) => {
    const related = Array.from({ length: Math.min(8, Math.max(0, languageNames.length - 1)) }, (_, offset) => languageNames[(index + offset + 1) % languageNames.length]);
    return languagePage(language, songs, related);
  });

  const arrangements = [...arrangementGroups.entries()]
    .filter(([arrangement]) => arrangement !== 'Arrangement not stated')
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]));
  const arrangementPages = arrangements.map(([arrangement, songs]) => arrangementPage(arrangement, songs));

  const seasons = WORSHIP_SEASONS
    .map((season) => [season, playableSongs.filter((song) => inferWorshipSeasons(song).includes(season))] as const)
    .filter(([, songs]) => songs.length >= 3);
  const seasonPages = seasons.map(([season, songs]) => seasonPage(season, songs));

  const presentations = LANGUAGE_PRESENTATIONS
    .map((presentation) => [presentation, playableSongs.filter((song) => inferLanguagePresentation(song) === presentation)] as const)
    .filter(([, songs]) => songs.length >= 3);
  const presentationPages = presentations.map(([presentation, songs]) => presentationPage(presentation, songs));

  const songFamilies = SONG_FAMILIES
    .map((family) => [family, playableSongs.filter((song) => songBelongsToFamily(song, family) && hasPublicWordEvidence(song) && hasNamedLanguage(song))] as const)
    .filter(([, songs]) => new Set(songs.map((song) => song.language ?? 'English')).size >= 3);
  const songFamilyPages = songFamilies.map(([family, songs]) => songFamilyPage(family, songs));

  const languageIndex: SeoPage = {
    path: '/languages/',
    title: 'Worship Videos by Language | International Church Finder',
    description: `Explore worship and hymn videos with words across ${languagePages.length} substantial language collections for international and multilingual churches.`,
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>Languages</span></nav><article class="seo-hero"><p class="seo-eyebrow">International worship</p><h1>Worship videos by language</h1><p class="seo-lead">Browse ${languagePages.length} language collections with playable Christian worship and hymn videos. Each page explains the available vocal, lyrics and subtitle formats and links into the free filtered finder.</p><a class="seo-button" href="/#main-content">Search the complete catalogue</a></article><section class="seo-section"><div class="seo-card-grid">${languages.map(([language, songs]) => `<a class="seo-card" href="/languages/${slugify(language)}/"><strong>${escapeHtml(language)}</strong><span>${songs.length.toLocaleString('en-GB')} playable videos</span></a>`).join('')}</div></section>`,
    schema: [
      { '@type': 'CollectionPage', name: 'Worship videos by language', url: `${SITE}/languages/`, mainEntity: { '@type': 'ItemList', numberOfItems: languagePages.length, itemListElement: languagePages.map((page, index) => ({ '@type': 'ListItem', position: index + 1, url: canonicalUrl(page.path), name: page.title })) } },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Languages', path: '/languages/' }]),
    ],
  };

  const arrangementIndex: SeoPage = {
    path: '/arrangements/',
    title: 'Worship Videos by Style | Contemporary, Gospel, Choir & Hymns',
    description: 'Browse worship videos with words by musical style, including contemporary worship, gospel, choir, traditional hymns, acoustic and live versions.',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>Worship styles</span></nav><article class="seo-hero"><p class="seo-eyebrow">Find the right arrangement</p><h1>Worship videos by musical style</h1><p class="seo-lead">Choose the sound and presentation that fits your congregation, then preview the exact video before adding it to a service playlist.</p></article><section class="seo-section"><div class="seo-card-grid">${arrangements.map(([arrangement, songs]) => `<a class="seo-card" href="/arrangements/${slugify(arrangement)}/"><strong>${escapeHtml(arrangement)}</strong><span>${songs.length.toLocaleString('en-GB')} playable videos</span></a>`).join('')}</div></section>`,
    schema: [
      { '@type': 'CollectionPage', name: 'Worship videos by musical style', url: `${SITE}/arrangements/` },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Worship styles', path: '/arrangements/' }]),
    ],
  };

  const seasonIndex: SeoPage = {
    path: '/seasons/',
    title: 'Church Season Worship Videos | Christmas, Easter & More',
    description: 'Browse worship songs and hymns with lyrics for Advent, Christmas, Lent and Holy Week, Easter, Pentecost, Harvest and Thanksgiving.',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>Church seasons</span></nav><article class="seo-hero"><p class="seo-eyebrow">Seasonal worship planning</p><h1>Worship videos for the church year</h1><p class="seo-lead">Find playable worship songs and hymns with words for Advent, Christmas, Lent and Holy Week, Easter, Pentecost, Harvest and Thanksgiving. Open any collection directly in the finder, then preview the exact video before church use.</p></article><section class="seo-section"><div class="seo-card-grid">${seasons.map(([season, songs]) => `<a class="seo-card" href="/seasons/${slugify(season)}/"><strong>${escapeHtml(season)}</strong><span>${songs.length.toLocaleString('en-GB')} playable videos with words or subtitles</span></a>`).join('')}</div></section><section class="seo-section seo-help"><h2>Use seasonal labels carefully</h2><p>Seasonal matches come from song titles, familiar hymn names and public catalogue metadata. Review every choice for the readings, theology and tradition of your own church service.</p></section>`,
    schema: [
      { '@type': 'CollectionPage', name: 'Worship videos for the church year', url: `${SITE}/seasons/`, mainEntity: { '@type': 'ItemList', numberOfItems: seasonPages.length, itemListElement: seasonPages.map((page, index) => ({ '@type': 'ListItem', position: index + 1, url: canonicalUrl(page.path), name: page.title })) } },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Church seasons', path: '/seasons/' }]),
    ],
  };

  const presentationIndex: SeoPage = {
    path: '/formats/',
    title: 'Worship Videos by Lyrics & Subtitle Format | Churches',
    description: 'Browse worship videos by vocal, lyrics and subtitle format, including English words, translated subtitles, native-language words and bilingual videos.',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>Lyrics & subtitle formats</span></nav><article class="seo-hero"><p class="seo-eyebrow">Know what people will hear and read</p><h1>Worship videos by lyrics and subtitle format</h1><p class="seo-lead">Choose whether your congregation needs English words, translated subtitles, a native-language vocal with English subtitles, native-language words or a bilingual presentation.</p><div class="seo-actions"><a class="seo-button" href="/#main-content">Search the complete catalogue</a><a class="seo-button seo-button--quiet" href="/guides/multilingual-worship/">Plan multilingual worship</a></div></article><section class="seo-section"><div class="seo-card-grid">${presentations.map(([presentation, songs]) => { const details = PRESENTATION_PAGE_DETAILS[presentation]; return `<a class="seo-card" href="/formats/${details.slug}/"><strong>${escapeHtml(details.heading)}</strong><span>${songs.length.toLocaleString('en-GB')} playable videos</span></a>`; }).join('')}</div></section><section class="seo-section seo-help"><h2>What the labels can and cannot tell you</h2><p>Labels are based on public uploader metadata and conservative catalogue checks. They make searching faster, but they do not replace a complete preview or review by a fluent speaker and trusted church leader.</p></section>`,
    schema: [
      { '@type': 'CollectionPage', name: 'Worship videos by lyrics and subtitle format', url: `${SITE}/formats/`, mainEntity: { '@type': 'ItemList', numberOfItems: presentationPages.length, itemListElement: presentationPages.map((page, index) => ({ '@type': 'ListItem', position: index + 1, url: canonicalUrl(page.path), name: page.title })) } },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Lyrics and subtitle formats', path: '/formats/' }]),
    ],
  };

  const songFamilyIndex: SeoPage = {
    path: '/songs/',
    title: 'Modern Worship Songs in Different Languages | Churches',
    description: 'Compare well-known modern worship songs in multiple languages, with clear vocal, lyrics, translation and subtitle labels for church services.',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>Songs across languages</span></nav><article class="seo-hero"><p class="seo-eyebrow">Familiar songs, more languages</p><h1>Well-known worship songs in different languages</h1><p class="seo-lead">Start with a familiar modern worship song, then compare native-language covers, translated subtitles, English subtitles and bilingual versions. Every result opens in the same simple finder so you can preview the exact YouTube upload before church use.</p><div class="seo-actions"><a class="seo-button" href="/#main-content">Search the complete catalogue</a><a class="seo-button seo-button--quiet" href="/guides/multilingual-worship/">Plan multilingual worship</a></div></article><section class="seo-section"><div class="seo-card-grid">${songFamilies.map(([family, songs]) => { const languageCount = new Set(songs.map((song) => song.language ?? 'English')).size; return `<a class="seo-card" href="/songs/${family.slug}/"><strong>${escapeHtml(family.title)}</strong><span>${songs.length.toLocaleString('en-GB')} playable versions across ${languageCount.toLocaleString('en-GB')} languages</span></a>`; }).join('')}</div></section><section class="seo-section seo-help"><h2>Why these collections are selective</h2><p>A useful song page needs several real language versions and enough public metadata to distinguish what people will hear and read. The site does not create empty pages for song titles with little evidence, and it does not reproduce copyrighted lyrics.</p></section>`,
    schema: [
      { '@type': 'CollectionPage', name: 'Well-known worship songs in different languages', url: `${SITE}/songs/`, mainEntity: { '@type': 'ItemList', numberOfItems: songFamilyPages.length, itemListElement: songFamilyPages.map((page, index) => ({ '@type': 'ListItem', position: index + 1, url: canonicalUrl(page.path), name: page.title })) } },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Songs across languages', path: '/songs/' }]),
    ],
  };

  const guideIndex: SeoPage = {
    path: '/guides/',
    title: 'Practical Worship Video Guides for Churches',
    description: 'Free practical guides for selecting worship word videos, planning multilingual services and using a second church projection screen.',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>Guides</span></nav><article class="seo-hero"><p class="seo-eyebrow">Church worship resources</p><h1>Practical worship video guides</h1><p class="seo-lead">Short, responsible guidance for choosing videos, welcoming multilingual congregations and running a clean projection screen.</p></article><section class="seo-section"><div class="seo-card-grid">${GUIDE_PAGES.map((page) => `<a class="seo-card" href="${page.path}"><strong>${escapeHtml(page.title)}</strong><span>${escapeHtml(page.description)}</span></a>`).join('')}</div></section>`,
    schema: [
      { '@type': 'CollectionPage', name: 'Practical worship video guides for churches', url: `${SITE}/guides/` },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides/' }]),
    ],
  };

  const pages = [
    languageIndex,
    ...languagePages,
    arrangementIndex,
    ...arrangementPages,
    seasonIndex,
    ...seasonPages,
    presentationIndex,
    ...presentationPages,
    songFamilyIndex,
    ...songFamilyPages,
    guideIndex,
    ...GUIDE_PAGES,
  ];
  await Promise.all([
    removeStaleGeneratedDirectories('languages', new Set(languagePages.map((page) => page.path.split('/').filter(Boolean).at(-1)!))),
    removeStaleGeneratedDirectories('arrangements', new Set(arrangementPages.map((page) => page.path.split('/').filter(Boolean).at(-1)!))),
    removeStaleGeneratedDirectories('seasons', new Set(seasonPages.map((page) => page.path.split('/').filter(Boolean).at(-1)!))),
    removeStaleGeneratedDirectories('formats', new Set(presentationPages.map((page) => page.path.split('/').filter(Boolean).at(-1)!))),
    removeStaleGeneratedDirectories('songs', new Set(songFamilyPages.map((page) => page.path.split('/').filter(Boolean).at(-1)!))),
    removeStaleGeneratedDirectories('guides', new Set(GUIDE_PAGES.map((page) => page.path.split('/').filter(Boolean).at(-1)!))),
    removeDuplicateIndexFiles('languages'),
    removeDuplicateIndexFiles('arrangements'),
    removeDuplicateIndexFiles('seasons'),
    removeDuplicateIndexFiles('formats'),
    removeDuplicateIndexFiles('songs'),
    removeDuplicateIndexFiles('guides'),
  ]);
  await Promise.all(pages.map(writePage));

  const urls = [`${SITE}/`, ...pages.map((page) => canonicalUrl(page.path))];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc><lastmod>${LAST_MODIFIED}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(resolve(PUBLIC_DIR, 'sitemap.xml'), sitemap, 'utf8');
  await writeFile(resolve(PUBLIC_DIR, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /*?projection=1\n\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');
  await writeFile(resolve(PUBLIC_DIR, 'seo-urls.json'), `${JSON.stringify(urls, null, 2)}\n`, 'utf8');
  await writeFile(resolve(PUBLIC_DIR, 'indexnow-key.txt'), `${INDEXNOW_KEY}\n`, 'utf8');
  await writeFile(resolve(PUBLIC_DIR, 'llms.txt'), `# Worship Word Video\n\n> A search and member playlist-planning tool that saves churches time finding YouTube worship and hymn videos with on-screen words or subtitles. It is designed for English-speaking and multilingual churches, including congregations without musicians.\n\nCanonical site: ${SITE}/\nCatalogue: ${playableSongs.length.toLocaleString('en-GB')} searchable entries and ${uniquePlayableVideos.toLocaleString('en-GB')} unique playable YouTube videos at the latest catalogue build.\nLanguages: ${namedLanguageCount} named languages, with dedicated public collection pages for languages having at least ${MIN_LANGUAGE_PAGE_VIDEOS} playable videos. Entries whose public metadata does not safely identify a language remain unclassified rather than being guessed.\nFeatures: public song, artist, language and hymn-number search; presentation and arrangement labels; church-season filters; member service playlists; optional automatic next-video playback; per-video start/stop timing; clean second-screen projection.\n\n## Important public collections\n\n- Worship word lyrics guide: ${SITE}/guides/worship-word-lyrics/\n- Churches without musicians guide: ${SITE}/guides/worship-videos-for-churches-without-musicians/\n- Well-known songs across languages: ${SITE}/songs/\n- Languages: ${SITE}/languages/\n- Lyrics and subtitle formats: ${SITE}/formats/\n- Church seasons: ${SITE}/seasons/\n- Worship arrangements: ${SITE}/arrangements/\n- Church guides: ${SITE}/guides/\n\nCopyright: the site is a directory and does not host recordings or reproduce lyrics. Videos remain on YouTube. Catalogue labels are based on public uploader metadata and must be previewed before church use.\nContact: stephen@kairoshousing.org.uk\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');

  const feedItems = GUIDE_PAGES.map((page) => `<item><title>${escapeHtml(page.title)}</title><link>${canonicalUrl(page.path)}</link><guid>${canonicalUrl(page.path)}</guid><description>${escapeHtml(page.description)}</description><pubDate>${FEED_DATE}</pubDate></item>`).join('');
  await writeFile(resolve(PUBLIC_DIR, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Worship Word Video Guides</title><link>${SITE}/guides/</link><description>Practical worship video guidance for churches.</description><language>en-gb</language>${feedItems}</channel></rss>`, 'utf8');

  console.log(JSON.stringify({ generatedPages: pages.length, languagePages: languagePages.length, arrangementPages: arrangementPages.length, seasonPages: seasonPages.length, presentationPages: presentationPages.length, songFamilyPages: songFamilyPages.length, guidePages: GUIDE_PAGES.length, sitemapUrls: urls.length }, null, 2));
}

await generate();
