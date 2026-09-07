# Worship Word Video — risk assessment

Date reviewed: 7 September 2026

This is a practical product risk assessment, not legal advice. It should be reviewed by a UK copyright or data-protection adviser before a large public launch.

## Overall position

The safest description of the service is: **a free directory and playlist tool that links to and embeds YouTube videos**. It should not describe itself as a lyrics publisher, a music streaming service, or as affiliated with YouTube or CCLI.

The present direction is lower risk because the app stores video metadata and YouTube IDs, uses YouTube's privacy-enhanced player, does not download or re-host recordings, and now prevents people from pasting lyrics into custom catalogue entries.

## Risk register

| Risk | Level | Why it matters | Required control |
| --- | --- | --- | --- |
| Copying modern song lyrics into the app | High | Lyrics are normally protected as literary works. Being free or charitable does not itself create permission. | Do not host modern lyrics unless a written licence expressly covers this website. Keep the product as a video-link finder. Public-domain lyrics require a documented rights check. |
| Linking to unauthorised YouTube re-uploads | Medium–high | A video being visible on YouTube does not prove that the uploader owns it. Rights holders can block or remove embeds. | Prefer official artist, publisher, church or ministry channels; record the source channel; provide a report/removal route; remove disputed links promptly. Never download or re-upload a video. |
| Showing embedded videos in church services | Medium | The website can provide the tool, but a church's public performance, copying, projection and streaming permissions depend on its licences and intended use. | State clearly that each church is responsible for suitable CCLI/PPL PRS or other permissions and reporting. Do not claim that using this app makes a service licensed. |
| CCLI names, rankings and data | Medium | CCLI is a third-party service and brand. A chart snapshot can become stale and extensive copying may raise contractual/database issues. | Identify the snapshot date and source, link to CCLI, use only necessary factual metadata, and state there is no affiliation or endorsement. Do not reproduce SongSelect lyrics. |
| YouTube terms, branding and player behaviour | Medium | Embedded-player terms apply. Uploaders may turn embedding off, videos can gain ads or restrictions, and playback may fail. | Use the official embed player, preserve YouTube controls/links and referer, do not suppress ads or claim “ad-free”, and offer “Watch on YouTube” as a fallback. |
| Legacy account email data | Medium | Earlier account records may remain personal data even though the public planner no longer uses accounts. | Do not expose or reuse legacy member data. Retain it only for a documented purpose and period, honour deletion requests, and securely delete it when no longer needed. |
| Legacy administrator access | Medium–high | A dormant administration route or credential can still expose legacy account data. | Keep legacy administration out of the public bundle, retain server-side role enforcement and MFA while records exist, and remove the backend and credentials when the retention decision is complete. |
| YouTube cookies and international data transfers | Medium | Privacy-enhanced mode reduces personalisation but does not remove all third-party requests. | Explain the YouTube embed in the privacy/cookie notice. Assess whether consent controls are required under current PECR/DUAA guidance before adding analytics or marketing cookies. |
| User-added links and metadata | Medium | Users may add unlawful, misleading or inappropriate material locally or to future shared catalogues. | Add acceptable-use wording, a reporting contact, moderation for any shared submissions, and a repeat-infringer/removal process. |
| Charity donation presentation | Medium | Donors must understand which charity receives the money and how it reaches it. | Link directly to the official donation page, name Kairos Housing and its registered charity number, say the gift is optional, disclose any fees, and obtain the charity's approval for “on behalf of” fundraising wording. |
| Donation presentation | Low | Even a legitimate appeal can reduce trust if it interrupts a visitor before they receive value. | Do not show a donation popup. Keep one quiet, clearly optional Kairos link in the footer and never interrupt planning or playback. |
| International catalogue labelling | Low–medium | Wrong language, region or denomination labels could mislead or cause offence. Automated search cannot reliably judge theology, translation quality or whether every word is visible. | Store language and region separately, preserve the source title/channel, label metadata checks honestly, distinguish title-indicated lyrics from manually verified words, invite corrections, and require native-speaker/church-leader review before public use. “Nigerian” must not be treated as one language. |
| Start/stop timing and second-screen playback | Low–medium | Browser autoplay, popup, fullscreen and multi-screen permissions vary. YouTube seeks to nearby keyframes, so a requested start may not be frame-exact. | Keep YouTube controls available, describe timing as approximate, open only one reusable projection window from a user click, provide a simple manual move/fullscreen fallback, and preview the complete service playlist before use. |

## Immediate launch conditions

1. Decide and document a retention period for legacy account records, then remove records and administration infrastructure that are no longer required.
2. Keep the plain-English privacy notice and a legacy data-deletion contact route while any account data remains.
3. Add a copyright/report-content contact and removal procedure.
4. Continue native-speaker review of international links for language, theology and visible words. Availability and metadata checks are not a substitute; do not copy lyrics into the catalogue.
5. Ask Kairos Housing to approve the donation wording and verify the official charity name/number and destination link periodically.
6. Require MFA and audit logging for any administrator who can still access legacy records or catalogue-wide publishing controls.

## Sources used

- UK Intellectual Property Office: <https://www.gov.uk/copyright>
- UK guidance on using copyright material: <https://www.gov.uk/using-somebody-elses-intellectual-property/copyright>
- UK guidance on copyright ownership of music and lyrics: <https://www.gov.uk/guidance/ownership-of-copyright-works>
- YouTube Help — embedding and Privacy Enhanced Mode: <https://support.google.com/youtube/answer/171780>
- CCLI UK Streaming Licences: <https://ccli.com/uk/en/streaming>
- ICO — the right to be informed: <https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/>
- Charity Commission — raising money for charity: <https://www.gov.uk/guidance/raising-money-for-charity-public-guidance>
- Fundraising Regulator — online fundraising guidance: <https://www.fundraisingregulator.org.uk/about-fundraising/resources/guidance-online-fundraising-platforms>

## Product decisions already applied

- YouTube embeds use `youtube-nocookie.com`.
- The application does not download or host YouTube media.
- Custom song forms no longer accept copied lyrics.
- International entries store metadata, language, region and source channel only.
- The catalogue contains 72,965 unique playable links across 114 named languages. Newly imported leads required uploader wording for lyrics, words or subtitles, worship-song context, a service-length duration and a fresh YouTube embed metadata response; this still does not mean the words or theology were manually verified.
- Exact-video arrangement and language-format labels are visible in search results and detail views. Unclear language leads say “Language not stated” rather than inheriting an unsupported search-language claim.
- International detail pages advise a native speaker or church leader to review words and theology before public use.
- A separate familiar-song collection links local-language, translated or subtitled versions to a verified English song identity for search, without reproducing lyrics.
- The donation prompt has been removed. A single quiet footer link explains that giving is optional.
- Public service plans are stored locally in the visitor's browser and do not require an account.
- Legacy account and administrator code is not loaded by the public application.
- A public Terms, Privacy and Copyright centre explains acceptable use, church licensing duties, third-party services, liability limits and the charity relationship.
- The public app contains no account creation or login journey.
- A documented content-reporting and takedown route uses `hello@worshipwordvideo.org`, which forwards to the operator.
- The selected YouTube privacy-enhanced player loads directly so planning is not interrupted by a separate consent gate. The privacy notice explains this third-party request; the app does not add advertising or marketing analytics, and the PECR/DUAA consent position should be reviewed if that changes.
- Playlist trim points use YouTube's supported `start` and `end` parameters and warn that seeking may begin near the closest keyframe.
- Projection uses a clean, dedicated URL plus browser storage/BroadcastChannel synchronisation, and keeps the operator dashboard off the projected window.
