#!/usr/bin/env python3
"""Build a compact discovery catalogue from YouTube search metadata.

The output contains links and uploader metadata only. It never downloads audio,
video or lyrics. Run with yt-dlp available on PYTHONPATH.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"
OUTPUT = DATA_DIR / "researchedWordWorshipVideos.json"
TARGET = 5700
RESULTS_PER_QUERY = 50

LANGUAGES = [
    ("English", "en", "United Kingdom / international"),
    ("Spanish", "es", "Spain / Latin America"),
    ("Portuguese", "pt", "Brazil / Portugal"),
    ("French", "fr", "France / Francophone world"),
    ("German", "de", "Germany / Austria / Switzerland"),
    ("Italian", "it", "Italy"),
    ("Dutch", "nl", "Netherlands / Belgium"),
    ("Polish", "pl", "Poland"),
    ("Romanian", "ro", "Romania"),
    ("Ukrainian", "uk", "Ukraine"),
    ("Russian", "ru", "Eastern Europe / Central Asia"),
    ("Czech", "cs", "Czechia"),
    ("Slovak", "sk", "Slovakia"),
    ("Hungarian", "hu", "Hungary"),
    ("Croatian", "hr", "Croatia"),
    ("Serbian", "sr", "Serbia / Balkans"),
    ("Bulgarian", "bg", "Bulgaria"),
    ("Greek", "el", "Greece / Cyprus"),
    ("Turkish", "tr", "Türkiye"),
    ("Arabic", "ar", "Middle East / North Africa"),
    ("Persian / Farsi", "fa", "Iran / Persian diaspora"),
    ("Urdu", "ur", "Pakistan / South Asia"),
    ("Punjabi", "pa", "Pakistan / India / diaspora"),
    ("Hindi", "hi", "India"),
    ("Bengali", "bn", "Bangladesh / India"),
    ("Tamil", "ta", "India / Sri Lanka"),
    ("Telugu", "te", "India"),
    ("Malayalam", "ml", "India"),
    ("Kannada", "kn", "India"),
    ("Marathi", "mr", "India"),
    ("Gujarati", "gu", "India"),
    ("Nepali", "ne", "Nepal"),
    ("Sinhala", "si", "Sri Lanka"),
    ("Mandarin Chinese", "zh", "China / Taiwan / diaspora"),
    ("Cantonese", "yue", "Hong Kong / southern China / diaspora"),
    ("Korean", "ko", "Korea / diaspora"),
    ("Japanese", "ja", "Japan"),
    ("Vietnamese", "vi", "Vietnam / diaspora"),
    ("Thai", "th", "Thailand"),
    ("Indonesian", "id", "Indonesia"),
    ("Malay", "ms", "Malaysia / Brunei"),
    ("Tagalog / Filipino", "tl", "Philippines"),
    ("Swahili", "sw", "East Africa"),
    ("Yoruba", "yo", "Nigeria / West Africa"),
    ("Igbo", "ig", "Nigeria / West Africa"),
    ("Hausa", "ha", "Nigeria / West Africa"),
    ("Amharic", "am", "Ethiopia"),
    ("Oromo", "om", "Ethiopia / Horn of Africa"),
    ("Tigrinya", "ti", "Eritrea / Ethiopia"),
    ("Somali", "so", "Somalia / Horn of Africa"),
    ("Zulu", "zu", "South Africa"),
    ("Xhosa", "xh", "South Africa"),
    ("Afrikaans", "af", "Southern Africa"),
    ("Haitian Creole", "ht", "Haiti / diaspora"),
    ("Māori", "mi", "Aotearoa New Zealand"),
    ("Samoan", "sm", "Samoa / Pacific diaspora"),
    ("Tongan", "to", "Tonga / Pacific diaspora"),
    ("Fijian", "fj", "Fiji / Pacific diaspora"),
    ("Hebrew", "he", "Israel / diaspora"),
    ("Armenian", "hy", "Armenia / diaspora"),
    ("Georgian", "ka", "Georgia"),
    ("Albanian", "sq", "Albania / Kosovo"),
    ("Finnish", "fi", "Finland"),
    ("Swedish", "sv", "Sweden"),
    ("Norwegian", "no", "Norway"),
    ("Danish", "da", "Denmark"),
    ("Icelandic", "is", "Iceland"),
    ("Lithuanian", "lt", "Lithuania"),
    ("Latvian", "lv", "Latvia"),
    ("Estonian", "et", "Estonia"),
    ("Latin", "la", "International / liturgical"),
    ("Khmer", "km", "Cambodia"),
    ("Lao", "lo", "Laos"),
    ("Burmese / Myanmar", "my", "Myanmar / diaspora"),
    ("Kurdish", "ku", "Kurdistan / diaspora"),
    ("Dari", "prs", "Afghanistan / diaspora"),
    ("Pashto", "ps", "Afghanistan / Pakistan / diaspora"),
    ("Lingala", "ln", "Central Africa / diaspora"),
    ("Luganda", "lg", "Uganda"),
    ("Twi", "tw", "Ghana / diaspora"),
    ("Shona", "sn", "Zimbabwe / diaspora"),
    ("Kinyarwanda", "rw", "Rwanda / diaspora"),
    ("Ndebele", "nd", "Southern Africa"),
    ("Sesotho", "st", "Southern Africa"),
]

WORD_PATTERNS = [
    ("lyrics", re.compile(r"\blyrics?\b", re.I)),
    ("words", re.compile(r"\bwords?\b|sing[ -]?along|karaoke", re.I)),
    ("subtitles", re.compile(r"subtitles?|captions?|subtitled|translated|translation", re.I)),
    ("local-language words", re.compile(
        r"letras?|legendad[oa]|subtitulado|paroles|sous[- ]titres|untertitel|napisy|tekst|"
        r"текст|слова|ترجمه|زیرنویس|كلمات|مترجم|가사|자막|歌詞|字幕|歌词|lời bài hát",
        re.I,
    )),
]

REJECT = re.compile(
    r"\b(1|2|3|4|5|6|7|8|9|10|12|24)\s*hours?\b|non[- ]?stop|full album|playlist|compilation|"
    r"reaction|tutorial|lesson|how to play|instrumental tutorial|shorts?\b|nightcore|sped up|slowed|"
    r"worship mix|prayer mix|medley|top \d+|best \d+|sermon|debate|podcast|interview|bible study|"
    r"documentary|apologetics|q\s*&\s*a|questions? and answers?|lecture|baptism testimony|christian testimony|"
    r"news report|worship tutorial|how to play|spoken word|devotional|meditation|affirmation|"
    r"prayer for|scripture reading|psalm \d+ reading|behind the scenes|teaser|trailer|episode|vlog|"
    r"birthday song|national anthem|school song|military hymn|the marines.? hymn|hymn for the weekend|"
    r"jingle bells|rudolph|frosty|santa|holly jolly|let it snow|bhakti|shiva|krishna|quran|nasheed|"
    r"bollywood|romantic song|love song|movie soundtrack|film song|god gave me you|there you.ll be|"
    r"jesus,? take the wheel|something in the water|god.s country|praise jah in the moonlight|"
    r"praise to the man|500 miles|rahman baba|sacred madness|allah loves praise|am i god|"
    r"church of almighty god|全能神教会|全能神教會",
    re.I,
)

CHRISTIAN_SIGNAL = re.compile(
    r"\b(?:jesus|yeshua|yesu|yeshu|christ|christian|god|lord|yahweh|adonai|holy spirit|holy ghost|worship|"
    r"gospel|praise|hymn|psalm|faith|grace|cross|church|ministry|maranatha|bethel|hillsong|elevation|"
    r"dios|cristo|alabanza|adoraci[oó]n|iglesia|deus|louvor|adora[cç][aã]o|igreja|dieu|j[eé]sus|"
    r"louange|[eé]glise|gott|christus|lobpreis|anbetung|kirche|dio|ges[uù]|lode|chiesa)\b|"
    r"бог|иисус|господ|христ|поклон|хвал|церк|مسیح|عیسی|پرستش|سرود|المسيح|يسوع|الرب|ترنيمة|عبادة|"
    r"예수|하나님|주님|찬양|교회|敬拜|赞美|讚美|耶稣|耶穌|上帝|礼拝|賛美|イエス|"
    r"ch[uú]a|th[aá]nh ca|tin l[aà]nh|tuhan|pujian|penyembahan|rohani|mungu|ibada|sifa|ọlọrun|olodumare",
    re.I,
)

LOCAL_LANGUAGE_SIGNALS: dict[str, re.Pattern[str]] = {
    "es": re.compile(r"espa[nñ]ol|castellano|letras?|subtitulado|adoraci[oó]n|alabanza", re.I),
    "pt": re.compile(r"portugu[eê]s|letras?|legendad[oa]|louvor|adora[cç][aã]o", re.I),
    "fr": re.compile(r"fran[cç]ais|paroles|sous[- ]titres|louange", re.I),
    "de": re.compile(r"deutsch|untertitel|liedtext|lobpreis", re.I),
    "it": re.compile(r"italiano|testo|con testo|sottotitoli", re.I),
    "nl": re.compile(r"nederlands|ondertitels|liedtekst", re.I),
    "pl": re.compile(r"polski|tekst|napisy", re.I),
    "ro": re.compile(r"rom[aâ]n|versuri|subtitrare", re.I),
    "cs": re.compile(r"[cč]esk|text p[ií]sn[eě]", re.I),
    "sk": re.compile(r"slovensk|text piesne", re.I),
    "hu": re.compile(r"magyar|dalsz[oö]veg", re.I),
    "hr": re.compile(r"hrvatsk|tekst", re.I),
    "tr": re.compile(r"t[uü]rk[cç]e|s[oö]zleri|altyaz", re.I),
    "vi": re.compile(r"ti[eế]ng vi[eệ]t|lời bài hát|phụ đề|th[aá]nh ca", re.I),
    "id": re.compile(r"bahasa indonesia|lirik|rohani|pujian", re.I),
    "ms": re.compile(r"bahasa melayu|lirik", re.I),
    "tl": re.compile(r"tagalog|filipino|awit|papuri", re.I),
    "sw": re.compile(r"kiswahili|swahili|mungu|yesu|ibada|sifa", re.I),
    "af": re.compile(r"afrikaans|lirieke", re.I),
}

SCRIPT_SIGNALS: dict[str, re.Pattern[str]] = {
    "uk": re.compile(r"[А-Яа-яІіЇїЄєҐґ]"), "ru": re.compile(r"[А-Яа-яЁё]"),
    "bg": re.compile(r"[А-Яа-я]"), "sr": re.compile(r"[А-Яа-яЉљЊњЋћЂђЈј]"),
    "el": re.compile(r"[Α-ω]"), "ar": re.compile(r"[\u0600-\u06ff]"),
    "fa": re.compile(r"[\u0600-\u06ff]"), "ur": re.compile(r"[\u0600-\u06ff]"),
    "pa": re.compile(r"[\u0600-\u06ff\u0a00-\u0a7f]"), "hi": re.compile(r"[\u0900-\u097f]"),
    "mr": re.compile(r"[\u0900-\u097f]"), "ne": re.compile(r"[\u0900-\u097f]"),
    "bn": re.compile(r"[\u0980-\u09ff]"), "ta": re.compile(r"[\u0b80-\u0bff]"),
    "te": re.compile(r"[\u0c00-\u0c7f]"), "kn": re.compile(r"[\u0c80-\u0cff]"),
    "ml": re.compile(r"[\u0d00-\u0d7f]"), "gu": re.compile(r"[\u0a80-\u0aff]"),
    "si": re.compile(r"[\u0d80-\u0dff]"), "zh": re.compile(r"[\u3400-\u9fff]"),
    "yue": re.compile(r"[\u3400-\u9fff]"), "ko": re.compile(r"[\uac00-\ud7af]"),
    "ja": re.compile(r"[\u3040-\u30ff]"), "th": re.compile(r"[\u0e00-\u0e7f]"),
    "he": re.compile(r"[\u0590-\u05ff]"), "hy": re.compile(r"[\u0530-\u058f]"),
    "ka": re.compile(r"[\u10a0-\u10ff]"), "am": re.compile(r"[\u1200-\u137f]"),
    "ti": re.compile(r"[\u1200-\u137f]"),
}


def existing_video_ids() -> set[str]:
    ids: set[str] = set()
    for path in DATA_DIR.iterdir():
        if path.name in {OUTPUT.name, "worshipVideoAudit.ts"} or path.suffix not in {".ts", ".json"}:
            continue
        text = path.read_text(encoding="utf-8")
        ids.update(re.findall(r"[\"']([A-Za-z0-9_-]{11})[\"']", text))
    return ids


def arrangement(title: str, channel: str) -> str:
    value = f"{title} {channel}".lower()
    if re.search(r"a\s*cappella|acapella|unaccompanied", value): return "A cappella"
    if re.search(r"country|bluegrass|southern gospel|nashville", value): return "Country / bluegrass"
    if re.search(r"choir|choral|chorale|chorus|schola|cantorei|cantata", value): return "Choir / choral"
    if re.search(r"acoustic|unplugged|piano only|guitar only", value): return "Acoustic / unplugged"
    if re.search(r"orchestra|orchestral|symphon|instrumental", value): return "Orchestral / instrumental"
    if re.search(r"children|kids|family worship|school worship", value): return "Children / family"
    if re.search(r"gregorian|chant|taiz[eé]|byzantine|liturgy|liturgical", value): return "Chant / liturgical"
    if re.search(r"gospel|spiritual|gaither", value): return "Gospel"
    if re.search(r"\blive\b|concert|worship night|conference", value): return "Live worship"
    if re.search(r"hymn|organ|traditional", value): return "Traditional hymn"
    return "Contemporary worship"


def presentation(title: str, language: str) -> str:
    language_alias = re.escape(language.split('/')[0].strip())
    if re.search(r"bilingual|dual language|two languages", title, re.I):
        return "Bilingual vocal or subtitles"
    if re.search(r"english", title, re.I) and re.search(language_alias, title, re.I) and not re.search(r"subtitles?|translation|translated", title, re.I):
        return "Bilingual vocal or subtitles"
    if language != "English" and re.search(r"english\s+(subtitles?|captions?|translation)|eng\s*sub", title, re.I):
        return "Native-language vocal with English subtitles"
    if language != "English" and re.search(r"subtitles?|translated|translation|subtitulado|legendado|sous[- ]titres|untertitel|ترجمه|زیرنویس|자막|字幕", title, re.I):
        return "English vocal with translated subtitles"
    if language != "English" and re.search(rf"with\s+{language_alias}\s+(?:lyric )?text|{language_alias}\s+(?:lyrics?|words)", title, re.I):
        return "English vocal with translated subtitles"
    if language == "English":
        return "English vocal with English words"
    return "Native-language vocal with native words"


def word_evidence(title: str) -> str | None:
    for label, pattern in WORD_PATTERNS:
        match = pattern.search(title)
        if match:
            return f'{label}: "{match.group(0)}"'
    return None


def has_language_signal(title: str, channel: str, language: str, code: str) -> bool:
    value = f"{title} {channel}"
    if language == "English":
        return True
    aliases = [part.strip().lower() for part in re.split(r"/", language)]
    lowered = value.lower()
    if any(re.search(rf"\b{re.escape(alias)}\b", lowered) for alias in aliases):
        return True
    local = LOCAL_LANGUAGE_SIGNALS.get(code)
    script = SCRIPT_SIGNALS.get(code)
    return bool((local and local.search(value)) or (script and script.search(value)))


def is_quality_row(title: str, channel: str, language: str, code: str) -> bool:
    value = f"{title} {channel}"
    if REJECT.search(value):
        return False
    if re.search(r"\bpreaching\b", value, re.I) and not re.search(r"\b(song|hymn|lyrics?|worship music)\b", value, re.I):
        return False
    if re.search(r"\bconference\s*20\d{2}\b", value, re.I) and not re.search(r"\b(song|hymn|lyrics?|worship|praise)\b", value, re.I):
        return False
    if re.search(r"\btalk talk\s*[-–—]\s*it'?s my life\b", value, re.I):
        return False
    return bool(CHRISTIAN_SIGNAL.search(value))


def query_for(language: str, translated: bool) -> str:
    if translated:
        return f'modern Christian worship songs {language} subtitles lyric video'
    return f'{language} Christian worship song lyrics lyric video'


def main() -> None:
    existing = existing_video_ids()
    loaded_rows: list[list[object]] = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else []
    base_rows: list[list[object]] = []
    for loaded in loaded_rows:
        row = list(loaded)
        if not is_quality_row(str(row[1]), str(row[2]), str(row[3]), str(row[4])):
            continue
        row[6] = arrangement(str(row[1]), str(row[2]))
        row[7] = presentation(str(row[1]), str(row[3]))
        base_rows.append(row)
    if "--clean-only" in sys.argv:
        OUTPUT.write_text(json.dumps(base_rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(json.dumps({"cleaned": len(base_rows), "removed": len(loaded_rows) - len(base_rows)}, indent=2))
        return
    from yt_dlp import YoutubeDL

    by_language: dict[str, list[list[object]]] = {language: [] for language, _, _ in LANGUAGES}
    seen = set(existing) | {str(row[0]) for row in base_rows}
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "nocheckcertificate": True,
        "ignoreerrors": True,
        "extractor_retries": 2,
        "playlistend": RESULTS_PER_QUERY,
        "sleep_interval_requests": 0.5,
    }

    with YoutubeDL(options) as ydl:
        for language, code, region in LANGUAGES:
            for translated in (False, True):
                info = ydl.extract_info(
                    f"ytsearch{RESULTS_PER_QUERY}:{query_for(language, translated)}",
                    download=False,
                ) or {}
                for entry in info.get("entries") or []:
                    if not entry:
                        continue
                    video_id = str(entry.get("id") or "")
                    title = str(entry.get("title") or "").strip()
                    channel = str(entry.get("channel") or entry.get("uploader") or "").strip()
                    duration = int(entry.get("duration") or 0)
                    evidence = word_evidence(title)
                    if (
                        not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id)
                        or video_id in seen
                        or not title
                        or not channel
                        or not evidence
                        or not is_quality_row(title, channel, language, code)
                        or REJECT.search(title)
                        or (duration and (duration < 75 or duration > 900))
                    ):
                        continue
                    seen.add(video_id)
                    stated_language = has_language_signal(title, channel, language, code)
                    stored_language = language if stated_language else "Language not stated"
                    by_language[language].append([
                        video_id,
                        title,
                        channel,
                        stored_language,
                        code if stated_language else "und",
                        region if stated_language else "International / verify before use",
                        arrangement(title, channel),
                        presentation(title, language) if stated_language else "Words or subtitles indicated",
                        evidence,
                        duration,
                        date.today().isoformat(),
                    ])

    # Round-robin selection avoids letting English/Spanish swamp smaller languages.
    rows: list[list[object]] = list(base_rows)
    while len(rows) < TARGET:
        added = False
        for language, _, _ in LANGUAGES:
            bucket = by_language[language]
            if bucket:
                rows.append(bucket.pop(0))
                added = True
                if len(rows) >= TARGET:
                    break
        if not added:
            break

    OUTPUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "output": str(OUTPUT.relative_to(ROOT)),
        "selected": len(rows),
        "languages": len({row[3] for row in rows}),
        "remaining_candidates": sum(len(bucket) for bucket in by_language.values()),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
