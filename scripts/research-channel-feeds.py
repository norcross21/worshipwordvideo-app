#!/usr/bin/env python3
"""Discover recent word videos from multilingual YouTube channel leads.

YouTube's public Atom feeds provide exact video IDs and uploader titles without
downloading media. The importer performs the duration and embed checks before
any feed result can be published.
"""

from __future__ import annotations

import importlib.util
import json
import re
import ssl
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEARCH_SOURCE = Path("/tmp/wwv-expanded-search-candidates.json")
SEARCH_PAGE_SOURCE = Path("/tmp/wwv-search-html-candidates.json")
OUTPUT = Path("/tmp/wwv-channel-feed-candidates.json")
MAX_WORKERS = 3
SSL_CONTEXT = ssl._create_unverified_context()

SPEC = importlib.util.spec_from_file_location(
    "catalogue_research",
    ROOT / "scripts" / "research-worship-catalogue.py",
)
assert SPEC and SPEC.loader
research = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(research)


def search_candidates() -> list[dict]:
    data = json.loads(SEARCH_SOURCE.read_text(encoding="utf-8"))
    rows = list(data.get("candidates", [])) if isinstance(data, dict) else list(data)
    if SEARCH_PAGE_SOURCE.exists():
        loaded = json.loads(SEARCH_PAGE_SOURCE.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            rows.extend(loaded.get("candidates", []))
        else:
            rows.extend(loaded)
    return rows


def channel_id(channel_url: str) -> str | None:
    match = re.search(r"youtube\.com/channel/(UC[A-Za-z0-9_-]{22})", channel_url)
    return match.group(1) if match else None


def default_language(rows: list[dict]) -> tuple[str, str, str] | None:
    votes: Counter[tuple[str, str, str]] = Counter()
    for row in rows:
        language = str(row.get("language") or "Language not stated")
        if language != "Language not stated" and row.get("languageExplicit"):
            votes[(language, str(row.get("languageCode") or "und"), str(row.get("region") or "International"))] += 1
    if not votes:
        return None
    winner, count = votes.most_common(1)[0]
    return winner if count >= 2 and count / sum(votes.values()) >= 0.6 else None


def fetch_feed(job: tuple[str, str, tuple[str, str, str] | None]) -> tuple[list[dict], str | None]:
    channel, fallback_name, language_default = job
    request = urllib.request.Request(
        f"https://www.youtube.com/feeds/videos.xml?channel_id={channel}",
        headers={"User-Agent": "Mozilla/5.0 (compatible; WorshipWordVideoCatalogueResearch/1.0)"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20, context=SSL_CONTEXT) as response:
            root = ET.fromstring(response.read())
        ns = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
        author = root.findtext("atom:author/atom:name", fallback_name, ns).strip()
        rows: list[dict] = []
        for entry in root.findall("atom:entry", ns):
            video_id = (entry.findtext("yt:videoId", "", ns) or "").strip()
            title = (entry.findtext("atom:title", "", ns) or "").strip()
            evidence = research.word_evidence(title)
            language, code, region = language_default or ("Language not stated", "und", "International / verify before use")
            explicit = [
                candidate for candidate in research.LANGUAGES
                if candidate[0] != "English" and research.has_language_signal(title, author, candidate[0], candidate[1])
            ]
            if len(explicit) == 1:
                language, code, region = explicit[0]
            if (
                not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id)
                or not evidence
                or not research.is_quality_row(title, author, language, code)
            ):
                continue
            rows.append({
                "youtubeId": video_id,
                "sourceTitle": title,
                "sourceChannel": author,
                "durationSeconds": 0,
                "viewCountAtReview": 0,
                "language": language,
                "languageCode": code,
                "region": region,
                "wordEvidence": evidence,
                "sourceKind": "channel-feed",
            })
        return rows, None
    except Exception as error:
        return [], str(error)


def main() -> None:
    by_channel: dict[str, list[dict]] = defaultdict(list)
    names: dict[str, str] = {}
    for row in search_candidates():
        url = str(row.get("sourceChannelUrl") or "")
        identifier = channel_id(url)
        if not identifier:
            continue
        by_channel[identifier].append(row)
        names[identifier] = str(row.get("sourceChannel") or "").strip()

    jobs = [(identifier, names[identifier], default_language(rows)) for identifier, rows in by_channel.items()]
    candidates: dict[str, dict] = {}
    errors: list[str] = []
    completed = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(fetch_feed, job) for job in jobs]
        for future in as_completed(futures):
            rows, error = future.result()
            if error:
                errors.append(error)
            for row in rows:
                candidates.setdefault(str(row["youtubeId"]), row)
            completed += 1
            if completed % 100 == 0:
                print(json.dumps({"completed": completed, "channels": len(jobs), "candidates": len(candidates)}), flush=True)

    OUTPUT.write_text(json.dumps(list(candidates.values()), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "output": str(OUTPUT),
        "channels_checked": len(jobs),
        "candidates": len(candidates),
        "errors": len(errors),
    }, indent=2))


if __name__ == "__main__":
    main()
