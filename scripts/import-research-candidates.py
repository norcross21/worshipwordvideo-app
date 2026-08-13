#!/usr/bin/env python3
"""Import the best unused videos from prior deep-research candidate caches.

Only exact video IDs, uploader metadata and catalogue labels are retained. Each
selected link is rechecked in YouTube's embedded player; no media or lyrics are copied.
"""

from __future__ import annotations

import importlib.util
import json
import math
import re
import ssl
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "data" / "researchedWordWorshipVideos.json"
SOURCE_PATHS = [
    Path("/tmp/modern-word-video-deep-candidates.json"),
    Path("/tmp/modern-word-video-candidates.json"),
    Path("/tmp/expanded-familiar-video-candidates.json"),
    Path("/tmp/expanded-familiar-video-candidates-english-deep.json"),
    Path("/tmp/global-word-video-candidates.json"),
    Path("/tmp/global-word-video-candidates-pass2.json"),
    Path("/tmp/global-word-video-shortlist.json"),
    Path("/tmp/wwv-expanded-search-candidates.json"),
    Path("/tmp/wwv-channel-feed-candidates.json"),
    Path("/tmp/wwv-channel-html-candidates.json"),
    Path("/tmp/wwv-search-html-candidates.json"),
    Path("/tmp/wwv-language-depth-candidates.json"),
    Path("/tmp/wwv-trusted-channel-videos.json"),
]
CHANNEL_PAGE_SOURCE_PATHS = [
    Path("/tmp/wwv-channel-page-videos.json"),
    Path("/tmp/wwv-channel-page-videos-more.json"),
    Path("/tmp/wwv-expanded-channel-candidates.json"),
]
REVIEWED_CHANNEL_LANGUAGE_PATHS = {
    Path("/tmp/wwv-expanded-channel-candidates.json"),
}
MIN_CHANNEL_PAGE_VIEWS = 100

# These candidates were found through a named-language query, but YouTube's
# live title/channel did not prove that language at publication time. Keeping
# the IDs out avoids turning a search hint into a public language claim.
UNPROVEN_LANGUAGE_IDS = {
    "XRW-jr_PnbQ", "kcH3fdzz6C0", "END-D8LQdAw", "kCoAj5_XyJw",
    "nvomYTQ4YNI", "VJlid7N8_5Y", "abXgYvt-UR8", "TrkL0Pp62XE",
    "gMU6ly5qbgM", "tOKiVeefkek", "bxwIpxBni6s", "EvoNENHJy9U",
    "zWhcUC1oG-8", "K-ZtjvMstOM", "_ZfxI4eNGdA", "DcD_iE2vvCc",
    "KR4iZmae2P8", "1Yzvn2hqAEI", "2FBDpUvM5Rs", "QZ8g2xFMgQQ",
    "08gpDal90So",
}

SCRIPT_LANGUAGE_DEFAULTS: list[tuple[re.Pattern[str], tuple[str, str, str]]] = [
    (re.compile(r"[\uac00-\ud7af]"), ("Korean", "ko", "South Korea / diaspora")),
    (re.compile(r"[\u3040-\u30ff]"), ("Japanese", "ja", "Japan")),
    (re.compile(r"[\u0e00-\u0e7f]"), ("Thai", "th", "Thailand")),
    (re.compile(r"[\u0530-\u058f]"), ("Armenian", "hy", "Armenia / diaspora")),
    (re.compile(r"[\u10a0-\u10ff]"), ("Georgian", "ka", "Georgia")),
    (re.compile(r"[\u0980-\u09ff]"), ("Bengali", "bn", "Bangladesh / India")),
    (re.compile(r"[\u0b80-\u0bff]"), ("Tamil", "ta", "India / Sri Lanka / diaspora")),
    (re.compile(r"[\u0c00-\u0c7f]"), ("Telugu", "te", "India")),
    (re.compile(r"[\u0c80-\u0cff]"), ("Kannada", "kn", "India")),
    (re.compile(r"[\u0d00-\u0d7f]"), ("Malayalam", "ml", "India / diaspora")),
    (re.compile(r"[\u0a80-\u0aff]"), ("Gujarati", "gu", "India / diaspora")),
    (re.compile(r"[\u0d80-\u0dff]"), ("Sinhala", "si", "Sri Lanka")),
    (re.compile(r"[\u0590-\u05ff]"), ("Hebrew", "he", "Israel / diaspora")),
    (re.compile(r"[\u1780-\u17ff]"), ("Khmer", "km", "Cambodia")),
    (re.compile(r"[\u0e80-\u0eff]"), ("Lao", "lo", "Laos")),
    (re.compile(r"[\u1000-\u109f]"), ("Burmese / Myanmar", "my", "Myanmar / diaspora")),
]

