# Worship Word Video: SEO and Discovery Plan

Last updated: 10 August 2026

## Current Google position

- Google is indexing the home page and many of the dedicated language collections. A public `site:worshipwordvideo.org` check shows the home page first and language pages across several result pages.
- The broad searches **worship word lyrics**, **worship lyric videos for churches** and **free worship lyric videos for church** do not yet show Worship Word Video prominently on the first page. The site has index coverage, but it has not yet built enough relevance and authority for those competitive searches.
- Google's displayed home-page result is stale and still mentions 15,000 videos and 85 languages. The previous source metadata also lagged behind at 25,000 videos and 87 languages. The page now uses durable wording—tens of thousands of videos and more than 100 named languages—so future catalogue growth will not make the search result inaccurate again.
- Exact query impressions, clicks, click-through rate and average position must be read from the verified Google Search Console property. Public checks are useful evidence, but they are not a substitute for Search Console's measurements.

## Bing and other discovery systems

- The site exposes a valid XML sitemap in `robots.txt`, a public IndexNow ownership key and a bulk IndexNow submission tool.
- IndexNow notifications sent to its shared endpoint are distributed among participating search engines. They notify search engines that a URL changed, but do not guarantee crawling, indexing or ranking.
- Bing's public results presented an automated-traffic challenge during the 10 August check, so no unsupported public ranking claim is recorded here. Exact Bing indexing, search-query and AI-answer visibility should be measured in the verified Bing Webmaster Tools property.
- The site's structured summaries, distinct collection pages and `llms.txt` help automated discovery systems understand what the service does. These are clarity measures, not a promise of inclusion in an AI answer.

## Search intent and page map

Use one strong page for each distinct church need. Do not create near-duplicate pages for spelling variations.

| Search intent | Natural phrases to cover | Best page |
| --- | --- | --- |
| Main service | worship word lyrics; worship lyric videos for churches; worship songs with words | Home page and `/guides/worship-word-lyrics/` |
| English churches | English worship songs with lyrics; church worship videos with words; hymns with lyrics | English language and arrangement collections |
| Churches without musicians | worship videos for churches without musicians; YouTube worship for small churches | Dedicated churches-without-musicians guide |
| Multilingual worship | multilingual worship songs with subtitles; translated worship songs; native-language worship videos with English subtitles | Language, presentation-format and multilingual-guide pages |
| Familiar songs across languages | Goodness of God in different languages; Way Maker translated worship; The Blessing multilingual worship | Curated song-family collection pages |
| Service preparation | church worship playlist; worship video start and stop times; church projection screen | Member features and second-screen guide |
| Styles and seasons | contemporary worship lyric videos; gospel songs with lyrics; choir worship videos; Christmas or Easter worship songs | Arrangement and church-season collection pages |

The exact phrase “worship word lyrics” is now present in the home-page title, main heading, explanatory copy, site-name structured data and a substantial dedicated guide. Related phrases appear only where they accurately describe visible content.

## What is implemented in the site

