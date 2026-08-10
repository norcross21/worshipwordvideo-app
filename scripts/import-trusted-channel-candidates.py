#!/usr/bin/env python3
"""Publish the best current word videos found on trusted worship channels.

This is deliberately stricter than a YouTube search import. Every accepted row
must have a current public video ID, uploader metadata, service-length duration,
on-screen word/subtitle evidence in its title and worship context. Spoken,
secular, compilation and unrelated devotional results are rejected.
"""

from __future__ import annotations

import importlib.util
import json
import math
import re
from collections import defaultdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "data" / "researchedWordWorshipVideos.json"
SOURCE = Path("/tmp/wwv-trusted-channel-videos.json")
MAX_PER_CHANNEL = 400
MIN_VIEWS = 25

SPEC = importlib.util.spec_from_file_location("catalogue_research", ROOT / "scripts" / "research-worship-catalogue.py")
assert SPEC and SPEC.loader
research = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(research)
TARGET = research.TARGET

# Conservative defaults for channels whose catalogue has a clear primary
# language. Mixed-language channels remain unstated unless the title itself
# identifies the language.
CHANNEL_LANGUAGE: dict[str, tuple[str, str, str]] = {
    "Jesus Worship": ("Ukrainian / Russian", "und", "Ukraine / Eastern Europe"),
    "Christian Worship Lyric Videos": ("English", "en", "United Kingdom / international"),
    "Sunday 7pm Choir | Catholic & Christian Choral Music": ("English", "en", "United Kingdom / international"),
    "Hillsong Worship": ("English", "en", "United Kingdom / international"),
    "Worship Jamz": ("Tagalog / Filipino", "tl", "Philippines"),
    "JPCC Worship": ("Indonesian", "id", "Indonesia"),
    "Maranatha! Music": ("English", "en", "United Kingdom / international"),
    "Elevation Worship": ("English", "en", "United Kingdom / international"),
    "讚美之泉 Stream Of Praise Music Ministries": ("Mandarin Chinese", "zh", "China / Taiwan / diaspora"),
    "Polish Worship United": ("Polish", "pl", "Poland"),
    "Christian Music": ("Tagalog / Filipino", "tl", "Philippines"),
    "Crispus Gospel Lyrics": ("Luganda", "lg", "Uganda"),
    "Luganda Hymns": ("Luganda", "lg", "Uganda"),
    "Divine Hymns": ("English", "en", "United Kingdom / international"),
    "Reawaken Hymns": ("English", "en", "United Kingdom / international"),
    "Extended Life Worship": ("English", "en", "United Kingdom / international"),
    "Memories of Praise": ("English", "en", "International"),
    "Christian Songs": ("English", "en", "International"),
    "TOX TV Gospel": ("Zulu", "zu", "South Africa"),
    "Integrity Music": ("English", "en", "United Kingdom / international"),
    "Malayalam Christian Songs - Santhwanam Audios": ("Malayalam", "ml", "India"),
    "D.WORSHIP": ("Ukrainian", "uk", "Ukraine"),
    "Easy Worship Resources": ("English", "en", "United Kingdom / international"),
    "Stacey Plays Hymns 🎵": ("English", "en", "United Kingdom / international"),
    "i.r. Jesus": ("Persian / Farsi", "fa", "Iran / Persian diaspora"),
    "Biblical Church Revival Movement in Cambodia": ("Khmer", "km", "Cambodia"),
    "Hymns Instrumental": ("English", "en", "United Kingdom / international"),
    "Praise Adonai": ("Language not stated", "und", "International / verify before use"),
    "The Christ Lyrics TV": ("Hausa", "ha", "Nigeria / West Africa"),
    "Worship Videos (Louange et Adoration)": ("French", "fr", "France / Francophone world"),
    "Sing and Praise Hymns": ("Language not stated", "und", "International / verify before use"),
    "Grace Bible Church - Adell": ("English", "en", "United Kingdom / international"),
    "Bethel Music": ("English", "en", "United Kingdom / international"),
    "AaronAhia Worship": ("Lingala", "ln", "Central Africa / diaspora"),
    "Tagalog & English Praise and Worship Lyric Videos": ("Language not stated", "und", "Philippines / international"),
    "Song of Solomon Ministries": ("English", "en", "International"),
    "Shiloh Worship Music": ("Swahili", "sw", "East Africa"),
    "Jesus Christ Production": ("Punjabi / Hindi", "und", "Pakistan / India / diaspora"),
    "Sing For Christ Karaokes": ("Marathi", "mr", "India"),
    "Praise The Lord - CLM Music": ("Gujarati", "gu", "India"),
    "Universal Church Sweden": ("Swedish", "sv", "Sweden"),
    "Jesus Christ To God Be The Glory Church Int'l Main": ("Tagalog / Filipino", "tl", "Philippines"),
    "Christian Songs Lyrics": ("Kannada", "kn", "India"),
    "Jesus Culture": ("English", "en", "United Kingdom / international"),
    "V Lyrics Church Hymns": ("Marathi", "mr", "India"),
    "Bilingual Karaoke: English & Spanish Worship": ("Spanish", "es", "Spain / Latin America"),
    "Myanmar Worship song & Gospel Music Channel": ("Burmese / Myanmar", "my", "Myanmar / diaspora"),
    "SFCH Worship": ("English", "en", "United Kingdom / international"),
    "Hillsong Worship Resources": ("English", "en", "United Kingdom / international"),
    "Worship Brasil": ("Portuguese", "pt", "Brazil / Portugal"),
}