SPEC = importlib.util.spec_from_file_location("catalogue_research", ROOT / "scripts" / "research-worship-catalogue.py")
assert SPEC and SPEC.loader
research = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(research)
TARGET = research.TARGET
SSL_CONTEXT = ssl._create_unverified_context()

ITALIAN_FAMILIAR_ALIASES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"bont[aà]\s+di\s+dio", re.I), "Goodness of God"),
    (re.compile(r"che\s+(?:magnifico|bel|meraviglioso)\s+nome", re.I), "What a Beautiful Name"),
    (re.compile(r"(?:il\s+)?nostro\s+dio|dio\s+[eè]\s+grande", re.I), "Our God Is Greater"),
    (re.compile(r"lo\s+farai\s+ancora", re.I), "Do It Again"),
    (re.compile(r"cristo\s+muove\s+le\s+montagne", re.I), "Mighty to Save"),
    (re.compile(r"io\s+mi\s+arrendo", re.I), "Surrender"),
    (re.compile(r"(?:oceani|mare\s+profondo)", re.I), "Oceans (Where Feet May Fail)"),
    (re.compile(r"jireh", re.I), "Jireh"),
    (re.compile(r"million\s+little\s+miracles", re.I), "Million Little Miracles"),
    (re.compile(r"io\s+credo|questo\s+io\s+credo", re.I), "This I Believe (The Creed)"),
    (re.compile(r"(?:innalzo|alzo)\s+un\s+alleluia", re.I), "Raise a Hallelujah"),
    (re.compile(r"\bthe\s+blessing\b", re.I), "The Blessing"),
    (re.compile(r"worthy\s+is\s+the\s+lamb", re.I), "Worthy Is the Lamb"),
    (re.compile(r"behold\s+our\s+god", re.I), "Behold Our God"),
    (re.compile(r"grande\s+sei\s+tu", re.I), "How Great Thou Art"),
    (re.compile(r"o\s+lode\s+al\s+nome", re.I), "O Praise the Name (Anástasis)"),
]


def cached_candidates(path: Path) -> list[dict]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("candidates", []) if isinstance(data, dict) else data


def youtube_embed_metadata(video_id: str) -> dict | None:
    request = urllib.request.Request(
        f"https://www.youtube.com/embed/{video_id}",
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; WorshipWordVideoCatalogueResearch/1.0)",
            "Referer": "https://www.worshipwordvideo.org/",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15, context=SSL_CONTEXT) as response:
            page = response.read().decode("utf-8", "ignore")
        match = re.search(r'"embedded_player_response":"((?:\\.|[^"\\])*)"', page)
        if not match:
            return None
        player = json.loads(json.loads(f'"{match.group(1)}"'))
        status = player.get("previewPlayabilityStatus") or {}
        if status.get("status") != "OK" or status.get("playableInEmbed") is not True:
            return None
        preview = (player.get("embedPreview") or {}).get("thumbnailPreviewRenderer") or {}
        title_runs = (preview.get("title") or {}).get("runs") or []
        details = (preview.get("videoDetails") or {}).get("embeddedPlayerOverlayVideoDetailsRenderer") or {}
        expanded = (details.get("expandedRenderer") or {}).get("embeddedPlayerOverlayVideoDetailsExpandedRenderer") or {}
        channel_runs = (expanded.get("title") or {}).get("runs") or []
        title = "".join(str(run.get("text") or "") for run in title_runs).strip()
        channel = "".join(str(run.get("text") or "") for run in channel_runs).strip()
        duration = int(preview.get("videoDurationSeconds") or 0)
        return {"title": title, "author_name": channel, "durationSeconds": duration} if title and channel else None
    except Exception:
        return None