- More than 158 validated canonical pages in the current sitemap, each backed by visible catalogue information or original church guidance. The exact total is regenerated from the current catalogue during every production build.
- Descriptive home-page title, meta description, canonical URL, robots directives and large social share card.
- Schema.org `WebSite`, `Organization`, `WebApplication`, `CollectionPage`, `ItemList`, `BreadcrumbList`, `Article` and `HowTo` structured data where those types describe visible page content.
- Useful initial HTML before the React application loads, so crawlers that do not execute JavaScript can still understand the service and follow its main links.
- 98 substantial language collection pages generated from the current catalogue. Very small or unidentified language groups are not published as SEO pages.
- 11 worship-arrangement pages covering contemporary, gospel, choir, traditional hymn, live, acoustic and other useful styles.
- Six church-season pages for Advent, Christmas, Lent and Holy Week, Easter, Pentecost, Harvest and Thanksgiving.
- Six lyrics-and-subtitle-format pages that clearly distinguish English words, translated subtitles, native-language words, English subtitles and bilingual videos.
- Curated song-family pages cover hundreds of named-language word/subtitle videos. They include Goodness of God, Way Maker, The Blessing, Holy Forever, Living Hope, Here I Am to Worship, In Christ Alone and other familiar songs whose catalogue evidence supports at least three named languages.
- The live catalogue covers 52,337 unique playable videos across 114 named languages. Nineteen named-language collections now contain at least 500 playable videos. Focused language-depth searches look for familiar translated worship songs, native-language lyrics and native-language performances with English subtitles.
- Six original church guides covering worship word lyrics, churches without musicians, video selection, multilingual worship, second-screen projection and a careful fluent-speaker review process.
- Multilingual song-family counts exclude entries labelled **Language not stated**, rather than presenting an unknown language as a confirmed translation.
- The public finder now uses maintained YouTube audit titles as word evidence where the short catalogue title omits “lyrics” or “subtitles”. Its **Well-known songs** filter uses chart and multi-hymnal evidence rather than behaving like a duplicate words filter.
- XML sitemap, `robots.txt`, RSS feed, OpenSearch description, web app manifest and an explanatory `llms.txt` file.
- IndexNow integration for Bing and participating search engines.
- Crawlable internal links from the application footer and a small discovery section below the finder.
- URL parameters that open the application with the requested language, arrangement, presentation format or search phrase already selected.

## Important owner actions

These require ownership of external accounts and cannot be completed safely by application code alone.

### 1. Google Search Console

Completed on 9 August 2026:

- `worshipwordvideo.org` is registered as a Domain property.
- `https://www.worshipwordvideo.org/sitemap.xml` was submitted under **Sitemaps** and processed successfully, with 95 pages discovered.

Ongoing actions:

1. Inspect the home page, the Farsi collection and two or three guide pages, then request indexing.
2. Check indexing, Core Web Vitals, queries, impressions and click-through rate monthly.

### 2. Bing Webmaster Tools

1. Open [Bing Webmaster Tools](https://www.bing.com/webmasters/).
2. Import the verified site from Google Search Console or complete Bing's verification.
3. Confirm the sitemap and IndexNow submissions are being received.
4. Review **Search Performance**, **Site Explorer**, **URL Inspection**, **Recommendations** and the **AI Performance** preview each month.

### 3. Earn relevant links

Links should be genuine recommendations, never purchased or exchanged in bulk.

- Completed 9 August 2026: added a clear Worship Word Video link to the Faith section of the Kairos Housing resources page.
- Invite partner churches, Churches Together groups, dioceses, worship-training organisations and refugee or sanctuary networks to list the free tool in a resource page.
- Give church leaders a short explanation of the multilingual catalogue they can share in newsletters.
- Ask language-speaking worship leaders to review their collection and link to it when they find it useful.
- Use descriptive link text such as “free multilingual worship video finder”, rather than repeatedly using an exact commercial keyword phrase.

The exact Kairos copy, priority organisations and a reusable outreach message are in [BACKLINK_OUTREACH.md](./BACKLINK_OUTREACH.md).

### 4. Publish useful updates

- Add one genuinely helpful guide or language spotlight each month.
- Prioritise questions church leaders actually ask: licensing, projection, translated subtitles, service preparation and accessible worship.
- Invite named native-language reviewers and document the review date. This improves trust and catalogue quality as well as search usefulness.
- Update a page's sitemap date only when its visible content meaningfully changes.

## Measures that matter

- Indexed pages and any indexing errors.
- Non-branded search impressions.
- Click-through rate for language and guide pages.
- Searches that lead visitors into the catalogue.
- Returning churches and saved playlists.
- Broken or reported videos and the time taken to correct them.

## Practices to avoid

- Keyword stuffing, invisible text, misleading titles or pages made only to rank.
- Thousands of near-duplicate pages with no useful information.
- Copying song lyrics, articles or church resources without permission.
- Buying backlinks, automated directory submissions or mass comment links.
- Claiming that every translation has been linguistically or theologically approved when it has not.

Search engines do not guarantee ranking or indexing. The durable approach is clear technical access, genuinely useful pages, trustworthy catalogue data, recommendations from relevant organisations and steady improvement informed by Search Console.
