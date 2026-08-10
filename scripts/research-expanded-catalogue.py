#!/usr/bin/env python3
"""Deep multilingual discovery for current, playable worship word videos.

The script stores public YouTube metadata only. It deliberately requires
song-length media, Christian/worship context and title evidence for lyrics,
words or subtitles. A separate importer rechecks every selected video in the
actual embedded player before it reaches the public catalogue.
"""

from __future__ import annotations

import importlib.util
import json
import math
import re
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from yt_dlp import YoutubeDL


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path("/tmp/wwv-expanded-search-candidates.json")
RESULTS_PER_QUERY = 25
MAX_WORKERS = 2

SPEC = importlib.util.spec_from_file_location(
    "catalogue_research",
    ROOT / "scripts" / "research-worship-catalogue.py",
)
assert SPEC and SPEC.loader
research = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(research)


# Native search phrases reach established local-language ministries whose
# upload titles do not use English discovery terms. These are discovery hints,
# never language proof by themselves; published labels still require title,
# script or channel evidence.
NATIVE_QUERIES: dict[str, tuple[str, ...]] = {
    "Spanish": ("alabanza cristiana con letra", "adoración cristiana letras", "himnos cristianos con letra"),
    "Portuguese": ("louvor cristão com letra", "adoração letra", "hino evangélico com letra"),
    "French": ("louange chrétienne avec paroles", "chant chrétien paroles", "cantique avec paroles"),
    "German": ("Lobpreis Liedtext", "christliches Lied mit Text", "Kirchenlied Liedtext"),
    "Italian": ("canto cristiano con testo", "lode cristiana testo", "inno cristiano testo"),
    "Dutch": ("aanbidding liedtekst", "christelijk lied met tekst", "loflied tekst"),
    "Polish": ("uwielbienie tekst piosenki", "pieśń chrześcijańska tekst", "hymn z tekstem"),
    "Romanian": ("cântare creștină versuri", "laudă și închinare versuri", "imn creștin versuri"),
    "Ukrainian": ("християнська пісня текст", "пісня прославлення зі словами", "християнське поклоніння текст"),
    "Russian": ("христианская песня текст", "песня прославления слова", "поклонение текст песни"),
    "Turkish": ("Hristiyan ilahi sözleri", "Türkçe tapınma şarkısı sözleri", "Mesih ilahisi sözleri"),
    "Greek": ("χριστιανικό τραγούδι στίχοι", "ύμνος με στίχους"),
    "Arabic": ("ترنيمة مسيحية كلمات", "تسبيح وعبادة مسيحية كلمات", "ترنيمة مترجمة"),
    "Persian / Farsi": ("سرود پرستشی مسیحی متن", "سرود پرستشی زیرنویس", "ستایش و پرستش فارسی"),
    "Urdu": ("مسیحی عبادتی گیت کے بول", "اردو مسیحی گیت لرکس", "یسوع کے گیت الفاظ"),
    "Hindi": ("मसीही आराधना गीत लिरिक्स", "यीशु के गीत के बोल", "मसीही स्तुति गीत शब्द"),
    "Bengali": ("খ্রিস্টান উপাসনা গানের কথা", "যীশুর গান লিরিক্স"),
    "Tamil": ("தமிழ் கிறிஸ்தவ ஆராதனை பாடல் வரிகள்", "இயேசு பாடல் வரிகள்"),
    "Telugu": ("తెలుగు క్రైస్తవ ఆరాధన పాట సాహిత్యం", "యేసు పాటలు లిరిక్స్"),
    "Malayalam": ("മലയാളം ക്രിസ്തീയ ആരാധന ഗാനവരികൾ", "യേശു ഗാനം വരികൾ"),
    "Kannada": ("ಕನ್ನಡ ಕ್ರೈಸ್ತ ಆರಾಧನೆ ಹಾಡಿನ ಸಾಹಿತ್ಯ",),
    "Marathi": ("मराठी ख्रिस्ती उपासना गीताचे बोल",),
    "Gujarati": ("ગુજરાતી ખ્રિસ્તી આરાધના ગીતના શબ્દો",),
    "Nepali": ("नेपाली ईसाई आराधना गीतको बोल",),
    "Mandarin Chinese": ("中文基督徒敬拜诗歌 歌词", "中文赞美诗 字幕", "敬拜赞美 歌词"),
    "Cantonese": ("粵語基督教敬拜歌 歌詞", "廣東話讚美詩 字幕"),
    "Korean": ("한국어 기독교 찬양 가사", "새 찬양 자막", "예수 찬양 가사"),
    "Japanese": ("日本語 キリスト教 賛美 歌詞", "礼拝 賛美 字幕"),
    "Vietnamese": ("thánh ca Công giáo lời bài hát", "nhạc thờ phượng lời bài hát", "thánh ca Tin Lành có lời"),
    "Thai": ("เพลงนมัสการคริสเตียน เนื้อเพลง",),
    "Indonesian": ("lagu rohani kristen lirik", "pujian penyembahan dengan lirik", "lagu gereja lirik"),
    "Malay": ("lagu rohani Kristian lirik", "lagu pujian gereja lirik"),
    "Tagalog / Filipino": ("Tagalog praise and worship lyrics", "awit papuri may lyrics", "Filipino Christian song lyrics"),
    "Swahili": ("wimbo wa kuabudu maneno", "nyimbo za sifa lyrics", "wimbo wa Yesu mashairi"),
    "Amharic": ("የአማርኛ ክርስቲያን የአምልኮ መዝሙር ግጥም",),
    "Hebrew": ("שיר הלל נוצרי מילים", "שיר עברי ישוע מילים"),
    "Afrikaans": ("Afrikaanse aanbidding lirieke", "Christelike lied lirieke"),
    "Zulu": ("Zulu worship song lyrics", "iculo lokukhonza amazwi"),
    "Xhosa": ("Xhosa worship song lyrics", "ingoma yokudumisa amazwi"),
    "Luganda": ("Luganda worship lyrics", "ennyimba z'okutendereza lyrics"),
}


