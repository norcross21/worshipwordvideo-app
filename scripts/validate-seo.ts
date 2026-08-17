import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const SITE = 'https://www.worshipwordvideo.org';
const ROOT = process.cwd();
const PUBLIC_DIR = resolve(ROOT, 'public');
const GENERATED_SECTIONS = ['languages', 'arrangements', 'seasons', 'formats', 'songs', 'videos', 'guides', 'about'];

async function findIndexPages(directory: string): Promise<string[]> {
  const pages: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) pages.push(...await findIndexPages(path));
    else if (entry.name === 'index.html') pages.push(path);
  }
  return pages;
}

function capture(html: string, pattern: RegExp): string | undefined {
  return html.match(pattern)?.[1]?.trim();
}

function decodedLength(value: string): number {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .length;
}

function routeForFile(file: string): string {
  if (file === resolve(ROOT, 'index.html')) return '/';
  const directory = relative(PUBLIC_DIR, resolve(file, '..')).split(sep).join('/');
  return `/${directory}/`;
}

const generatedPages = (await Promise.all(GENERATED_SECTIONS.map(async (section) => {
  const directory = resolve(PUBLIC_DIR, section);
  return (await stat(directory)).isDirectory() ? findIndexPages(directory) : [];
}))).flat();
const pages = [resolve(ROOT, 'index.html'), ...generatedPages];
const sitemap = await readFile(resolve(PUBLIC_DIR, 'sitemap.xml'), 'utf8');
const videoSitemap = await readFile(resolve(PUBLIC_DIR, 'video-sitemap.xml'), 'utf8');
const robots = await readFile(resolve(PUBLIC_DIR, 'robots.txt'), 'utf8');
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]));
const videoSitemapUrls = new Set([...videoSitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]));
const routes = new Set(pages.map(routeForFile));
const titles = new Map<string, string>();
const canonicals = new Map<string, string>();
const errors: string[] = [];
const cataloguePath = resolve(PUBLIC_DIR, 'catalogue', 'worship-songs.json');
const starterCataloguePath = resolve(PUBLIC_DIR, 'catalogue', 'worship-songs-starter.json');
const [catalogueText, starterCatalogueText] = await Promise.all([
  readFile(cataloguePath, 'utf8'),
  readFile(starterCataloguePath, 'utf8'),
]);
const watchPageData = JSON.parse(await readFile(resolve(ROOT, 'src', 'data', 'videoWatchPages.json'), 'utf8')) as Array<{
  youtubeId: string;
  path: string;
  videoTitle: string;
  channel: string;
  language: string;
  checkedAt: string;
}>;
const catalogue = JSON.parse(catalogueText) as { version?: number; checkedOn?: string; dictionaries?: { language?: string[] }; songs?: unknown[][] };
const starterCatalogue = JSON.parse(starterCatalogueText) as { version?: number; songs?: unknown[][] };
const catalogueRows = catalogue.songs ?? [];
const starterRows = starterCatalogue.songs ?? [];
const catalogueVideoIds = catalogueRows.map((row) => row[4]).filter((value): value is string => typeof value === 'string');
const watchPageLanguages = new Set(watchPageData.map((video) => video.language));