EXCLUDED_CHANNELS = {
    "AlmightyGod Believers Church",
    "Christian Love Songs",
    "SZABO MUSIC-Hymn&Old Song Singalong",
    "Top Gospel Mix",
    "Worship Rehearsal Videos",
    "Worship Jamz",
}

NON_SONG = re.compile(
    r"\b(?:sermons?|debates?|podcasts?|interviews?|bible stud(?:y|ies)|documentar(?:y|ies)|apologetics|"
    r"lectures?|testimon(?:y|ies)|news reports?|tutorials?|how to play|reading|devotional|meditation|"
    r"affirmation|prayer for|spoken word|message|behind the scenes|reaction|teaser|trailer|episode|vlog|"
    r"full album|playlist|compilation|mix|medley|nonstop|live\s*stream|radio|karaoke only|accompaniment only|"
    r"birthday|national anthem|school song|military hymn|the marines.? hymn|hymn for the weekend|"
    r"jingle bells|rudolph|frosty|santa|deck the halls|holly jolly|let it snow|bhakti|shiva|krishna|"
    r"quran|nasheed|bollywood|romantic song|love song|movie soundtrack|film song)\b",
    re.I,
)


def cleaned_base_rows() -> list[list[object]]:
    loaded: list[list[object]] = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else []
    cleaned: list[list[object]] = []
    for loaded_row in loaded:
        row = list(loaded_row)
        title, channel = str(row[1]), str(row[2])
        duration = int(row[9] or 0)
        if (
            channel in EXCLUDED_CHANNELS
            or NON_SONG.search(f"{title} {channel}")
            or not research.word_evidence(title)
            or not research.is_existing_quality_row(title, channel, str(row[3]), str(row[4]))
            or (duration and (duration < 75 or duration > 900))
        ):
            continue
        row[6] = research.arrangement(title, channel)
        row[7] = research.presentation(title, str(row[3])) if str(row[3]) != "Language not stated" else "Words or subtitles indicated"
        cleaned.append(row)
    return cleaned


def explicitly_named_language(title: str) -> tuple[str, str, str] | None:
    lowered = title.lower()
    for language, code, region in research.LANGUAGES:
        if language == "English":
            continue
        aliases = [part.strip().lower() for part in language.split("/")]
        if any(re.search(rf"\b{re.escape(alias)}\b", lowered) for alias in aliases):
            return language, code, region
    return None


def language_for(title: str, channel: str) -> tuple[str, str, str]:
    explicit = explicitly_named_language(title)
    if explicit:
        return explicit
    if channel == "Worship Videos (Louange et Adoration)" and re.search(r"\bwith lyrics?\b", title, re.I):
        return "English", "en", "United Kingdom / international"
    return CHANNEL_LANGUAGE.get(channel, ("Language not stated", "und", "International / verify before use"))