ENGLISH_DEPTH_QUERIES = (
    "contemporary Christian worship official lyric video",
    "modern church worship songs with lyrics",
    "congregational worship lyric video",
    "gospel worship song lyrics",
    "traditional Christian hymn with lyrics",
    "acoustic worship official lyric video",
    "choir worship song with lyrics",
    "children's church worship song lyrics",
    "country gospel worship lyrics",
    "Catholic worship song with lyrics",
    "Anglican hymn with lyrics",
    "Pentecostal worship lyric video",
    "Maranatha worship lyric video",
    "Vineyard worship lyrics",
    "Integrity Music lyric video worship",
    "Hillsong Worship official lyric video",
    "Bethel Music official lyric video",
    "Elevation Worship official lyric video",
    "Passion worship official lyric video",
    "Matt Redman official lyric video",
    "Chris Tomlin official lyric video",
    "Phil Wickham official lyric video",
    "CityAlight official lyric video",
    "Getty Music hymn lyric video",
    "Sovereign Grace Music lyric video",
    "Maverick City worship lyrics",
    "black gospel worship song lyrics",
    "Christian praise song sing along lyrics",
)


def generic_queries(language: str) -> list[str]:
    queries = [
        f"{language} Christian worship lyrics",
        f"{language} worship song lyric video",
        f"{language} gospel song lyrics",
        f"{language} praise song with lyrics",
        f"{language} Christian hymn lyrics",
        f"modern worship {language} subtitles",
        f"Christian worship {language} English subtitles",
        f"{language} Christian karaoke worship",
        f"Christmas worship {language} lyrics",
        f"Easter worship {language} lyrics",
    ]
    queries.extend(NATIVE_QUERIES.get(language, ()))
    if language == "English":
        queries.extend(ENGLISH_DEPTH_QUERIES)
    return list(dict.fromkeys(queries))


def minimum_views(language: str, title: str) -> int:
    if re.search(r"official (?:lyric|lyrics)|english\s+(?:subtitles?|captions?)|bilingual", title, re.I):
        return 10
    return 75 if language == "English" else 20


def quality_score(item: dict) -> float:
    title = str(item.get("sourceTitle") or "")
    views = int(item.get("viewCountAtReview") or 0)
    score = math.log10(views + 1) * 2
    if item.get("languageExplicit"):
        score += 5
    if re.search(r"official (?:lyric|lyrics)|official lyrics? video", title, re.I):
        score += 6
    if re.search(r"english\s+(?:subtitles?|captions?)|bilingual|translated|translation", title, re.I):
        score += 5
    if re.search(r"lyrics?|subtitles?|paroles|letras?|lirik|歌詞|歌词|가사", title, re.I):
        score += 2
    return score


