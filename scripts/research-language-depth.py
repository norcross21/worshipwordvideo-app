#!/usr/bin/env python3
"""Deepen underrepresented language catalogues through familiar worship songs.

The public YouTube search page is used only to discover exact video IDs and
uploader metadata. Candidates must identify the requested language, a worship
song context, on-screen words/subtitles and a service-length duration. The
normal importer still rechecks the current YouTube embed before publication.
"""

from __future__ import annotations

import importlib.util
import json
import re
import ssl
import sys
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = ROOT / "public" / "catalogue" / "worship-songs.json"
FAMILIAR_FAMILIES = ROOT / "public" / "catalogue" / "familiar-song-families.json"
FAMILIAR_FALLBACK = ROOT / "src" / "data" / "expandedWordWorshipVideos.json"
OUTPUT = Path("/tmp/wwv-language-depth-candidates.json")
SSL_CONTEXT = ssl._create_unverified_context()
DEFAULT_TARGET = 500
DEFAULT_MAX_QUERIES = 1800
DEFAULT_SONGS_PER_LANGUAGE = 35
MAX_WORKERS = 6


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


research = load_module("catalogue_research", ROOT / "scripts" / "research-worship-catalogue.py")


def integer_argument(name: str, default: int) -> int:
    prefix = f"--{name}="
    return next((int(value.split("=", 1)[1]) for value in sys.argv if value.startswith(prefix)), default)


def string_argument(name: str) -> str | None:
    prefix = f"--{name}="
    return next((value.split("=", 1)[1] for value in sys.argv if value.startswith(prefix)), None)


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


def catalogue_state() -> tuple[Counter[str], set[str]]:
    if not CATALOGUE.exists():
        raise SystemExit("Run `npm run seo:generate` before language-depth research.")
    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    songs = catalogue.get("songs", [])
    if catalogue.get("version") == 2:
        languages = catalogue.get("dictionaries", {}).get("language", [])
        return Counter(
            str(languages[row[5] - 1]) if len(row) > 5 and row[5] else "Language not stated"
            for row in songs
        ), {str(row[4]) for row in songs if len(row) > 4 and row[4]}
    return Counter(str(song.get("language") or "Language not stated") for song in songs), {
        str(song.get("youtubeId") or "") for song in songs
    }


def familiar_titles(limit: int) -> list[str]:
    if FAMILIAR_FAMILIES.exists():
        families = json.loads(FAMILIAR_FAMILIES.read_text(encoding="utf-8"))
        return [str(family["title"]).strip() for family in families[:limit] if family.get("title")]
    rows = json.loads(FAMILIAR_FALLBACK.read_text(encoding="utf-8"))
    counts = Counter(str(row[6]).strip() for row in rows if len(row) > 6 and row[6])
    return [title for title, _ in counts.most_common(limit)]


def title_matches_familiar(source_title: str, familiar_title: str) -> bool:
    normalise = lambda value: re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()
    source = normalise(source_title)
    target = normalise(familiar_title)
    if target and target in source:
        return True
    stop = {"the", "and", "for", "with", "you", "your", "our", "are", "this", "that", "into"}
    tokens = [token for token in target.split() if len(token) > 2 and token not in stop]
    return bool(tokens) and sum(token in source.split() for token in tokens) / len(tokens) >= 0.75


def queries_for(title: str, language: str) -> tuple[str, ...]:
    return (
        f'"{title}" {language} worship lyrics',
        f'"{title}" {language} English subtitles',
        f'"{title}" translated into {language} Christian lyrics',
    )


def candidate_score(item: dict) -> int:
    title = str(item.get("sourceTitle") or "")
    score = 0
    if re.search(r"english\s+(?:subtitles?|captions?|translation)|eng\s*sub", title, re.I):
        score += 8
    if re.search(r"official\s+(?:lyric|lyrics)|official lyrics? video", title, re.I):
        score += 6
    if re.search(r"bilingual|translated|translation", title, re.I):
        score += 4
    if re.search(r"lyrics?|subtitles?|paroles|letras?|lirik|歌詞|歌词|가사", title, re.I):
        score += 2
    return score


