#!/usr/bin/env python3
"""Read the first public videos page for strong multilingual channel leads.

This avoids YouTube's search API and keeps only exact uploader titles that
indicate words or subtitles. Final embed/duration verification remains the
responsibility of the importer.
"""

from __future__ import annotations

import importlib.util
import json
import math
import re
import ssl
import sys
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEARCH_SOURCE = Path("/tmp/wwv-expanded-search-candidates.json")
SEARCH_PAGE_SOURCE = Path("/tmp/wwv-search-html-candidates.json")
OUTPUT = Path("/tmp/wwv-channel-html-candidates.json")
MAX_CHANNELS = 2000
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


def lead_score(rows: list[dict]) -> float:
    views = sum(int(row.get("viewCountAtReview") or 0) for row in rows)
    explicit = sum(bool(row.get("languageExplicit")) for row in rows)
    return len(rows) * 8 + explicit * 3 + math.log10(views + 1)


def lockups(value: object) -> list[dict]:
    found: list[dict] = []
    if isinstance(value, dict):
        lockup = value.get("lockupViewModel")
        if isinstance(lockup, dict) and lockup.get("contentType") == "LOCKUP_CONTENT_TYPE_VIDEO":
            found.append(lockup)
        for child in value.values():
            found.extend(lockups(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(lockups(child))
    return found


def integer_argument(name: str, default: int) -> int:
    prefix = f"--{name}="
    return next((int(value.split("=", 1)[1]) for value in sys.argv if value.startswith(prefix)), default)


def continuation_token(value: object) -> str | None:
    if isinstance(value, dict):
        renderer = value.get("continuationItemRenderer")
        if isinstance(renderer, dict):
            command = ((renderer.get("continuationEndpoint") or {}).get("continuationCommand") or {})
            if command.get("token"):
                return str(command["token"])
        for child in value.values():
            token = continuation_token(child)
            if token:
                return token
    elif isinstance(value, list):
        for child in value:
            token = continuation_token(child)
            if token:
                return token
    return None


def continuation_page(api_key: str, client_version: str, token: str) -> dict:
    body = json.dumps({
        "context": {"client": {"clientName": "WEB", "clientVersion": client_version}},
        "continuation": token,
    }).encode("utf-8")
    request = urllib.request.Request(
        f"https://www.youtube.com/youtubei/v1/browse?key={api_key}",
        data=body,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; WorshipWordVideoCatalogueResearch/1.0)",
            "Content-Type": "application/json",
            "Origin": "https://www.youtube.com",
        },
    )
    with urllib.request.urlopen(request, timeout=25, context=SSL_CONTEXT) as response:
        return json.load(response)


def fetch_page(job: tuple[str, str, tuple[str, str, str] | None, int]) -> tuple[str, list[dict], str | None]:
    identifier, channel, language_default, max_pages = job
    request = urllib.request.Request(
        f"https://www.youtube.com/channel/{identifier}/videos",
        headers={"User-Agent": "Mozilla/5.0 (compatible; WorshipWordVideoCatalogueResearch/1.0)"},
    )
    try:
        with urllib.request.urlopen(request, timeout=25, context=SSL_CONTEXT) as response:
            page = response.read().decode("utf-8", "ignore")
        match = re.search(r"var ytInitialData = (\{.*?\});</script>", page, re.S)
        if not match:
            return identifier, [], "Initial channel data was not found."
        initial = json.loads(match.group(1))
        pages = [initial]
        api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)', page)
        client_match = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)', page)
        token = continuation_token(initial)
        continuation_error: str | None = None
        while token and len(pages) < max_pages and api_key_match and client_match:
            try:
                continuation = continuation_page(api_key_match.group(1), client_match.group(1), token)
            except Exception as error:
                continuation_error = str(error)
                break
            pages.append(continuation)
            token = continuation_token(continuation)
        rows: list[dict] = []
        for item in (item for loaded_page in pages for item in lockups(loaded_page)):
            video_id = str(item.get("contentId") or "")
            metadata = (item.get("metadata") or {}).get("lockupMetadataViewModel") or {}
            title = str((metadata.get("title") or {}).get("content") or "").strip()
            evidence = research.word_evidence(title)
            language, code, region = language_default or ("Language not stated", "und", "International / verify before use")
            explicit = [
                candidate for candidate in research.LANGUAGES
                if candidate[0] != "English" and research.has_language_signal(title, channel, candidate[0], candidate[1])
            ]
            if len(explicit) == 1:
                language, code, region = explicit[0]
            if (
                not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id)
                or not evidence
                or not research.is_quality_row(title, channel, language, code)
            ):
                continue
            rows.append({
                "youtubeId": video_id,
                "sourceTitle": title,
                "sourceChannel": channel,
                "durationSeconds": 0,
                "viewCountAtReview": 0,
                "language": language,
                "languageCode": code,
                "region": region,
                "wordEvidence": evidence,
                "sourceKind": "channel-html",
            })
        return identifier, rows, continuation_error
    except Exception as error:
        return identifier, [], str(error)


def main() -> None:
    max_pages = integer_argument("pages", 1)
    max_channels = integer_argument("max-channels", MAX_CHANNELS)
    skip_ranked = integer_argument("skip-ranked", 0)
    by_channel: dict[str, list[dict]] = defaultdict(list)
    names: dict[str, str] = {}
    for row in search_candidates():
        identifier = channel_id(str(row.get("sourceChannelUrl") or ""))
        if not identifier:
            continue
        by_channel[identifier].append(row)
        names[identifier] = str(row.get("sourceChannel") or "").strip()
    ranked = sorted(by_channel.items(), key=lambda item: lead_score(item[1]), reverse=True)[skip_ranked:max_channels]
    completed_channels: set[str] = set()
    candidates: dict[str, dict] = {}
    if OUTPUT.exists() and "--fresh" not in sys.argv:
        cached = json.loads(OUTPUT.read_text(encoding="utf-8"))
        cached_rows = cached.get("candidates", []) if isinstance(cached, dict) else cached
        completed_channels.update(str(value) for value in cached.get("completedDeepChannels", [])) if isinstance(cached, dict) else None
        for row in cached_rows:
            candidates[str(row["youtubeId"])] = row
    jobs = [
        (identifier, names[identifier], default_language(rows), max_pages)
        for identifier, rows in ranked
        if f"{identifier}\t{max_pages}" not in completed_channels
    ]
    errors: list[str] = []
    completed = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(fetch_page, job) for job in jobs]
        for future in as_completed(futures):
            identifier, rows, error = future.result()
            if error:
                errors.append(error)
            else:
                completed_channels.add(f"{identifier}\t{max_pages}")
            for row in rows:
                candidates.setdefault(str(row["youtubeId"]), row)
            completed += 1
            if completed % 25 == 0:
                OUTPUT.write_text(json.dumps({
                    "completedDeepChannels": sorted(completed_channels),
                    "candidates": list(candidates.values()),
                }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            if completed % 100 == 0:
                print(json.dumps({"completed": completed, "channels": len(jobs), "candidates": len(candidates)}), flush=True)

    OUTPUT.write_text(json.dumps({
        "completedDeepChannels": sorted(completed_channels),
        "candidates": list(candidates.values()),
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "output": str(OUTPUT),
        "channels_checked": len(jobs),
        "pages_per_channel": max_pages,
        "candidates": len(candidates),
        "errors": len(errors),
    }, indent=2))


if __name__ == "__main__":
    main()