def search_job(job: tuple[str, str, str, str]) -> tuple[str, str, str, str, list[dict], str | None]:
    language, code, region, query = job
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "playlistend": RESULTS_PER_QUERY,
        "ignoreerrors": True,
        "nocheckcertificate": True,
        "extractor_retries": 2,
        "fragment_retries": 1,
    }
    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(f"ytsearch{RESULTS_PER_QUERY}:{query}", download=False) or {}
        return language, code, region, query, list(info.get("entries") or []), None
    except Exception as error:
        return language, code, region, query, [], str(error)


def main() -> None:
    quick = "--quick" in sys.argv
    language_limit = next((int(value.split("=", 1)[1]) for value in sys.argv if value.startswith("--languages=")), None)
    languages = research.LANGUAGES[:language_limit] if language_limit else research.LANGUAGES
    completed_queries: set[str] = set()
    candidates_by_id: dict[str, dict] = {}
    if OUTPUT.exists() and "--fresh" not in sys.argv:
        cached = json.loads(OUTPUT.read_text(encoding="utf-8"))
        for item in cached.get("candidates", cached if isinstance(cached, list) else []):
            video_id = str(item.get("youtubeId") or "")
            if video_id:
                candidates_by_id[video_id] = item
        completed_queries.update(cached.get("completedQueries", []))

    existing_ids = research.existing_video_ids()
    jobs: list[tuple[str, str, str, str]] = []
    for language, code, region in languages:
        queries = generic_queries(language)
        if quick:
            queries = queries[:3]
        for query in queries:
            key = f"{language}\t{query}"
            if key not in completed_queries:
                jobs.append((language, code, region, query))

    lock = threading.Lock()
    errors: list[dict[str, str]] = []
    completed = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(search_job, job) for job in jobs]
        for future in as_completed(futures):
            language, code, region, query, entries, error = future.result()
            key = f"{language}\t{query}"
            if error:
                errors.append({"language": language, "query": query, "error": error})
            else:
                completed_queries.add(key)
            for rank, entry in enumerate(entries, start=1):
                if not entry:
                    continue
                video_id = str(entry.get("id") or "")
                title = str(entry.get("title") or "").strip()
                channel = str(entry.get("channel") or entry.get("uploader") or "").strip()
                duration = int(entry.get("duration") or 0)
                views = int(entry.get("view_count") or 0)
                evidence = research.word_evidence(title)
                if (
                    not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id)
                    or video_id in existing_ids
                    or not title
                    or not channel
                    or not evidence
                    or not duration
                    or duration < 75
                    or duration > 900
                    or views < minimum_views(language, title)
                    or not research.is_quality_row(title, channel, language, code)
                ):
                    continue
                explicit = research.has_language_signal(title, channel, language, code)
                item = {
                    "language": language if explicit else "Language not stated",
                    "languageCode": code if explicit else "und",
                    "region": region if explicit else "International / verify before use",
                    "query": query,
                    "rank": rank,
                    "youtubeId": video_id,
                    "sourceTitle": title,
                    "sourceChannel": channel,
                    "durationSeconds": duration,
                    "viewCountAtReview": views,
                    "sourceChannelUrl": entry.get("channel_url"),
                    "wordEvidence": evidence,
                    "languageExplicit": explicit,
                }
                current = candidates_by_id.get(video_id)
                if current is None or quality_score(item) > quality_score(current):
                    candidates_by_id[video_id] = item
            completed += 1
            if completed % 25 == 0:
                with lock:
                    OUTPUT.write_text(json.dumps({
                        "completedQueries": sorted(completed_queries),
                        "candidates": sorted(candidates_by_id.values(), key=quality_score, reverse=True),
                    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
                print(json.dumps({"completed": completed, "jobs": len(jobs), "candidates": len(candidates_by_id)}), flush=True)

    candidates = sorted(candidates_by_id.values(), key=quality_score, reverse=True)
    OUTPUT.write_text(json.dumps({
        "completedQueries": sorted(completed_queries),
        "candidates": candidates,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    explicit_languages = {str(item["language"]) for item in candidates if item["language"] != "Language not stated"}
    print(json.dumps({
        "output": str(OUTPUT),
        "queries_run": len(jobs),
        "queries_completed_total": len(completed_queries),
        "candidates": len(candidates),
        "explicit_languages": len(explicit_languages),
        "errors": len(errors),
        "sample_errors": errors[:5],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
