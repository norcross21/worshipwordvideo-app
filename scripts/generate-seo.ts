import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getFullSongLibrary } from '../src/data/songLibraryStore';
import { inferLanguagePresentation, inferWorshipArrangement } from '../src/data/songPresentation';
import type { WorshipSong } from '../src/data/worshipSongs';

const SITE = 'https://www.worshipwordvideo.org';
const PUBLIC_DIR = resolve(process.cwd(), 'public');
const LAST_MODIFIED = '2026-08-09';
const INDEXNOW_KEY = 'b2b960d2c713e3e71a89a4f6e34345d1';
const MIN_LANGUAGE_PAGE_VIDEOS = 3;

interface SeoPage {
  path: string;
  title: string;
  description: string;
  body: string;
  schema: Record<string, unknown> | Array<Record<string, unknown>>;
}

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

function pageShell(page: SeoPage): string {
  const url = canonicalUrl(page.path);
  const schemas = Array.isArray(page.schema) ? page.schema : [page.schema];
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        url: `${SITE}/`,
        name: 'Worship Word Video',
        description: 'A free worship and hymn words-video finder for churches.',
        inLanguage: 'en-GB',
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
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_GB">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${url}">
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
    <nav aria-label="Useful links"><a href="/languages/">Languages</a><a href="/arrangements/">Worship styles</a><a href="/guides/">Church guides</a><a href="/#main-content">Song finder</a></nav>
    <p>Worship Word Video is a free directory and playlist-planning tool. Videos remain hosted by YouTube and subject to the uploader's and YouTube's terms. Always preview a video and confirm church licensing before public use.</p>
    <p><a href="mailto:stephen@kairoshousing.org.uk?subject=Worship%20Word%20Video%20content%20report">Report a content concern</a></p>
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
  </section>
  <section class="seo-section"><h2>Explore other language collections</h2><div class="seo-link-grid">${related.map((item) => `<a href="/languages/${slugify(item)}/">${escapeHtml(item)} worship videos</a>`).join('')}</div></section>`;

  return {
    path: `/languages/${slug}/`,
    title: `${language} Worship Videos with Lyrics & Words | Free Church Finder`,
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
    title: `${arrangement} Worship Videos with Words | Worship Word Video`,
    description,
    body,
    schema: {
      '@type': 'CollectionPage',
      '@id': `${SITE}/arrangements/${slug}/#page`,
      url: `${SITE}/arrangements/${slug}/`,
      name: `${arrangement} worship videos with words`,
      description,
      isPartOf: { '@id': `${SITE}/#website` },
      inLanguage: 'en-GB',
    },
  };
}

