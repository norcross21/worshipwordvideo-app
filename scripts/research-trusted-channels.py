#!/usr/bin/env python3
"""Discover word videos from channels already proven useful to the catalogue.

The script reads public YouTube upload metadata only. It does not download
audio, video or lyrics. Output is a temporary research cache which must pass
the separate importer and its stricter quality rules before publication.
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from yt_dlp import YoutubeDL


OUTPUT = Path("/tmp/wwv-trusted-channel-videos.json")
RESULTS_PER_CHANNEL = 1000

# Each source was selected only after several existing uploads independently
# matched worship + words/subtitle checks. A source is not an automatic
# approval: every upload is screened again by the importer.
TRUSTED_CHANNELS = [
    ("https://www.youtube.com/@JesusWorship_ua", "Jesus Worship"),
    ("https://www.youtube.com/@ChristianWorshipLyricVideos", "Christian Worship Lyric Videos"),
    ("https://www.youtube.com/@sunday7choir", "Sunday 7pm Choir | Catholic & Christian Choral Music"),
    ("https://www.youtube.com/@hillsongworship", "Hillsong Worship"),
    ("https://www.youtube.com/@jpccworship", "JPCC Worship"),
    ("https://www.youtube.com/@MaranathaMusicOfficial", "Maranatha! Music"),
    ("https://www.youtube.com/@elevationworship", "Elevation Worship"),
    ("https://www.youtube.com/@streamofpraise", "讚美之泉 Stream Of Praise Music Ministries"),
    ("https://www.youtube.com/@polishworshipunited", "Polish Worship United"),
    ("https://www.youtube.com/@ChristianMusic1225", "Christian Music"),
    ("https://www.youtube.com/@Enjatula", "Crispus Gospel Lyrics"),
    ("https://www.youtube.com/@lugandahymns", "Luganda Hymns"),
    ("https://www.youtube.com/@DivineHymns", "Divine Hymns"),
    ("https://www.youtube.com/@ReawakenHymns", "Reawaken Hymns"),
    ("https://www.youtube.com/@ExtendedLifeWorship", "Extended Life Worship"),
    ("https://www.youtube.com/@arthurguerreroparaiso", "Memories of Praise"),
    ("https://www.youtube.com/@ChristianSongs-Dra", "Christian Songs"),
    ("https://www.youtube.com/@gospelrelaytv", "Gospel Relay TV"),
    ("https://www.youtube.com/@TOX-TV", "TOX TV Gospel"),
    ("https://www.youtube.com/@integritymusic", "Integrity Music"),
    ("https://www.youtube.com/@malayalamchristiansongs-sa2577", "Malayalam Christian Songs - Santhwanam Audios"),
    ("https://www.youtube.com/@dworshipmusic", "D.WORSHIP"),
    ("https://www.youtube.com/@easyworshipresources7956", "Easy Worship Resources"),
    ("https://www.youtube.com/@staceyplayshymns", "Stacey Plays Hymns"),
    ("https://www.youtube.com/@irJesus-rr7kx", "i.r. Jesus"),
    ("https://www.youtube.com/@biblicalchurchrevivalmovement", "Biblical Church Revival Movement in Cambodia"),
    ("https://www.youtube.com/@hymnsinstrumental1021", "Hymns Instrumental"),
    ("https://www.youtube.com/@PraisingAdonai", "Praise Adonai"),
    ("https://www.youtube.com/@thechristlyricstv7078", "The Christ Lyrics TV"),
    ("https://www.youtube.com/@SerialWorshipper", "Worship Videos (Louange et Adoration)"),
    ("https://www.youtube.com/@LIFEWorship", "LIFE Worship"),
    ("https://www.youtube.com/@singandpraisehymns", "Sing and Praise Hymns"),
    ("https://www.youtube.com/@gracebibleadell", "Grace Bible Church - Adell"),
    ("https://www.youtube.com/@BethelMusic", "Bethel Music"),
    ("https://www.youtube.com/@AaronAhiaWorship", "AaronAhia Worship"),
    ("https://www.youtube.com/@tagalogenglishpraiseandwor7380", "Tagalog & English Praise and Worship Lyric Videos"),
    ("https://www.youtube.com/@SongofSolomonMinistries", "Song of Solomon Ministries"),
    ("https://www.youtube.com/@ShilohWorshipMusic", "Shiloh Worship Music"),
    ("https://www.youtube.com/@Jesus_Christ_Production_7", "Jesus Christ Production"),
    ("https://www.youtube.com/@sing_for_christ_karaokes", "Sing For Christ Karaokes"),
    ("https://www.youtube.com/@CLMmusic3", "Praise The Lord - CLM Music"),
    ("https://www.youtube.com/@universalchurchsweden4415", "Universal Church Sweden"),
    ("https://www.youtube.com/@JCTGBTGMISOfficial", "Jesus Christ To God Be The Glory Church Int'l Main"),
    ("https://www.youtube.com/@christiansongslyrics4324", "Christian Songs Lyrics"),
    ("https://www.youtube.com/@MFJMusicForJesus-ji8tb", "MFJ - Music For Jesus"),
    ("https://www.youtube.com/@JesusCultureOfficial", "Jesus Culture"),
    ("https://www.youtube.com/@vlyricschurchhymns8084", "V Lyrics Church Hymns"),
    ("https://www.youtube.com/@bilingualpraiseyadoracion950", "Bilingual Karaoke: English & Spanish Worship"),
    ("https://www.youtube.com/@myanmarworshipsonggospelmu1589", "Myanmar Worship song & Gospel Music Channel"),
    ("https://www.youtube.com/@StoneFamilyChurch", "SFCH Worship"),
    ("https://www.youtube.com/@HillsongWorshipResources", "Hillsong Worship Resources"),
    ("https://www.youtube.com/@worshipbrasil9541", "Worship Brasil"),
]


def research_channel(source: tuple[str, str]) -> tuple[str, list[dict], str | None]:
    url, expected_name = source
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "playlistend": RESULTS_PER_CHANNEL,
        "ignoreerrors": True,
        "nocheckcertificate": True,
        "extractor_retries": 2,
    }
    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(f"{url.rstrip('/')}/videos", download=False) or {}
        channel = str(info.get("channel") or expected_name).strip()
        rows = []
        for entry in info.get("entries") or []:
            if not entry:
                continue
            rows.append({
                "youtubeId": entry.get("id"),
                "sourceTitle": entry.get("title"),
                "sourceChannel": channel,
                "durationSeconds": entry.get("duration"),
                "viewCountAtReview": entry.get("view_count"),
                "channelUrl": url,
            })
        return expected_name, rows, None
    except Exception as error:  # Network failures are reported, never hidden.
        return expected_name, [], str(error)


def main() -> None:
    rows: list[dict] = []
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(research_channel, source) for source in TRUSTED_CHANNELS]
        for future in as_completed(futures):
            channel, discovered, error = future.result()
            rows.extend(discovered)
            results.append({"channel": channel, "videos": len(discovered), "error": error})

    OUTPUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "output": str(OUTPUT),
        "channels_checked": len(TRUSTED_CHANNELS),
        "channels_returning_metadata": sum(not result["error"] for result in results),
        "video_metadata_rows": len(rows),
        "errors": [result for result in results if result["error"]],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
