# Worship Word Video

Worship Word Video helps English-speaking and multilingual churches find worship and hymn words videos on YouTube. It is especially useful when a church does not have musicians and would otherwise spend hours searching for suitable word videos.

The app includes contemporary worship songs, traditional hymns, CCLI UK favourites, several hymn-book indexes, verified words-video markers, local custom songs, and optional cloud playlist saving.

The international catalogue includes the original discovery collections, a 5,548-video words/subtitle expansion and 1,800 newly rechecked word-video leads. Automatically researched entries retain their exact YouTube ID, channel, language, region, duration, words-evidence label and review date. Language is only asserted when the uploader title, channel or script supports it; otherwise the entry says “Language not stated”. They are discovery aids rather than linguistic, theological or copyright endorsements, so a native speaker or church leader should review a video before public use.

The maintained catalogue now contains 15,224 entries, including 12,048 playable videos with unique YouTube IDs across 85 language labels. Exact-video cards distinguish musical arrangements (including contemporary, live, choral, country, acoustic and traditional) and whether uploader metadata indicates English words, translated subtitles, native-language words, English subtitles or a bilingual format.

Service playlists support optional start and stop points using seconds or `m:ss`. A dedicated projection URL opens only the synced YouTube player on a second monitor or projector while the service dashboard stays on the operator's screen.

## Local development

Requirements:

- Node.js 22 or later
- npm
- A Supabase project for account and cloud-playlist features

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

The production build generates 77 substantial language pages, 11 worship-style pages, three practical church guides, a root sitemap and crawler files from the current catalogue.

```bash
npm run seo:generate
npm run seo:submit:indexnow
```

`seo:submit:indexnow` should be run only after the generated pages and IndexNow key file are live. Google Search Console still requires domain-owner verification and manual or authenticated sitemap submission. See [docs/SEO_GROWTH_PLAN.md](docs/SEO_GROWTH_PLAN.md) for the owner checklist and safe off-site growth plan.

## Supabase

Database changes are stored in `supabase/migrations`. The cloud playlist table uses Row Level Security so signed-in users can only read and change their own playlists.

The confirmed master account `stephen@kairoshousing.org.uk` receives the protected administrator directory after database verification. The first admin release is deliberately read-only and includes account search, confirmation state and sign-in activity; destructive controls require MFA and audit logging first.

The administrator can also prepare a consent-safe member invitation. Invitations are sent only by a protected server function, never from the browser, and the recipient must choose their own password, accept the account terms and make their own optional Kairos email choice. See [docs/EMAIL_DELIVERY_SETUP.md](docs/EMAIL_DELIVERY_SETUP.md) for the approval and activation checklist.

For a linked Supabase project:

```bash
supabase db push --linked
supabase db advisors --linked --type all
```

## Deployment

The site is deployed as a Vite app with a protected Vercel Function for administrator invitations. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Production, Preview, and Development in Vercel. The invitation function additionally requires server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY`; never expose the secret through a `VITE_` variable or commit it to a live `.env` file.

## Charity support

The app is currently provided without charge. The optional charity link sends visitors directly to Kairos Housing's internal donation page at `https://operations.kairoshousing.org.uk/donate`; Worship Word Video does not process donations or receive payment details.

Guests receive one optional Kairos invitation per browser-tab visit. Dismissing it stores only a session flag in the browser so it does not reopen during that visit. Signed-in users do not receive the automatic invitation; the voluntary charity link remains available in the header and footer banner.
