#!/usr/bin/env python3
"""Rate-limit-friendly catalogue research through a public Invidious search API.

Search metadata is independently checked against YouTube oEmbed before a link
is written. No media or lyrics are downloaded or copied.
"""

from __future__ import annotations

import importlib.util
import json
import ssl
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "research-worship-catalogue.py"
SPEC = importlib.util.spec_from_file_location("catalogue_research", SOURCE)
assert SPEC and SPEC.loader
research = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(research)

API = "https://inv.zoomerville.com/api/v1/search"
OUTPUT = ROOT / "src" / "data" / "researchedWordWorshipVideos.json"
TARGET = 1800
SSL_CONTEXT = ssl._create_unverified_context()


def get_json(url: str, timeout: int = 25):
    request = urllib.request.Request(url, headers={"User-Agent": "WorshipWordVideoCatalogueResearch/1.0"})
    with urllib.request.urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
        return json.load(response)


def search(job: tuple[str, str, str, str, int]) -> tuple[str, str, str, list[dict]]:
    language, code, region, query, page = job
    params = urllib.parse.urlencode({"q": query, "type": "video", "page": page, "sort_by": "relevance"})
    try:
        result = get_json(f"{API}?{params}")
        return language, code, region, result if isinstance(result, list) else []
    except Exception:
        return language, code, region, []


def youtube_metadata_available(video_id: str) -> bool:
    params = urllib.parse.urlencode({"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"})
    try:
        result = get_json(f"https://www.youtube.com/oembed?{params}", timeout=15)
        return bool(result.get("title") and result.get("author_name"))
    except Exception:
        return False


def clean_existing(rows: list[list[object]]) -> list[list[object]]:
    cleaned: list[list[object]] = []
    for loaded in rows:
        row = list(loaded)
        if not research.is_quality_row(str(row[1]), str(row[2]), str(row[3]), str(row[4])):
            continue
        if str(row[3]) != "Language not stated" and not research.has_language_signal(str(row[1]), str(row[2]), str(row[3]), str(row[4])):
            row[3] = "Language not stated"
            row[4] = "und"
            row[5] = "International / verify before use"
            row[7] = "Words or subtitles indicated"
        row[6] = research.arrangement(str(row[1]), str(row[2]))
        if str(row[3]) != "Language not stated":
            row[7] = research.presentation(str(row[1]), str(row[3]))
        cleaned.append(row)
    return cleaned


def main() -> None:
    loaded = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else []
    rows = clean_existing(loaded)
    existing_ids = research.existing_video_ids() | {str(row[0]) for row in rows}
    candidates: dict[str, list[list[object]]] = {language: [] for language, _, _ in research.LANGUAGES}
    candidate_ids: set[str] = set()
    jobs: list[tuple[str, str, str, str, int]] = []
    for language, code, region in research.LANGUAGES:
        for page in range(1, 4):
            jobs.append((language, code, region, f"{language} Christian worship song lyrics lyric video", page))
            jobs.append((language, code, region, f"modern Christian worship songs {language} subtitles lyric video", page))
            jobs.append((language, code, region, f"{language} gospel lyric video lyrics", page))

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(search, job) for job in jobs]
        for future in as_completed(futures):
            language, code, region, entries = future.result()
            for entry in entries:
                video_id = str(entry.get("videoId") or "")
                title = str(entry.get("title") or "").strip()
                channel = str(entry.get("author") or "").strip()
                duration = int(entry.get("lengthSeconds") or 0)
                evidence = research.word_evidence(title)
                if (
                    video_id in existing_ids
                    or video_id in candidate_ids
                    or not evidence
                    or research.REJECT.search(title)
                    or not research.is_quality_row(title, channel, language, code)
                    or (duration and (duration < 75 or duration > 900))
                ):
                    continue
                candidate_ids.add(video_id)
                stated_language = research.has_language_signal(title, channel, language, code)
                stored_language = language if stated_language else "Language not stated"
                candidates[language].append([
                    video_id, title, channel, stored_language, code if stated_language else "und", region if stated_language else "International / verify before use",
                    research.arrangement(title, channel),
                    research.presentation(title, language) if stated_language else "Words or subtitles indicated",
                    evidence, duration, research.date.today().isoformat(),
                ])

    # Check current YouTube metadata only for the number of leads needed.
    ordered: list[list[object]] = []
    while len(rows) + len(ordered) < TARGET:
        added = False
        for language, _, _ in research.LANGUAGES:
            bucket = candidates[language]
            if bucket:
                ordered.append(bucket.pop(0))
                added = True
                if len(rows) + len(ordered) >= TARGET:
                    break
        if not added:
            break

    checked: list[list[object]] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(youtube_metadata_available, str(row[0])): row for row in ordered}
        for future in as_completed(futures):
            if future.result():
                checked.append(futures[future])
        time.sleep(0.1)

    # Restore deterministic language round-robin order after concurrent checks.
    checked_by_id = {str(row[0]): row for row in checked}
    rows.extend(checked_by_id[str(row[0])] for row in ordered if str(row[0]) in checked_by_id)
    OUTPUT.write_text(json.dumps(rows[:TARGET], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "started_with": len(loaded),
        "quality_existing": len(clean_existing(loaded)),
        "search_candidates": len(candidate_ids),
        "youtube_checked_additions": len(checked),
        "selected": min(len(rows), TARGET),
        "languages": len({row[3] for row in rows[:TARGET]}),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
