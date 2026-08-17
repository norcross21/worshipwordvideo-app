#!/usr/bin/env python3
"""Search additional multilingual word videos through public result pages.

This is a low-volume fallback for when YouTube's search API is rate-limited.
It reads only the first public result page and retains no media or lyrics.
"""

from __future__ import annotations

import importlib.util
import json
import re
import ssl
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEARCH_CACHE = Path("/tmp/wwv-expanded-search-candidates.json")
OUTPUT = Path("/tmp/wwv-search-html-candidates.json")
MAX_QUERIES = 1600
MAX_WORKERS = 2
SSL_CONTEXT = ssl._create_unverified_context()


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


research = load_module("catalogue_research", ROOT / "scripts" / "research-worship-catalogue.py")
expanded = load_module("expanded_research", ROOT / "scripts" / "research-expanded-catalogue.py")


def text_value(value: dict) -> str:
    if value.get("simpleText"):
        return str(value["simpleText"]).strip()
    return "".join(str(run.get("text") or "") for run in value.get("runs") or []).strip()


def duration_seconds(value: str) -> int:
    parts = [int(part) for part in value.split(":") if part.isdigit()]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return 0


def video_renderers(value: object) -> list[dict]:
    found: list[dict] = []
    if isinstance(value, dict):
        renderer = value.get("videoRenderer")
        if isinstance(renderer, dict):
            found.append(renderer)
        for child in value.values():
            found.extend(video_renderers(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(video_renderers(child))
    return found


def fetch(job: tuple[str, str, str, str]) -> tuple[list[dict], str | None]:
    language, code, region, query = job
    url = "https://www.youtube.com/results?" + urllib.parse.urlencode({"search_query": query})
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; WorshipWordVideoCatalogueResearch/1.0)"})
    try:
        with urllib.request.urlopen(request, timeout=25, context=SSL_CONTEXT) as response:
            page = response.read().decode("utf-8", "ignore")
        match = re.search(r"var ytInitialData = (\{.*?\});</script>", page, re.S)
        if not match:
            return [], "Initial search data was not found."
        initial = json.loads(match.group(1))
        rows: list[dict] = []
        for rank, item in enumerate(video_renderers(initial), start=1):
            video_id = str(item.get("videoId") or "")
            title = text_value(item.get("title") or {})
            channel = text_value(item.get("ownerText") or item.get("longBylineText") or {})
            owner = item.get("ownerText") or item.get("longBylineText") or {}
            owner_runs = owner.get("runs") or []
            browse_id = str((((owner_runs[0] if owner_runs else {}).get("navigationEndpoint") or {}).get("browseEndpoint") or {}).get("browseId") or "")
            duration = duration_seconds(text_value(item.get("lengthText") or {}))
            evidence = research.word_evidence(title)
            if (
                not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id)
                or not title
                or not channel
                or not evidence
                or not duration
                or duration < 75
                or duration > 900
                or not research.is_quality_row(title, channel, language, code)
            ):
                continue
            explicit = research.has_language_signal(title, channel, language, code)
            rows.append({
                "language": language if explicit else "Language not stated",
                "languageCode": code if explicit else "und",
                "region": region if explicit else "International / verify before use",
                "query": query,
                "rank": rank,
                "youtubeId": video_id,
                "sourceTitle": title,
                "sourceChannel": channel,
                "sourceChannelUrl": f"https://www.youtube.com/channel/{browse_id}" if browse_id.startswith("UC") else None,
                "durationSeconds": duration,
                "viewCountAtReview": 0,
                "wordEvidence": evidence,
                "languageExplicit": explicit,
            })
        return rows, None
    except Exception as error:
        return [], str(error)


def main() -> None:
    english_subtitles_only = "--english-subtitles" in sys.argv
    selected_language = next((value.split("=", 1)[1] for value in sys.argv if value.startswith("--language=")), None)
    selected_languages = {
        value.strip().casefold()
        for value in (selected_language or "").split(",")
        if value.strip()
    }
    completed: set[str] = set()
    if SEARCH_CACHE.exists():
        data = json.loads(SEARCH_CACHE.read_text(encoding="utf-8"))
        completed.update(data.get("completedQueries", []))
    jobs: list[tuple[str, str, str, str]] = []
    for language, code, region in research.LANGUAGES:
        if selected_languages and language.casefold() not in selected_languages:
            continue
        queries = expanded.generic_queries(language)
        if english_subtitles_only:
            queries = [query for query in queries if "english" in query.lower()]
        for query in queries:
            # A focused pass checks the public HTML result page even if yt-dlp
            # already attempted the same query; the surfaces can differ.
            if selected_languages or english_subtitles_only or f"{language}\t{query}" not in completed:
                jobs.append((language, code, region, query))
    jobs = jobs[:MAX_QUERIES]

    candidates: dict[str, dict] = {}
    if OUTPUT.exists() and "--fresh" not in sys.argv:
        for row in json.loads(OUTPUT.read_text(encoding="utf-8")):
            candidates[str(row["youtubeId"])] = row
    errors: list[str] = []
    done = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(fetch, job) for job in jobs]
        for future in as_completed(futures):
            rows, error = future.result()
            if error:
                errors.append(error)
            for row in rows:
                current = candidates.get(str(row["youtubeId"]))
                if current is None or (not current.get("sourceChannelUrl") and row.get("sourceChannelUrl")):
                    candidates[str(row["youtubeId"])] = row
            done += 1
            if done % 50 == 0:
                print(json.dumps({"completed": done, "queries": len(jobs), "candidates": len(candidates)}), flush=True)

    OUTPUT.write_text(json.dumps(list(candidates.values()), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "queries": len(jobs), "candidates": len(candidates), "errors": len(errors)}, indent=2))


if __name__ == "__main__":
    main()