def quality_score(row: dict) -> float:
    title = str(row.get("sourceTitle") or "")
    views = int(row.get("viewCountAtReview") or 0)
    score = math.log10(views + 1) * 3
    if re.search(r"official (?:lyric|lyrics)|official lyrics? (?:video|mv)", title, re.I):
        score += 8
    if re.search(r"subtitles?|translated|translation|bilingual|english\s*[/&+-]", title, re.I):
        score += 5
    if re.search(r"lyrics?|paroles|letras?|tekst|karaoke|words", title, re.I):
        score += 3
    return score


def eligible_candidates(existing_ids: set[str]) -> dict[str, list[dict]]:
    if not SOURCE.exists():
        raise SystemExit("Run `npm run catalogue:research:channels` first; the trusted-channel research cache is missing.")
    rows: list[dict] = json.loads(SOURCE.read_text(encoding="utf-8"))
    by_id: dict[str, dict] = {}
    for row in rows:
        video_id = str(row.get("youtubeId") or "")
        title = str(row.get("sourceTitle") or "").strip()
        channel = str(row.get("sourceChannel") or "").strip()
        duration = int(row.get("durationSeconds") or 0)
        views = int(row.get("viewCountAtReview") or 0)
        if (
            not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id)
            or video_id in existing_ids
            or channel in EXCLUDED_CHANNELS
            or not title
            or not channel
            or not research.word_evidence(title)
            or research.REJECT.search(title)
            or NON_SONG.search(f"{title} {channel}")
            or not research.is_quality_row(title, channel, "Language not stated", "und")
            or duration < 75
            or duration > 900
            or views < MIN_VIEWS
        ):
            continue
        current = by_id.get(video_id)
        if current is None or quality_score(row) > quality_score(current):
            by_id[video_id] = row

    buckets: dict[str, list[dict]] = defaultdict(list)
    for row in by_id.values():
        buckets[str(row["sourceChannel"]).strip()].append(row)
    for bucket in buckets.values():
        bucket.sort(key=quality_score, reverse=True)
        del bucket[MAX_PER_CHANNEL:]
    return buckets


def main() -> None:
    base_rows = cleaned_base_rows()
    non_research_ids = research.existing_video_ids()
    seen = non_research_ids | {str(row[0]) for row in base_rows}
    buckets = eligible_candidates(seen)

    selected: list[dict] = []
    channel_order = sorted(buckets, key=lambda channel: (-len(buckets[channel]), channel.lower()))
    while len(base_rows) + len(selected) < TARGET:
        added = False
        for channel in channel_order:
            bucket = buckets[channel]
            while bucket and str(bucket[0]["youtubeId"]) in seen:
                bucket.pop(0)
            if not bucket:
                continue
            row = bucket.pop(0)
            seen.add(str(row["youtubeId"]))
            selected.append(row)
            added = True
            if len(base_rows) + len(selected) >= TARGET:
                break
        if not added:
            break

    rows = list(base_rows)
    for item in selected:
        video_id = str(item["youtubeId"])
        title = str(item["sourceTitle"]).strip()
        channel = str(item["sourceChannel"]).strip()
        language, code, region = language_for(title, channel)
        presentation = (
            "Bilingual vocal or subtitles"
            if channel == "Bilingual Karaoke: English & Spanish Worship"
            else research.presentation(title, language)
            if language != "Language not stated"
            else "Words or subtitles indicated"
        )
        rows.append([
            video_id,
            title,
            channel,
            language,
            code,
            region,
            research.arrangement(title, channel),
            presentation,
            research.word_evidence(title),
            int(item["durationSeconds"]),
            date.today().isoformat(),
            None,
            int(item.get("viewCountAtReview") or 0),
        ])

    OUTPUT.write_text(json.dumps(rows[:TARGET], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    visible_languages = {str(row[3]) for row in rows[:TARGET] if str(row[3]) != "Language not stated"}
    print(json.dumps({
        "base_rows_after_cleanup": len(base_rows),
        "eligible_direct_channel_videos": sum(len(bucket) for bucket in eligible_candidates(non_research_ids).values()),
        "imported": len(rows[:TARGET]) - len(base_rows),
        "selected": len(rows[:TARGET]),
        "explicit_languages": len(visible_languages),
        "target_reached": len(rows) >= TARGET,
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
