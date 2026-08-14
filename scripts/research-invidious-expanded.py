#!/usr/bin/env python3
"""Discover multilingual worship word videos through public Invidious metadata.

This is a rate-limit-friendly complement to direct YouTube research. It keeps
only public metadata for song-length uploads whose title/channel independently
prove the requested language, Christian music context and words/subtitles.
The normal importer must still verify the live YouTube embed before publication.
"""

from __future__ import annotations

import importlib.util
import json
import math
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path("/tmp/wwv-invidious-search-candidates.json")
API = "https://inv.zoomerville.com/api/v1/search"
DEFAULT_PAGES = 4
DEFAULT_MAX_JOBS = 10000
MAX_WORKERS = 1
SSL_CONTEXT = ssl._create_unverified_context()


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


research = load_module("catalogue_research", ROOT / "scripts" / "research-worship-catalogue.py")
expanded = load_module("expanded_research", ROOT / "scripts" / "research-expanded-catalogue.py")


def integer_argument(name: str, default: int) -> int:
    prefix = f"--{name}="
    return next((int(value.split("=", 1)[1]) for value in sys.argv if value.startswith(prefix)), default)


def string_argument(name: str) -> str | None:
    prefix = f"--{name}="
    return next((value.split("=", 1)[1] for value in sys.argv if value.startswith(prefix)), None)


def get_json(url: str, timeout: int = 25):
    for attempt in range(3):
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "WorshipWordVideoCatalogueResearch/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code != 429 or attempt == 2:
                raise
            delay = int(error.headers.get("Retry-After") or 3 * (2 ** attempt))
            time.sleep(min(delay, 30))
    raise RuntimeError("Invidious metadata request did not complete.")


def fetch(job: tuple[str, str, str, str, int]) -> tuple[str, list[dict], str | None]:
    language, code, region, query, page = job
    key = f"{language}\t{query}\t{page}"
    params = urllib.parse.urlencode({
        "q": query,
        "type": "video",
        "page": page,
        "sort_by": "relevance",
    })
    try:
        result = get_json(f"{API}?{params}")
        rows: list[dict] = []
        for rank, entry in enumerate(result if isinstance(result, list) else [], start=1):
            video_id = str(entry.get("videoId") or "")
            title = str(entry.get("title") or "").strip()
            channel = str(entry.get("author") or "").strip()
            duration = int(entry.get("lengthSeconds") or 0)
            views = int(entry.get("viewCount") or 0)
            evidence = research.word_evidence(title)
            if (
                not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id)
                or not title
                or not channel
                or not evidence
                or duration < 75
                or duration > 900
                or views < expanded.minimum_views(language, title)
                or not research.has_language_signal(title, channel, language, code)
                or not research.is_quality_row(title, channel, language, code)
            ):
                continue
            author_id = str(entry.get("authorId") or "")
            rows.append({
                "language": language,
                "languageCode": code,
                "region": region,
                "query": query,
                "page": page,
                "rank": rank,
                "youtubeId": video_id,
                "sourceTitle": title,
                "sourceChannel": channel,
                "sourceChannelUrl": f"https://www.youtube.com/channel/{author_id}" if author_id else None,
                "durationSeconds": duration,
                "viewCountAtReview": views,
                "wordEvidence": evidence,
                "languageExplicit": True,
                "sourceKind": "invidious-search",
            })
        return key, rows, None
    except Exception as error:
        return key, [], str(error)


def candidate_score(item: dict) -> float:
    title = str(item.get("sourceTitle") or "")
    views = int(item.get("viewCountAtReview") or 0)
    rank = int(item.get("rank") or 100)
    score = math.log10(views + 1) * 2 - rank / 50
    if re.search(r"official (?:lyric|lyrics)|official lyrics? video", title, re.I):
        score += 6
    if re.search(r"english\s+(?:subtitles?|captions?|translation|lyrics?)|bilingual", title, re.I):
        score += 5
    return score


def balanced_jobs(pages: int, selected_languages: set[str]) -> list[tuple[str, str, str, str, int]]:
    language_queries = [
        (language, code, region, expanded.generic_queries(language))
        for language, code, region in research.LANGUAGES
        if not selected_languages or language.casefold() in selected_languages
    ]
    widest = max((len(queries) for _, _, _, queries in language_queries), default=0)
    return [
        (language, code, region, queries[index], page)
        for page in range(1, pages + 1)
        for index in range(widest)
        for language, code, region, queries in language_queries
        if index < len(queries)
    ]


def main() -> None:
    pages = integer_argument("pages", DEFAULT_PAGES)
    max_jobs = integer_argument("max-jobs", DEFAULT_MAX_JOBS)
    language_value = string_argument("language") or ""
    selected_languages = {value.strip().casefold() for value in language_value.split(",") if value.strip()}
    completed: set[str] = set()
    candidates: dict[str, dict] = {}
    if OUTPUT.exists() and "--fresh" not in sys.argv:
        cached = json.loads(OUTPUT.read_text(encoding="utf-8"))
        completed.update(str(value) for value in cached.get("completedJobs", []))
        for item in cached.get("candidates", []):
            candidates[str(item.get("youtubeId") or "")] = item

    existing_ids = research.existing_video_ids()
    jobs = [
        job for job in balanced_jobs(pages, selected_languages)
        if f"{job[0]}\t{job[3]}\t{job[4]}" not in completed
    ][:max_jobs]
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(fetch, job) for job in jobs]
        for done, future in enumerate(as_completed(futures), start=1):
            key, rows, error = future.result()
            if error:
                errors.append(error)
            else:
                completed.add(key)
            for item in rows:
                video_id = str(item["youtubeId"])
                if video_id in existing_ids:
                    continue
                current = candidates.get(video_id)
                if current is None or candidate_score(item) > candidate_score(current):
                    candidates[video_id] = item
            if done % 100 == 0:
                OUTPUT.write_text(json.dumps({
                    "completedJobs": sorted(completed),
                    "candidates": sorted(candidates.values(), key=candidate_score, reverse=True),
                }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
                print(json.dumps({"completed": done, "jobs": len(jobs), "candidates": len(candidates)}), flush=True)

    rows = sorted(candidates.values(), key=candidate_score, reverse=True)
    OUTPUT.write_text(json.dumps({
        "completedJobs": sorted(completed),
        "candidates": rows,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "output": str(OUTPUT),
        "jobs_run": len(jobs),
        "jobs_completed_total": len(completed),
        "candidates": len(rows),
        "explicit_languages": len({row["language"] for row in rows}),
        "errors": len(errors),
        "sample_errors": errors[:5],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