if (catalogue.version !== 2 || starterCatalogue.version !== 2) errors.push('catalogue: compact version 2 payload expected');
if (catalogueRows.length < 50_000) errors.push(`catalogue: expected at least 50,000 playable videos, found ${catalogueRows.length}`);
if (starterRows.length < 1_500 || starterRows.length > 3_000) errors.push(`catalogue: starter should contain 1,500–3,000 videos, found ${starterRows.length}`);
if (Buffer.byteLength(starterCatalogueText) > 750_000) errors.push('catalogue: starter payload exceeds the 750 KB performance budget');
if (Buffer.byteLength(catalogueText) > 12_000_000) errors.push('catalogue: complete payload exceeds the 12 MB performance budget');
if (catalogueVideoIds.some((id) => !/^[A-Za-z0-9_-]{11}$/.test(id))) errors.push('catalogue: invalid YouTube video ID found');
if (new Set(catalogueVideoIds).size !== catalogueVideoIds.length) errors.push('catalogue: repeated YouTube video IDs found');
if (watchPageData.length < 150) errors.push(`watch pages: expected at least 150 curated videos, found ${watchPageData.length}`);
if (watchPageLanguages.size < 100) errors.push(`watch pages: expected at least 100 represented languages, found ${watchPageLanguages.size}`);
if (new Set(watchPageData.map((video) => video.youtubeId)).size !== watchPageData.length) errors.push('watch pages: repeated YouTube IDs found');
if (new Set(watchPageData.map((video) => video.path)).size !== watchPageData.length) errors.push('watch pages: repeated paths found');
for (const video of watchPageData) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(video.youtubeId)) errors.push(`watch pages: invalid YouTube ID ${video.youtubeId}`);
  if (!/^\/videos\/[a-z0-9-]+\/$/.test(video.path)) errors.push(`watch pages: invalid route ${video.path}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(video.checkedAt)) errors.push(`watch pages: invalid checked date for ${video.youtubeId}`);
  if (!video.language || video.language === 'Language not stated') errors.push(`watch pages: missing language for ${video.youtubeId}`);
  if (/\b(sermon|preaching|debate|podcast|bible study|reaction|tutorial|documentary|slayer|dakinis)\b|\bjesus\s+vs\b|\bmuslim response\b/i.test(`${video.videoTitle} ${video.channel}`)) {
    errors.push(`watch pages: likely non-worship content remains for ${video.youtubeId}`);
  }
}
for (const deprecatedLanguage of ['Burmese', 'Farsi', 'Persian', 'Filipino', 'Tagalog']) {
  if (catalogue.dictionaries?.language?.includes(deprecatedLanguage)) errors.push(`catalogue: non-canonical language label remains: ${deprecatedLanguage}`);
}

for (const file of pages) {
  const route = routeForFile(file);
  const html = await readFile(file, 'utf8');
  const title = capture(html, /<title>(.*?)<\/title>/s);
  const description = capture(html, /<meta name="description" content="(.*?)"\s*\/?\s*>/s);
  const canonical = capture(html, /<link rel="canonical" href="(.*?)"\s*\/?\s*>/s);
  const h1Count = (html.match(/<h1(?:\s|>)/g) ?? []).length;

  if (!title) errors.push(`${route}: missing title`);
  if (!description) errors.push(`${route}: missing meta description`);
  if (!canonical) errors.push(`${route}: missing canonical URL`);
  if (h1Count !== 1) errors.push(`${route}: expected one h1, found ${h1Count}`);
  if (canonical !== `${SITE}${route}`) errors.push(`${route}: canonical does not match its route`);
  if (canonical && !sitemapUrls.has(canonical)) errors.push(`${route}: canonical is missing from the sitemap`);
  if (title && (decodedLength(title) < 25 || decodedLength(title) > 65)) errors.push(`${route}: title length should be 25–65 characters`);
  if (description && (decodedLength(description) < 70 || decodedLength(description) > 165)) errors.push(`${route}: description length should be 70–165 characters`);
  if (/href="\/\?/.test(html)) errors.push(`${route}: finder links must use fragment parameters, not crawlable query parameters`);
  if (!html.includes('href="/about/"') && route !== '/about/') errors.push(`${route}: missing editorial-method link to /about/`);

  if (title) {
    const earlier = titles.get(title);
    if (earlier) errors.push(`${route}: duplicate title also used by ${earlier}`);
    titles.set(title, route);
  }
  if (canonical) {
    const earlier = canonicals.get(canonical);
    if (earlier) errors.push(`${route}: duplicate canonical also used by ${earlier}`);
    canonicals.set(canonical, route);
  }

  for (const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try {
      const structuredData = JSON.parse(match[1]) as { '@graph'?: Array<Record<string, unknown>> };
      if (route.startsWith('/videos/') && route !== '/videos/') {
        const video = structuredData['@graph']?.find((item) => item['@type'] === 'VideoObject');
        if (!video) errors.push(`${route}: missing VideoObject structured data`);
        else {
          for (const property of ['name', 'description', 'thumbnailUrl', 'uploadDate', 'embedUrl']) {
            if (!video[property]) errors.push(`${route}: VideoObject is missing ${property}`);
          }
          if (!/^\d{4}-\d{2}-\d{2}T/.test(String(video.uploadDate ?? ''))) errors.push(`${route}: VideoObject uploadDate must be an original ISO timestamp`);
          if (!/^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}$/.test(String(video.embedUrl ?? ''))) errors.push(`${route}: VideoObject embedUrl is invalid`);
        }
      }
    } catch {
      errors.push(`${route}: invalid JSON-LD structured data`);
    }
  }

  if (route.startsWith('/videos/') && route !== '/videos/') {
    const iframeCount = (html.match(/<iframe(?:\s|>)/g) ?? []).length;
    if (iframeCount !== 1) errors.push(`${route}: expected one primary video iframe, found ${iframeCount}`);
    if (!videoSitemapUrls.has(`${SITE}${route}`)) errors.push(`${route}: missing from the video sitemap`);
    if (!html.includes('class="seo-section seo-verification"')) errors.push(`${route}: missing visible verification evidence`);
    if (!/<time datetime="\d{4}-\d{2}-\d{2}">/.test(html)) errors.push(`${route}: missing visible checked date`);
  }

  for (const match of html.matchAll(/href="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    const target = match[1];
    if (target === '/' || target.includes('.')) continue;
    const normalised = target.endsWith('/') ? target : `${target}/`;
    if (!routes.has(normalised)) errors.push(`${route}: internal link target does not exist: ${target}`);
  }
}

for (const url of sitemapUrls) {
  const route = new URL(url).pathname;
  if (!routes.has(route)) errors.push(`sitemap URL has no generated page: ${url}`);
}

const sitemapLastModified = [...sitemap.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map((match) => match[1]);
if (sitemapLastModified.length !== sitemapUrls.size) errors.push('sitemap: every URL must have a lastmod date');
if (sitemapLastModified.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))) errors.push('sitemap: lastmod dates must use YYYY-MM-DD');

const watchRoutes = [...routes].filter((route) => route.startsWith('/videos/') && route !== '/videos/');
if (watchPageData.length !== watchRoutes.length) errors.push(`watch pages: expected ${watchPageData.length} generated routes, found ${watchRoutes.length}`);
if (videoSitemapUrls.size !== watchRoutes.length) errors.push(`video sitemap: expected ${watchRoutes.length} URLs, found ${videoSitemapUrls.size}`);
for (const url of videoSitemapUrls) {
  if (!sitemapUrls.has(url)) errors.push(`video sitemap URL is missing from the main sitemap: ${url}`);
  if (!routes.has(new URL(url).pathname)) errors.push(`video sitemap URL has no generated watch page: ${url}`);
}
const videoEntryCount = (videoSitemap.match(/<video:video>/g) ?? []).length;
if (videoEntryCount !== videoSitemapUrls.size) errors.push('video sitemap: every URL must contain one video entry');
for (const requiredTag of ['thumbnail_loc', 'title', 'description', 'player_loc', 'duration', 'publication_date']) {
  const count = (videoSitemap.match(new RegExp(`<video:${requiredTag}(?:\\s|>)`, 'g')) ?? []).length;
  if (count !== videoSitemapUrls.size) errors.push(`video sitemap: every entry must contain video:${requiredTag}`);
}
if (!robots.includes(`Sitemap: ${SITE}/video-sitemap.xml`)) errors.push('robots.txt: video sitemap declaration is missing');

if (errors.length) {
  throw new Error(`SEO validation failed:\n- ${errors.join('\n- ')}`);
}

console.log(JSON.stringify({
  validatedPages: pages.length,
  sitemapUrls: sitemapUrls.size,
  uniqueTitles: titles.size,
  uniqueCanonicals: canonicals.size,
  structuredData: 'valid',
  videoWatchPages: watchRoutes.length,
  videoLanguages: watchPageLanguages.size,
  videoSitemapUrls: videoSitemapUrls.size,
  internalLinks: 'valid',
  catalogueVideos: catalogueRows.length,
  starterVideos: starterRows.length,
  starterBytes: Buffer.byteLength(starterCatalogueText),
  catalogueBytes: Buffer.byteLength(catalogueText),
}, null, 2));
