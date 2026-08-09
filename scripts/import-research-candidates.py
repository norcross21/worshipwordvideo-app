#!/usr/bin/env python3
"""Import the best unused videos from prior deep-research candidate caches.

Only exact video IDs, uploader metadata and catalogue labels are retained. Each
selected link is rechecked against YouTube oEmbed; no media or lyrics are copied.
"""

from __future__ import annotations

import importlib.util
import json
import math
import re
import ssl
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "data" / "researchedWordWorshipVideos.json"
TARGET = 2400
SOURCE_PATHS = [
    Path("/tmp/modern-word-video-deep-candidates.json"),
    Path("/tmp/modern-word-video-candidates.json"),
    Path("/tmp/expanded-familiar-video-candidates-english-deep.json"),
    Path("/tmp/global-word-video-candidates.json"),
    Path("/tmp/global-word-video-candidates-pass2.json"),
]

SPEC = importlib.util.spec_from_file_location("catalogue_research", ROOT / "scripts" / "research-worship-catalogue.py")
assert SPEC and SPEC.loader
research = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(research)
SSL_CONTEXT = ssl._create_unverified_context()


def cached_candidates(path: Path) -> list[dict]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("candidates", []) if isinstance(data, dict) else data


def youtube_metadata(video_id: str) -> dict | None:
    params = urllib.parse.urlencode({"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"})
    request = urllib.request.Request(
        f"https://www.youtube.com/oembed?{params}",
        headers={"User-Agent": "WorshipWordVideoCatalogueResearch/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=15, context=SSL_CONTEXT) as response:
            result = json.load(response)
            return result if result.get("title") and result.get("author_name") else None
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
    return score


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


def main() -> None:
    existing_source_ids = research.existing_video_ids()
    base_rows = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else []
    base_rows = base_rows[:TARGET]
    for row in base_rows:
        row[6] = research.arrangement(str(row[1]), str(row[2]))
        if str(row[3]) != "Language not stated":
            row[7] = research.presentation(str(row[1]), str(row[3]))
        if len(row) > 11:
            row[11] = supported_familiar_title(str(row[1]), str(row[11]) if row[11] else None)
    if len(base_rows) >= TARGET:
        OUTPUT.write_text(json.dumps(base_rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(json.dumps({"selected": len(base_rows), "mode": "metadata-label cleanup"}, indent=2))
        return
    seen = existing_source_ids | {str(row[0]) for row in base_rows}
    candidates: list[dict] = []

    for path in SOURCE_PATHS:
        for item in cached_candidates(path):
            video_id = str(item.get("youtubeId") or "")
            title = str(item.get("sourceTitle") or "").strip()
            channel = str(item.get("sourceChannel") or "").strip()
            duration_value = item.get("durationSeconds") or item.get("duration")
            duration = int(duration_value or 0)
            evidence = research.word_evidence(title)
            if (
                video_id in seen
                or not evidence
                or not channel
                or research.REJECT.search(title)
                or not research.is_quality_row(title, channel, str(item.get("language") or ""), str(item.get("languageCode") or ""))
                or not duration
                or duration < 75
                or duration > 900
            ):
                continue
            seen.add(video_id)
            candidates.append({**item, "durationSeconds": duration, "wordEvidence": evidence})

    candidates.sort(key=candidate_score, reverse=True)
    # Check extra candidates so transient metadata failures do not prevent the target.
    check_pool = candidates[: max(2400, TARGET - len(base_rows) + 500)]
    metadata_by_id: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(youtube_metadata, str(item["youtubeId"])): item for item in check_pool}
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
        stated_language = requested_language != "Language not stated" and research.has_language_signal(title, channel, requested_language, code)
        language = requested_language if stated_language else "Language not stated"
        evidence = research.word_evidence(title) or str(item["wordEvidence"])
        familiar_title = supported_familiar_title(title, str(item.get("englishTitle") or item.get("title") or "").strip() or None)
        views = int(item.get("viewCountAtReview") or item.get("viewCount") or 0)
        rows.append([
            video_id,
            title,
            channel,
            language,
            code if stated_language else "und",
            region if stated_language else "International / verify before use",
            research.arrangement(title, channel),
            research.presentation(title, requested_language) if stated_language else "Words or subtitles indicated",
            evidence,
            int(item["durationSeconds"]),
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
