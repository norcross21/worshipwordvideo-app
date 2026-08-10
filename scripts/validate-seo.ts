import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const SITE = 'https://www.worshipwordvideo.org';
const ROOT = process.cwd();
const PUBLIC_DIR = resolve(ROOT, 'public');
const GENERATED_SECTIONS = ['languages', 'arrangements', 'seasons', 'formats', 'guides'];

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
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]));
const routes = new Set(pages.map(routeForFile));
const titles = new Map<string, string>();
const canonicals = new Map<string, string>();
const errors: string[] = [];

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
      JSON.parse(match[1]);
    } catch {
      errors.push(`${route}: invalid JSON-LD structured data`);
    }
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

if (errors.length) {
  throw new Error(`SEO validation failed:\n- ${errors.join('\n- ')}`);
}

console.log(JSON.stringify({
  validatedPages: pages.length,
  sitemapUrls: sitemapUrls.size,
  uniqueTitles: titles.size,
  uniqueCanonicals: canonicals.size,
  structuredData: 'valid',
  internalLinks: 'valid',
}, null, 2));