const GUIDE_PAGES: SeoPage[] = [
  {
    path: '/guides/church-youtube-lyric-videos/',
    title: 'How to Choose YouTube Lyric Videos for Church Worship',
    description: 'A practical checklist for choosing clear, suitable and legally responsible YouTube worship videos with words for a church service.',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/guides/">Guides</a><span>›</span><span>Choosing word videos</span></nav><article class="seo-hero"><p class="seo-eyebrow">Practical church guide</p><h1>How to choose YouTube lyric videos for church worship</h1><p class="seo-lead">A clear on-screen-words video can help a congregation sing, but the title “lyrics” alone does not guarantee accuracy, suitability or permission for public use.</p><a class="seo-button" href="/#main-content">Open the free video finder</a></article><section class="seo-section"><h2>A five-point preview check</h2><ol><li><strong>Words:</strong> watch the whole video and check spelling, verse order and theological suitability.</li><li><strong>Audio:</strong> confirm the key, tempo, arrangement and recording quality work for congregational singing.</li><li><strong>Presentation:</strong> look for readable contrast, sensible timing and no distracting introductions, adverts or end screens.</li><li><strong>Language:</strong> for translations, ask a fluent speaker or trusted church leader to review both meaning and theology.</li><li><strong>Permissions:</strong> confirm the licences and permissions appropriate to your church, country, stream and venue.</li></ol></section><section class="seo-section"><h2>Prepare a clean service playlist</h2><p>Add chosen videos in service order. Use the start and stop fields to remove silence or spoken sections, then rehearse the whole sequence on the actual church internet connection and projection equipment. YouTube timing starts near a video keyframe, so allow a small margin rather than relying on frame-perfect cuts.</p><p>Keep a backup plan. Third-party uploads can be removed, made private, geo-blocked or interrupted by platform changes.</p></section><section class="seo-section"><h2>What Worship Word Video does</h2><p>The finder indexes public YouTube links and useful metadata; it does not host recordings or reproduce song lyrics. It provides search, playlist planning, timing and a clean second-screen projection window. The church remains responsible for previewing content and meeting its licensing duties.</p></section>`,
    schema: { '@type': 'Article', headline: 'How to choose YouTube lyric videos for church worship', dateModified: LAST_MODIFIED, author: { '@type': 'Organization', name: 'Worship Word Video' }, publisher: { '@type': 'Organization', name: 'Worship Word Video' } },
  },
  {
    path: '/guides/multilingual-worship/',
    title: 'Planning Multilingual Worship with Lyrics and Subtitles',
    description: 'Practical guidance for finding, checking and presenting worship songs in Farsi, Urdu, Portuguese, African and other languages.',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/guides/">Guides</a><span>›</span><span>Multilingual worship</span></nav><article class="seo-hero"><p class="seo-eyebrow">Inclusive worship guide</p><h1>Planning multilingual worship with lyrics and subtitles</h1><p class="seo-lead">Multilingual worship is strongest when people can understand what they hear, read and sing—not simply when another language appears on screen.</p><a class="seo-button" href="/languages/">Explore language collections</a></article><section class="seo-section"><h2>Choose the right presentation format</h2><p>An English vocal with translated subtitles helps readers follow meaning while hearing a familiar recording. A native-language vocal with English subtitles helps an English-speaking congregation understand a local-language performance. Native vocals with native words support confident singing for fluent speakers. Bilingual videos can help a mixed congregation participate together.</p><p>Worship Word Video labels these formats separately where uploader metadata supports the distinction, so leaders can filter before previewing.</p></section><section class="seo-section"><h2>Review with people, not just software</h2><ol><li>Ask a fluent speaker to verify the visible words and natural phrasing.</li><li>Ask a trusted church leader to review theology and cultural context.</li><li>Check whether the song is a translation, adaptation or different composition with a similar title.</li><li>Rehearse transitions and explain unfamiliar language briefly and respectfully.</li></ol></section><section class="seo-section"><h2>Make participation easy</h2><p>Introduce one clear congregational response, chorus or repeated line rather than overwhelming people. Use readable subtitles, explain which language will be sung and make the English meaning available where helpful. Preview the exact video because public metadata can be incomplete or mistaken.</p></section>`,
    schema: { '@type': 'Article', headline: 'Planning multilingual worship with lyrics and subtitles', dateModified: LAST_MODIFIED, author: { '@type': 'Organization', name: 'Worship Word Video' }, publisher: { '@type': 'Organization', name: 'Worship Word Video' } },
  },
  {
    path: '/guides/second-screen-church-projection/',
    title: 'Simple Second-Screen YouTube Projection for Churches',
    description: 'How to run a church worship playlist on a projector or second monitor while keeping the control dashboard private.',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/guides/">Guides</a><span>›</span><span>Second-screen projection</span></nav><article class="seo-hero"><p class="seo-eyebrow">Church technology guide</p><h1>Simple second-screen YouTube projection for churches</h1><p class="seo-lead">Keep service controls on the operator's laptop while the congregation sees only the worship video.</p><a class="seo-button" href="/#main-content">Build a service playlist</a></article><section class="seo-section"><h2>Basic setup</h2><ol><li>Connect the projector, television or second monitor and choose “Extend”, not “Mirror”, in Windows or macOS display settings.</li><li>Build the service playlist and set any start or stop points.</li><li>Select <strong>Open projection</strong>. Where the browser supports multi-screen placement, the app attempts to use the other display.</li><li>If it opens on the laptop, drag the projection window to the church display and select <strong>Full screen</strong>.</li></ol></section><section class="seo-section"><h2>Before the service</h2><p>Test sound routing, screen resolution, Wi-Fi, autoplay behaviour and every video. Keep the laptop connected to power and turn off notifications. A wired network connection is preferable where available.</p><p>The projection window synchronises the selected playlist item and its start/stop timing with the dashboard. Browser and operating-system security rules mean that automatic screen placement cannot be guaranteed on every device, so the manual drag-and-fullscreen route remains available.</p></section>`,
    schema: { '@type': 'HowTo', name: 'Simple second-screen YouTube projection for churches', description: 'Open a clean church projection window while keeping playlist controls private.', step: ['Connect and extend the second display', 'Build the service playlist', 'Open the projection window', 'Move it to the church display and use full screen'].map((text, index) => ({ '@type': 'HowToStep', position: index + 1, text })) },
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

async function generate(): Promise<void> {
  const playableSongs = getFullSongLibrary().filter((song) => Boolean(song.youtubeId));
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

  const languageIndex: SeoPage = {
    path: '/languages/',
    title: 'Worship Videos by Language | 80+ International Church Collections',
    description: `Explore worship and hymn videos with words across ${languagePages.length} substantial language collections for international and multilingual churches.`,
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>Languages</span></nav><article class="seo-hero"><p class="seo-eyebrow">International worship</p><h1>Worship videos by language</h1><p class="seo-lead">Browse ${languagePages.length} language collections with playable Christian worship and hymn videos. Each page explains the available vocal, lyrics and subtitle formats and links into the free filtered finder.</p><a class="seo-button" href="/#main-content">Search the complete catalogue</a></article><section class="seo-section"><div class="seo-card-grid">${languages.map(([language, songs]) => `<a class="seo-card" href="/languages/${slugify(language)}/"><strong>${escapeHtml(language)}</strong><span>${songs.length.toLocaleString('en-GB')} playable videos</span></a>`).join('')}</div></section>`,
    schema: { '@type': 'CollectionPage', name: 'Worship videos by language', url: `${SITE}/languages/`, mainEntity: { '@type': 'ItemList', numberOfItems: languagePages.length, itemListElement: languagePages.map((page, index) => ({ '@type': 'ListItem', position: index + 1, url: canonicalUrl(page.path), name: page.title })) } },
  };

  const arrangementIndex: SeoPage = {
    path: '/arrangements/',
    title: 'Worship Videos by Style | Contemporary, Gospel, Choir & Hymns',
    description: 'Browse worship videos with words by musical style, including contemporary worship, gospel, choir, traditional hymns, acoustic and live versions.',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>Worship styles</span></nav><article class="seo-hero"><p class="seo-eyebrow">Find the right arrangement</p><h1>Worship videos by musical style</h1><p class="seo-lead">Choose the sound and presentation that fits your congregation, then preview the exact video before adding it to a service playlist.</p></article><section class="seo-section"><div class="seo-card-grid">${arrangements.map(([arrangement, songs]) => `<a class="seo-card" href="/arrangements/${slugify(arrangement)}/"><strong>${escapeHtml(arrangement)}</strong><span>${songs.length.toLocaleString('en-GB')} playable videos</span></a>`).join('')}</div></section>`,
    schema: { '@type': 'CollectionPage', name: 'Worship videos by musical style', url: `${SITE}/arrangements/` },
  };

  const guideIndex: SeoPage = {
    path: '/guides/',
    title: 'Practical Worship Video Guides for Churches',
    description: 'Free practical guides for selecting worship word videos, planning multilingual services and using a second church projection screen.',
    body: `<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>Guides</span></nav><article class="seo-hero"><p class="seo-eyebrow">Church worship resources</p><h1>Practical worship video guides</h1><p class="seo-lead">Short, responsible guidance for choosing videos, welcoming multilingual congregations and running a clean projection screen.</p></article><section class="seo-section"><div class="seo-card-grid">${GUIDE_PAGES.map((page) => `<a class="seo-card" href="${page.path}"><strong>${escapeHtml(page.title)}</strong><span>${escapeHtml(page.description)}</span></a>`).join('')}</div></section>`,
    schema: { '@type': 'CollectionPage', name: 'Practical worship video guides for churches', url: `${SITE}/guides/` },
  };

  const pages = [languageIndex, ...languagePages, arrangementIndex, ...arrangementPages, guideIndex, ...GUIDE_PAGES];
  await Promise.all([
    removeStaleGeneratedDirectories('languages', new Set(languagePages.map((page) => page.path.split('/').filter(Boolean).at(-1)!))),
    removeStaleGeneratedDirectories('arrangements', new Set(arrangementPages.map((page) => page.path.split('/').filter(Boolean).at(-1)!))),
    removeStaleGeneratedDirectories('guides', new Set(GUIDE_PAGES.map((page) => page.path.split('/').filter(Boolean).at(-1)!))),
  ]);
  await Promise.all(pages.map(writePage));

  const urls = [`${SITE}/`, ...pages.map((page) => canonicalUrl(page.path))];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc><lastmod>${LAST_MODIFIED}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(resolve(PUBLIC_DIR, 'sitemap.xml'), sitemap, 'utf8');
  await writeFile(resolve(PUBLIC_DIR, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /*?projection=1\n\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');
  await writeFile(resolve(PUBLIC_DIR, 'seo-urls.json'), `${JSON.stringify(urls, null, 2)}\n`, 'utf8');
  await writeFile(resolve(PUBLIC_DIR, 'indexnow-key.txt'), `${INDEXNOW_KEY}\n`, 'utf8');
  await writeFile(resolve(PUBLIC_DIR, 'llms.txt'), `# Worship Word Video\n\n> A search and member playlist-planning tool that saves churches time finding YouTube worship and hymn videos with on-screen words or subtitles. It is designed for English-speaking and multilingual churches, including congregations without musicians.\n\nCanonical site: ${SITE}/\nCatalogue: ${playableSongs.length.toLocaleString('en-GB')} searchable entries and ${uniquePlayableVideos.toLocaleString('en-GB')} unique playable YouTube videos at the latest catalogue build.\nLanguages: ${namedLanguageCount} named languages, with dedicated public collection pages for languages having at least ${MIN_LANGUAGE_PAGE_VIDEOS} playable videos. Entries whose public metadata does not safely identify a language remain unclassified rather than being guessed.\nFeatures: public song, artist, language and hymn-number search; presentation and arrangement labels; member service playlists; per-video start/stop timing; clean second-screen projection.\nCopyright: the site is a directory and does not host recordings or reproduce lyrics. Videos remain on YouTube.\nContact: stephen@kairoshousing.org.uk\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');

  const feedItems = GUIDE_PAGES.map((page) => `<item><title>${escapeHtml(page.title)}</title><link>${canonicalUrl(page.path)}</link><guid>${canonicalUrl(page.path)}</guid><description>${escapeHtml(page.description)}</description><pubDate>Sun, 09 Aug 2026 00:00:00 GMT</pubDate></item>`).join('');
  await writeFile(resolve(PUBLIC_DIR, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Worship Word Video Guides</title><link>${SITE}/guides/</link><description>Practical worship video guidance for churches.</description><language>en-gb</language>${feedItems}</channel></rss>`, 'utf8');

  console.log(JSON.stringify({ generatedPages: pages.length, languagePages: languagePages.length, arrangementPages: arrangementPages.length, guidePages: GUIDE_PAGES.length, sitemapUrls: urls.length }, null, 2));
}

await generate();