def candidate_score(item: dict) -> float:
    title = str(item.get("sourceTitle") or "")
    views = int(item.get("viewCountAtReview") or item.get("viewCount") or 0)
    rank = int(item.get("rank") or 100)
    score = math.log10(views + 1) * 2 - min(rank, 100) / 80
    if item.get("englishTitle") or item.get("title"):
        score += 2
    if research.has_language_signal(title, str(item.get("sourceChannel") or ""), str(item.get("language") or ""), str(item.get("languageCode") or "")):
        score += 4
    if any(word in title.lower() for word in ("official lyric", "subtitles", "translated", "translation", "with lyrics")):
        score += 2
    if re.search(r"english\s+(?:subtitles?|captions?|translation|lyrics?)|eng\s*sub", title, re.I):
        score += 6
    if item.get("sourceKind") == "channel-page":
        score += 1
    return score


def channel_language_defaults(votes: dict[str, Counter[tuple[str, str, str]]]) -> dict[str, tuple[str, str, str]]:
    defaults: dict[str, tuple[str, str, str]] = {}
    for channel, channel_votes in votes.items():
        non_english = Counter({key: count for key, count in channel_votes.items() if key[0] != "English"})
        if non_english:
            most_common, count = non_english.most_common(1)[0]
            if count >= 2 and count / sum(non_english.values()) >= 0.6:
                defaults[channel] = most_common
                continue
        english = next((key for key in channel_votes if key[0] == "English"), None)
        if english and channel_votes[english] >= 3:
            defaults[channel] = english
    return defaults


def language_from_unique_script(title: str) -> tuple[str, str, str] | None:
    return next((language for pattern, language in SCRIPT_LANGUAGE_DEFAULTS if pattern.search(title)), None)


def supported_familiar_title(source_title: str, familiar_title: str | None) -> str | None:
    if not familiar_title:
        return None
    normalise = lambda value: re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
    source = normalise(source_title)
    target = normalise(familiar_title)
    if not target:
        return None
    if target in source:
        return familiar_title
    stop = {"the", "and", "for", "with", "you", "your", "our", "are", "this", "that", "into"}
    tokens = [token for token in target.split() if len(token) > 2 and token not in stop]
    matched = sum(1 for token in tokens if token in source.split())
    return familiar_title if tokens and matched / len(tokens) >= 0.6 else None


def inferred_familiar_title(source_title: str, language: str) -> str | None:
    if language != "Italian":
        return None
    return next((english_title for pattern, english_title in ITALIAN_FAMILIAR_ALIASES if pattern.search(source_title)), None)


def explicitly_named_language(title: str) -> tuple[str, str, str] | None:
    lowered = title.lower()
    matches: list[tuple[str, str, str]] = []
    for language, code, region in research.LANGUAGES:
        if language == "English":
            continue
        aliases = [part.strip().lower() for part in language.split("/")]
        if any(re.search(rf"\b{re.escape(alias)}\b", lowered) for alias in aliases):
            matches.append((language, code, region))
    return matches[0] if len(matches) == 1 else None