def fetch(job: tuple[str, str, str, str, str]) -> tuple[str, list[dict], str | None]:
    language, code, region, english_title, query = job
    url = "https://www.youtube.com/results?" + urllib.parse.urlencode({"search_query": query})
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; WorshipWordVideoCatalogueResearch/1.0)"},
    )
    try:
        with urllib.request.urlopen(request, timeout=25, context=SSL_CONTEXT) as response:
            page = response.read().decode("utf-8", "ignore")
        match = re.search(r"var ytInitialData = (\{.*?\});</script>", page, re.S)
        if not match:
            return query, [], "Initial YouTube search data was not found."
        rows: list[dict] = []
        for rank, item in enumerate(video_renderers(json.loads(match.group(1))), start=1):
            video_id = str(item.get("videoId") or "")
            title = text_value(item.get("title") or {})
            channel = text_value(item.get("ownerText") or item.get("longBylineText") or {})
            duration = duration_seconds(text_value(item.get("lengthText") or {}))
            evidence = research.word_evidence(title)
            if (
                not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id)
                or not title
                or not channel
                or not evidence
                or not 75 <= duration <= 900
                or not title_matches_familiar(title, english_title)
                or not research.has_language_signal(title, channel, language, code)
                or not research.is_quality_row(title, channel, language, code)
            ):
                continue
            rows.append({
                "language": language,
                "languageCode": code,
                "region": region,
                "englishTitle": english_title,
                "query": query,
                "rank": rank,
                "youtubeId": video_id,
                "sourceTitle": title,
                "sourceChannel": channel,
                "durationSeconds": duration,
                "viewCountAtReview": 0,
                "wordEvidence": evidence,
                "languageExplicit": True,
                "sourceKind": "known-song-language-depth",
            })
        return query, rows, None
    except Exception as error:
        return query, [], str(error)


def main() -> None:
    target = integer_argument("target", DEFAULT_TARGET)
    max_queries = integer_argument("max-queries", DEFAULT_MAX_QUERIES)
    songs_per_language = integer_argument("songs-per-language", DEFAULT_SONGS_PER_LANGUAGE)
    selected_language = string_argument("language")
    counts, existing_ids = catalogue_state()
    titles = familiar_titles(songs_per_language)

    languages = [item for item in research.LANGUAGES if item[0] != "English" and counts[item[0]] < target]
    if selected_language:
        languages = [item for item in languages if item[0].casefold() == selected_language.casefold()]
    # Languages nearest 500 can cross the threshold first; later resumable runs
    # naturally progress into medium and smaller collections.
    languages.sort(key=lambda item: (-counts[item[0]], item[0]))

    completed: set[str] = set()
    candidates: dict[str, dict] = {}
    if OUTPUT.exists() and "--fresh" not in sys.argv:
        cached = json.loads(OUTPUT.read_text(encoding="utf-8"))
        completed.update(str(value) for value in cached.get("completedQueries", []))
        for item in cached.get("candidates", []):
            candidates[str(item.get("youtubeId") or "")] = item

    jobs: list[tuple[str, str, str, str, str]] = []
    for language, code, region in languages:
        for title in titles:
            for query in queries_for(title, language):
                if query not in completed:
                    jobs.append((language, code, region, title, query))
    jobs = jobs[:max_queries]

    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(fetch, job) for job in jobs]
        for done, future in enumerate(as_completed(futures), start=1):
            query, rows, error = future.result()
            if error:
                errors.append(error)
            else:
                completed.add(query)
            for row in rows:
                video_id = str(row["youtubeId"])
                if video_id in existing_ids:
                    continue
                current = candidates.get(video_id)
                if current is None or candidate_score(row) > candidate_score(current):
                    candidates[video_id] = row
            if done % 50 == 0:
                OUTPUT.write_text(json.dumps({
                    "completedQueries": sorted(completed),
                    "candidates": sorted(candidates.values(), key=candidate_score, reverse=True),
                }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
                print(json.dumps({"completed": done, "queries": len(jobs), "candidates": len(candidates)}), flush=True)

    candidate_rows = sorted(candidates.values(), key=candidate_score, reverse=True)
    OUTPUT.write_text(json.dumps({
        "completedQueries": sorted(completed),
        "candidates": candidate_rows,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "output": str(OUTPUT),
        "target_per_language": target,
        "languages_below_target": len(languages),
        "queries_run": len(jobs),
        "queries_completed_total": len(completed),
        "candidates": len(candidate_rows),
        "candidate_languages": len({row["language"] for row in candidate_rows}),
        "errors": len(errors),
        "sample_errors": errors[:5],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
