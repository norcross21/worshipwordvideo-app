# Worship Word Video

Worship Word Video helps English-speaking and multilingual churches find worship and hymn words videos on YouTube. It is especially useful when a church does not have musicians and would otherwise spend hours searching for suitable word videos.

The app includes contemporary worship songs, traditional hymns, CCLI UK favourites, several hymn-book indexes, verified words-video markers, local custom songs, and browser-saved service planning.

The international catalogue combines curated collections with a large, regularly rechecked words/subtitle discovery library. Automatically researched entries retain their exact YouTube ID, channel, language, region, duration, words-evidence label and review date. Language is only asserted when the uploader title, channel or script supports it; otherwise the entry says “Language not stated”. They are discovery aids rather than linguistic, theological or copyright endorsements, so a fluent speaker or church leader should review a video before public use.

The maintained catalogue now contains 72,965 playable videos with unique YouTube IDs across 114 named languages. Twenty named-language collections contain at least 500 playable videos, including Portuguese, Tamil, Hindi, Arabic, Burmese/Myanmar, Spanish, Indonesian, Tagalog/Filipino, Mandarin Chinese, Ukrainian, French, Korean, Swahili and Persian/Farsi. These counts are a snapshot; run `npm run catalogue:report` for current figures. Exact-video cards distinguish musical arrangements (including contemporary, live, choral, country, acoustic and traditional) and whether uploader metadata indicates English words, translated subtitles, native-language words, English subtitles or a bilingual format.

Service playlists support optional start and stop points using seconds or `m:ss`. A dedicated projection URL opens only the synced YouTube player on a second monitor or projector while the service dashboard stays on the operator's screen.

## Local development

Requirements:

- Node.js 22 or later
- npm
- A Supabase project only if maintaining the legacy account records or anonymous usage metrics

Install and run:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these public browser values in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never use a Supabase secret or service-role key in a `VITE_` variable. Values with that prefix are included in the browser application.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

## Search discovery

The production build generates substantial language, worship-style, presentation, season and familiar-song pages, six practical church guides, a root sitemap and crawler files from the current catalogue.

```bash
npm run seo:generate
npm run seo:submit:indexnow
```

`seo:submit:indexnow` should be run only after the generated pages and IndexNow key file are live. Google Search Console still requires domain-owner verification and manual or authenticated sitemap submission. See [docs/SEO_GROWTH_PLAN.md](docs/SEO_GROWTH_PLAN.md) for the owner checklist and safe off-site growth plan.

The language-depth research command works through collections below the 500-video target using familiar worship-song titles, native-language word searches and English-subtitle searches. Its target is a research direction rather than a promise: a language remains below 500 when there are not enough public, embeddable, worship-word videos with credible metadata.

```bash
npm run catalogue:research:language-depth
```

## Supabase (legacy accounts and anonymous metrics)

Historical database changes are stored in `supabase/migrations`. The former cloud-playlist tables retain Row Level Security while legacy records are reviewed or deleted.

The public application no longer requires or offers an account. Service plans, trim points and the active service are stored in the user's browser so every planning and projection feature is available immediately. The earlier Supabase authentication tables and administrative functions remain only as legacy infrastructure while existing records are reviewed or deleted.

For a linked Supabase project:

```bash
supabase db push --linked
supabase db advisors --linked --type all
```

## Deployment

The site is deployed as a Vite app on Vercel. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` only when anonymous usage metrics or legacy-account maintenance is required. Never expose a secret or service-role key through a `VITE_` variable.

## Charity support

The app is currently provided without charge. The optional charity link sends visitors directly to Kairos Housing's internal donation page at `https://operations.kairoshousing.org.uk/donate`; Worship Word Video does not process donations or receive payment details.

There is no donation popup. A single quiet footer link is available for people who choose to learn about supporting Kairos Housing, without interrupting search, planning or playback.