def main() -> None:
    selected_language = next((value.split("=", 1)[1] for value in sys.argv if value.startswith("--language=")), None)
    selected_languages = {
        value.strip().casefold()
        for value in (selected_language or "").split(",")
        if value.strip()
    }
    existing_source_ids = research.existing_video_ids()
    reviewed_channel_languages = {
        str(item.get("youtubeId") or ""): (
            str(item.get("language") or "Language not stated"),
            str(item.get("languageCode") or "und"),
            str(item.get("region") or "International / verify before use"),
        )
        for path in REVIEWED_CHANNEL_LANGUAGE_PATHS
        for item in cached_candidates(path)
        if item.get("youtubeId") and item.get("language") not in {None, "Language not stated"}
    }
    base_rows = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else []
    base_rows = [
        row for row in base_rows
        if str(row[0]) not in UNPROVEN_LANGUAGE_IDS
        and research.word_evidence(str(row[1]))
        and research.is_existing_quality_row(str(row[1]), str(row[2]), str(row[3]), str(row[4]))
    ][:TARGET]
    for row in base_rows:
        if str(row[3]) == "Language not stated" and str(row[0]) in reviewed_channel_languages:
            row[3], row[4], row[5] = reviewed_channel_languages[str(row[0])]
        if str(row[3]) == "Language not stated":
            script_language = language_from_unique_script(str(row[1]))
            if script_language:
                row[3], row[4], row[5] = script_language
        row[6] = research.arrangement(str(row[1]), str(row[2]))
        if str(row[3]) != "Language not stated":
            row[7] = research.presentation(str(row[1]), str(row[3]))
        if len(row) > 11:
            row[11] = supported_familiar_title(str(row[1]), str(row[11]) if row[11] else None) \
                or inferred_familiar_title(str(row[1]), str(row[3]))
    if len(base_rows) >= TARGET:
        OUTPUT.write_text(json.dumps(base_rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(json.dumps({"selected": len(base_rows), "mode": "metadata-label cleanup"}, indent=2))
        return
    seen = existing_source_ids | {str(row[0]) for row in base_rows}
    candidates_by_id: dict[str, dict] = {}
    language_votes: dict[str, Counter[tuple[str, str, str]]] = defaultdict(Counter)

    for path in [*SOURCE_PATHS, *CHANNEL_PAGE_SOURCE_PATHS]:
        source_kind = "channel-page" if path in CHANNEL_PAGE_SOURCE_PATHS else "search-cache"
        for item in cached_candidates(path):
            video_id = str(item.get("youtubeId") or "")
            title = str(item.get("sourceTitle") or "").strip()
            channel = str(item.get("sourceChannel") or "").strip()
            duration_value = item.get("durationSeconds") or item.get("duration")
            duration = int(duration_value or 0)
            views = int(item.get("viewCountAtReview") or item.get("viewCount") or 0)
            evidence = research.word_evidence(title)
            if (
                video_id in seen
                or not evidence
                or not channel
                or research.REJECT.search(title)
                or not research.is_quality_row(title, channel, str(item.get("language") or ""), str(item.get("languageCode") or ""))
                or (duration and (duration < 75 or duration > 900))
                or (source_kind == "channel-page" and not duration)
                or (source_kind == "channel-page" and views < MIN_CHANNEL_PAGE_VIEWS)
            ):
                continue
            requested_language = str(item.get("language") or "Language not stated")
            if selected_languages and requested_language.casefold() not in selected_languages:
                continue
            requested_code = str(item.get("languageCode") or "und")
            requested_region = str(item.get("region") or "International / verify before use")
            reviewed_channel_language = (
                path in REVIEWED_CHANNEL_LANGUAGE_PATHS
                and requested_language != "Language not stated"
            )
            if source_kind == "search-cache" and requested_language != "Language not stated" and research.has_language_signal(
                title, channel, requested_language, requested_code
            ):
                language_votes[channel][(requested_language, requested_code, requested_region)] += 1
            candidate = {
                **item,
                "durationSeconds": duration,
                "wordEvidence": evidence,
                "sourceKind": source_kind,
                "reviewedChannelLanguage": reviewed_channel_language,
            }
            current = candidates_by_id.get(video_id)
            if current is None or candidate_score(candidate) > candidate_score(current):
                candidates_by_id[video_id] = candidate

    defaults = channel_language_defaults(language_votes)
    candidates = list(candidates_by_id.values())
    for item in candidates:
        if item.get("sourceKind") == "channel-page":
            if item.get("reviewedChannelLanguage"):
                language = str(item.get("language") or "Language not stated")
                code = str(item.get("languageCode") or "und")
                region = str(item.get("region") or "International / verify before use")
            else:
                language, code, region = defaults.get(
                    str(item.get("sourceChannel") or ""),
                    language_from_unique_script(str(item.get("sourceTitle") or ""))
                    or ("Language not stated", "und", "International / verify before use"),
                )
            item["language"] = language
            item["languageCode"] = code
            item["region"] = region

    candidates.sort(key=candidate_score, reverse=True)
    # Check extra candidates so transient metadata failures do not prevent the target.
    # Recheck a generous reserve because unavailable/blocked videos and stale
    # titles are discarded here. The larger pool also prevents high-volume
    # English channels from crowding smaller language collections out before
    # the round-robin selection stage.
    check_pool = candidates[: max(2400, TARGET - len(base_rows) + 8000)]
    metadata_by_id: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = {pool.submit(youtube_embed_metadata, str(item["youtubeId"])): item for item in check_pool}
        for future in as_completed(futures):
            metadata = future.result()
            if metadata:
                metadata_by_id[str(futures[future]["youtubeId"])] = metadata

    # Preserve language breadth by repeatedly taking one checked item per language.
    buckets: dict[str, list[dict]] = {}
    for item in check_pool:
        video_id = str(item["youtubeId"])
        if video_id not in metadata_by_id:
            continue
        metadata = metadata_by_id[video_id]
        verified_duration = int(metadata.get("durationSeconds") or 0)
        if verified_duration < 75 or verified_duration > 900:
            continue
        verified_title = str(metadata.get("title") or "").strip()
        verified_channel = str(metadata.get("author_name") or "").strip()
        requested_language = str(item.get("language") or "Language not stated")
        requested_code = str(item.get("languageCode") or "und")
        if (
            not research.word_evidence(verified_title)
            or not research.is_quality_row(verified_title, verified_channel, requested_language, requested_code)
        ):
            continue
        language = str(item.get("language") or "Language not stated")
        buckets.setdefault(language, []).append(item)

    selected: list[dict] = []
    language_order = sorted(buckets, key=lambda value: (value == "English", value))
    while len(base_rows) + len(selected) < TARGET:
        added = False
        for language in language_order:
            bucket = buckets[language]
            if bucket:
                selected.append(bucket.pop(0))
                added = True
                if len(base_rows) + len(selected) >= TARGET:
                    break
        if not added:
            break

    rows = list(base_rows)
    for item in selected:
        video_id = str(item["youtubeId"])
        metadata = metadata_by_id[video_id]
        title = str(metadata["title"]).strip()
        channel = str(metadata["author_name"]).strip()
        requested_language = str(item.get("language") or "Language not stated")
        code = str(item.get("languageCode") or "und")
        region = str(item.get("region") or "International / verify before use")
        channel_default = defaults.get(channel)
        named_language = explicitly_named_language(title)
        if named_language:
            language, code, region = named_language
            stated_language = True
        else:
            stated_language = requested_language != "Language not stated" and (
                research.has_language_signal(title, channel, requested_language, code)
                or bool(item.get("reviewedChannelLanguage"))
                or (item.get("sourceKind") == "channel-page" and channel_default == (requested_language, code, region))
            )
            language = requested_language if stated_language else "Language not stated"
            if not stated_language:
                # Search terms are discovery leads, never publication proof.
                # If the live title/channel no longer proves the requested
                # language, leave it out rather than exposing an unlabelled row.
                continue
        evidence = research.word_evidence(title)
        if not evidence:
            continue
        familiar_title = supported_familiar_title(title, str(item.get("englishTitle") or item.get("title") or "").strip() or None) \
            or inferred_familiar_title(title, language)
        views = int(item.get("viewCountAtReview") or item.get("viewCount") or 0)
        verified_duration = int(metadata.get("durationSeconds") or item["durationSeconds"])
        if verified_duration < 75 or verified_duration > 900:
            continue
        rows.append([
            video_id,
            title,
            channel,
            language,
            code,
            region,
            research.arrangement(title, channel),
            research.presentation(title, language) if stated_language else "Words or subtitles indicated",
            evidence,
            verified_duration,
            research.date.today().isoformat(),
            familiar_title,
            views,
        ])

    OUTPUT.write_text(json.dumps(rows[:TARGET], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "base_rows": len(base_rows),
        "eligible_unused_candidates": len(candidates),
        "youtube_metadata_checked": len(metadata_by_id),
        "imported": len(rows[:TARGET]) - len(base_rows),
        "selected": len(rows[:TARGET]),
        "explicit_languages": len({row[3] for row in rows[:TARGET] if row[3] != "Language not stated"}),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
