#!/usr/bin/env python3
"""Deepen the catalogue through channels found by multilingual search.

Only channels with at least one independently accepted word-video lead are
crawled. Every upload is then screened again as an individual song; the
channel is a discovery source, not a blanket approval.
"""

from __future__ import annotations

import importlib.util
import json
import math
import re
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from yt_dlp import YoutubeDL


ROOT = Path(__file__).resolve().parents[1]
SEARCH_SOURCE = Path("/tmp/wwv-expanded-search-candidates.json")
OUTPUT = Path("/tmp/wwv-expanded-channel-candidates.json")
MAX_CHANNELS = 100
MAX_RESULTS_PER_CHANNEL = 200
MAX_ACCEPTED_PER_CHANNEL = 500
MAX_WORKERS = 1

SPEC = importlib.util.spec_from_file_location(
    "catalogue_research",
    ROOT / "scripts" / "research-worship-catalogue.py",
)
assert SPEC and SPEC.loader
research = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(research)


def loaded_search_candidates() -> list[dict]:
    if not SEARCH_SOURCE.exists():
        raise SystemExit("Run `npm run catalogue:research:expanded` first.")
    data = json.loads(SEARCH_SOURCE.read_text(encoding="utf-8"))
    return data.get("candidates", data if isinstance(data, list) else [])


def channel_score(rows: list[dict]) -> float:
    explicit = sum(bool(row.get("languageExplicit")) for row in rows)
    views = sum(int(row.get("viewCountAtReview") or 0) for row in rows)
    official = sum(bool(re.search(r"official (?:lyric|lyrics)|official lyrics? video", str(row.get("sourceTitle") or ""), re.I)) for row in rows)
    return len(rows) * 8 + explicit * 4 + official * 4 + math.log10(views + 1)


def dominant_language(rows: list[dict]) -> tuple[str, str, str] | None:
    votes: Counter[tuple[str, str, str]] = Counter()
    for row in rows:
        language = str(row.get("language") or "Language not stated")
        if language != "Language not stated" and row.get("languageExplicit"):
            votes[(language, str(row.get("languageCode") or "und"), str(row.get("region") or "International"))] += 1
    if not votes:
        return None
    winner, count = votes.most_common(1)[0]
    return winner if count >= 2 and count / sum(votes.values()) >= 0.6 else None


def research_channel(job: tuple[str, str, tuple[str, str, str] | None]) -> tuple[str, str, tuple[str, str, str] | None, list[dict], str | None]:
    channel_url, expected_channel, default_language = job
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "playlistend": MAX_RESULTS_PER_CHANNEL,
        "ignoreerrors": True,
        "nocheckcertificate": True,
        "extractor_retries": 2,
    }
    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(f"{channel_url.rstrip('/')}/videos", download=False) or {}
        channel = str(info.get("channel") or expected_channel).strip()
        return channel_url, channel, default_language, list(info.get("entries") or []), None
    except Exception as error:
        return channel_url, expected_channel, default_language, [], str(error)


def main() -> None:
    search_rows = loaded_search_candidates()
    rows_by_url: dict[str, list[dict]] = defaultdict(list)
    for row in search_rows:
        channel_url = str(row.get("sourceChannelUrl") or "").strip()
        if channel_url.startswith("https://www.youtube.com/"):
            rows_by_url[channel_url].append(row)

    ranked = sorted(rows_by_url.items(), key=lambda item: channel_score(item[1]), reverse=True)[:MAX_CHANNELS]
    jobs = [
        (channel_url, str(rows[0].get("sourceChannel") or "").strip(), dominant_language(rows))
        for channel_url, rows in ranked
    ]
    existing_ids = research.existing_video_ids()
    accepted_by_id: dict[str, dict] = {}
    errors: list[dict[str, str]] = []
    completed = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(research_channel, job) for job in jobs]
        for future in as_completed(futures):
            channel_url, channel, default_language, entries, error = future.result()
            if error:
                errors.append({"channel": channel, "error": error})
                continue
            channel_rows: list[dict] = []
            for entry in entries:
                if not entry:
                    continue
                video_id = str(entry.get("id") or "")
                title = str(entry.get("title") or "").strip()
                duration = int(entry.get("duration") or 0)
                views = int(entry.get("view_count") or 0)
                evidence = research.word_evidence(title)
                language, code, region = default_language or ("Language not stated", "und", "International / verify before use")
                explicit_matches = [
                    candidate for candidate in research.LANGUAGES
                    if candidate[0] != "English" and research.has_language_signal(title, channel, candidate[0], candidate[1])
                ]
                if len(explicit_matches) == 1:
                    language, code, region = explicit_matches[0]
                if (
                    not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id)
                    or video_id in existing_ids
                    or not title
                    or not evidence
                    or not duration
                    or duration < 75
                    or duration > 900
                    or views < 20
                    or not research.is_quality_row(title, channel, language, code)
                ):
                    continue
                channel_rows.append({
                    "youtubeId": video_id,
                    "sourceTitle": title,
                    "sourceChannel": channel,
                    "durationSeconds": duration,
                    "viewCountAtReview": views,
                    "channelUrl": channel_url,
                    "language": language,
                    "languageCode": code,
                    "region": region,
                    "wordEvidence": evidence,
                })
            channel_rows.sort(key=lambda item: int(item.get("viewCountAtReview") or 0), reverse=True)
            for item in channel_rows[:MAX_ACCEPTED_PER_CHANNEL]:
                accepted_by_id.setdefault(str(item["youtubeId"]), item)
            completed += 1
            if completed % 25 == 0:
                print(json.dumps({"completed": completed, "channels": len(jobs), "candidates": len(accepted_by_id)}), flush=True)

    candidates = sorted(
        accepted_by_id.values(),
        key=lambda item: int(item.get("viewCountAtReview") or 0),
        reverse=True,
    )
    OUTPUT.write_text(json.dumps(candidates, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "output": str(OUTPUT),
        "channel_leads": len(rows_by_url),
        "channels_checked": len(jobs),
        "candidates": len(candidates),
        "errors": len(errors),
        "sample_errors": errors[:5],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
