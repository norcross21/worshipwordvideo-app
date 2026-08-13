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
# This is a capacity ceiling, not a promised public count. It leaves room for
# the 500-per-language programme while the importer continues to publish only
# videos that pass the word, worship, duration and live-embed checks.
TARGET = 75000
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
    ("Setswana", "tn", "Botswana / Southern Africa"),
    ("Chichewa", "ny", "Malawi / Southern Africa"),
    ("Kirundi", "rn", "Burundi / diaspora"),
    ("Akan", "ak", "Ghana / diaspora"),
    ("Ewe", "ee", "Ghana / Togo / diaspora"),
    ("Ga", "gaa", "Ghana / diaspora"),
    ("Wolof", "wo", "Senegal / West Africa"),
    ("Catalan", "ca", "Catalonia / diaspora"),
    ("Basque", "eu", "Basque Country / diaspora"),
    ("Galician", "gl", "Galicia / diaspora"),
    ("Welsh", "cy", "Wales"),
    ("Irish", "ga", "Ireland"),
    ("Bosnian", "bs", "Bosnia and Herzegovina / diaspora"),
    ("Slovenian", "sl", "Slovenia"),
    ("Macedonian", "mk", "North Macedonia / diaspora"),
    ("Azerbaijani", "az", "Azerbaijan / diaspora"),
    ("Kazakh", "kk", "Kazakhstan / diaspora"),
    ("Uzbek", "uz", "Uzbekistan / diaspora"),
    ("Kyrgyz", "ky", "Kyrgyzstan / diaspora"),
    ("Tajik", "tg", "Tajikistan / diaspora"),
    ("Turkmen", "tk", "Turkmenistan / diaspora"),
    ("Mongolian", "mn", "Mongolia / diaspora"),
    ("Assyrian / Aramaic", "syr", "Middle East / diaspora"),
    ("Odia", "or", "India"),
    ("Assamese", "as", "India"),
    ("Konkani", "kok", "India"),
    ("Mizo", "lus", "India / Myanmar / diaspora"),
    ("Khasi", "kha", "India / Bangladesh"),
    ("Javanese", "jv", "Indonesia"),
    ("Sundanese", "su", "Indonesia"),
    ("Batak", "bbc", "Indonesia"),
    ("Hmong", "hmn", "Southeast Asia / diaspora"),
    ("Tok Pisin", "tpi", "Papua New Guinea"),
    ("Quechua", "qu", "Andes / Latin America"),
]

WORD_PATTERNS = [
    ("lyrics", re.compile(r"\blyrics?\b", re.I)),
    ("words", re.compile(
        r"\b(?:with|on[- ]screen|scrolling|displayed|showing)\s+(?:the\s+)?words?\b|"
        r"\bwords?\s+(?:in\s+(?:english|[a-z]+(?:\s+[a-z]+)?)|on[- ]screen|video|included)\b|"
        r"sing[ -]?along|karaoke",
        re.I,
    )),
    ("subtitles", re.compile(r"subtitles?|captions?|subtitled|translated|translation", re.I)),
    ("local-language words", re.compile(
        r"letras?|legendad[oa]|subtitulado|paroles|sous[- ]titres|untertitel|napisy|tekst|"
        r"(?:con\s+)?testo|con\s+parole|sottotitoli|"
        r"tradu[cç][aã]o|traducci[oó]n|traduction|текст|слова|ترجمه|زیرنویس|كلمات|مترجم|"
        r"가사|자막|歌詞|字幕|歌词|lời bài hát|phụ đề|"
        r"sözleri|liedtext|liedtekst|dalsz[oö]veg|versuri|stihovi|stihovi|sångtext|sangtekst|"
        r"στίχοι|מילים|Բառեր|ტექსტი|متن سرود|گیت کے بول|"
        r"गीत के बोल|लिरिक्स|গানের কথা|লিরিক্স|பாடல் வரிகள்|పాట సాహిత్యం|"
        r"ഗാനവരികൾ|ಹಾಡಿನ ಸಾಹಿತ್ಯ|गीताचे बोल|ગીતના શબ્દો|गीतको बोल|ගී පද|ਬੋਲ|ግጥሚ|"
        r"เนื้อเพลง|lirik|lirieke|ọ̀?rọ̀?|"
        r"\b(?:mashairi|maneno|kalmomi|jechoota|erayo|mawu|amagambo|mazwi|ns[eɛ]m)\b|"
        r"lyrics? video",
        re.I,
    )),
]

REJECT = re.compile(
    r"\b(1|2|3|4|5|6|7|8|9|10|12|24)\s*hours?\b|non[- ]?stop|full album|playlist|compilation|"
    r"reaction|tutorial|lesson|how to play|instrumental tutorial|shorts?\b|nightcore|sped up|slowed|"
    r"worship mix|prayer mix|medley|top \d+|best \d+|sermon|debate|podcast|interview|bible study|"
    r"documentary|apologetics|q\s*&\s*a|questions? and answers?|lecture|baptism testimony|christian testimony|"
    r"news report|worship tutorial|how to play|spoken word|narration|devotional|meditation|affirmation|"
    r"prayer for|scripture reading|bible reading|psalm \d+ reading|behind the scenes|teaser|trailer|episode|vlog|"
    r"birthday song|national anthem|school song|military hymn|the marines.? hymn|hymn for the weekend|"
    r"champions league|football anthem|soccer anthem|club anthem|team anthem|sports anthem|"
    r"jingle bells|rudolph|frosty|santa|holly jolly|let it snow|bhakti|shiva|krishna|quran|nasheed|"
    r"bollywood|romantic song|love song|movie soundtrack|film song|god gave me you|there you.ll be|"
    r"jesus,? take the wheel|something in the water|god.s country|praise jah in the moonlight|"
    r"praise to the man|500 miles|rahman baba|sacred madness|allah loves praise|am i god|"
    r"church of almighty god|全能神教会|全能神教會|ai[- ]generated|ai\s+(?:cover|rumba|gospel|worship|christian|music|lyric)|"
    r"suno(?: ai| music)?|created with ai|ai\s+20\d{2}|lyrics? video ai|lyrics? in (?:the )?description|lyrics? below|audio only|without words|"
    r"lds primary|latter[- ]day saints?|\blds\b|jehovah.?s witnesses?|hindu goddess|buddhist worship|"
    r"long black train|carrie underwood\s*[-–—]\s*church bells|the star\s*[-–—]\s*mariah carey|"
    r"mariah carey.*the star|celine dion.*(?:wonderful jesus|living god)|romeo santos.*inocente|"
    r"genghis khan|taylor swift.*love story|march of the templars|"
    r"vishnu|krishana|hindu temple|\boh buddha\b|\bnaat\b|bah[aá][’'i]|abdu.?l[- ]bah[aá]|"
    r"papal regina coeli|\bangelus\b|the gospel truth i[-–—]ii[-–—]iii|take me home,? country roads|"
    r"the savior arabic with italian subtitles|la luce di ges[uù].*mellifluous|"
    r"nat king cole.*the christmas song|the christmas song.*nat king cole|"
    r"learn (?:the )?[a-z]+ language|language teacher|"
    r"how to interpret scriptures|decision vs commitment|deliverance from sin|paul washer|"
    r"what jesus said about muhammad|syrian kurds open first church|jesus calls and sends 12 apostles|"
    r"jesus\W+samoan translation\W+part|present your bodies as a living sacrifice|"
    r"\bneed god\??\s*(?:\||$)|love story lyrics and chords|seri makhluk[- ]makhluk rohani",
    re.I,
)

EXCLUDED_CHANNEL = re.compile(
    r"worship jamz|szabo music|worship rehearsal videos|top gospel mix|christian love songs|"
    r"almightygod|almighty god church|ang iglesia ng makapangyarihang diyos|"
    r"ibandla likankulunkulu usomandla|god.?s words|efy karaoke|islamic naat|buddhist worship|"
    r"hari priya positivity|divineechoes|modern tunes|ai ncm zone|ai gospel music|the bible with ai|"
    r"account appena hackerato|"
    r"église de dieu tout-puissant|церковь всемогущего бога|sunrise ministry|"
    r"sportskillers tv|jr videos|ern3sto|^god lyrics$",
    re.I,
)

# Popular secular songs and artists can accidentally satisfy generic religious
# words such as "God", "church", "Christian" or "worship". Keep these known
# false matches out without weakening discovery of genuine worship songs.
SECULAR_FALSE_POSITIVE = re.compile(
    r"(?:drake.*god.?s plan|god.?s plan.*drake|hozier.*take me to church|take me to church.*hozier|"
    r"ghost.*mary on a cross|mary on a cross.*ghost|ariana grande.*god is a woman|god is a woman.*ariana grande|"
    r"tupac.*only god can judge me|only god can judge me.*tupac|christian nodal|christian french|rotting christ|"
    r"sabaton.*gott mit uns|gott mit uns.*sabaton|gott erhalte.*(?:austria|kaiser|franz|imperial|anthem)|"
    r"we are the world|morgan wallen.*man made a bar|man made a bar.*morgan wallen|"
    r"anti[- ]flag.*christian nationalist|christian nationalist.*anti[- ]flag|"
    r"(?:a7x|avenged sevenfold).*dear god|dear god.*(?:a7x|avenged sevenfold)|"
    r"amber run.*worship|worship.*amber run|laces.*worship|worship.*laces|"
    r"lord huron.*the night we met|the night we met.*lord huron|"
    r"don williams.*lord,? i hope this day is good|lord,? i hope this day is good.*don williams|"
    r"aaron lewis.*everybody talks to god|everybody talks to god.*aaron lewis|"
    r"red clay strays.*god does|god does.*red clay strays)",
    re.I,
)

CHRISTIAN_SIGNAL = re.compile(
    r"\b(?:jesus|yeshua|yesu|yeshu|christ|christian|god|lord|yahweh|adonai|holy spirit|holy ghost|worship|"
    r"gospel|praise|hymn|psalm|faith|grace|cross|church|ministry|maranatha|bethel|hillsong|elevation|"
    r"dios|cristo|alabanza|adoraci[oó]n|iglesia|deus|louvor|adora[cç][aã]o|igreja|dieu|j[eé]sus|"
    r"louange|[eé]glise|gott|christus|lobpreis|anbetung|kirche|dio|ges[uù]|lode|chiesa|"
    r"chrze[sś]cija[nń]|cre[sș]tin|k[rř]es[tť]ansk|kereszt[eé]ny|kr[sš][cć]ansk|"
    r"krishter|cr[ií]osta[ií]|gristnogol)\b|"
    r"бог|иисус|господ|христ|поклон|хвал|церк|مسیح|عیسی|پرستش|سرود|المسيح|يسوع|الرب|ترنيمة|عبادة|"
    r"예수|하나님|주님|찬양|교회|敬拜|赞美|讚美|耶稣|耶穌|上帝|礼拝|賛美|イエス|"
    r"\bch[uú]a\b|th[aá]nh ca|tin l[aà]nh|tuhan|pujian|penyembahan|rohani|mungu|ibada|sifa|ọlọrun|olodumare|"
    r"jizọs|masiixi|kirista|kristo|jesu|iesu|íosa|waaqa|քրիստ|հիսուս|ქრისტ|იესო|"
    r"यीशु|मसीही|ईसाई|ख्रिस्ती|आराधना|যীশু|খ্রিস্টান|উপাসনা|"
    r"இயேசு|கிறிஸ்தவ|ஆராதனை|యేసు|క్రైస్తవ|ఆరాధన|യേശു|ക്രിസ്തീയ|ആരാധന|"
    r"ಕ್ರೈಸ್ತ|ಆರಾಧನೆ|นมัสการ|คริสเตียน|አምልኮ|ክርስቲያን|ክርስትያን|"
    r"хришћан|християн|مسیحي|مسیحی",
    re.I,
)

SONG_CONTEXT = re.compile(
    r"\b(?:song|music|worship|gospel|praise|hymn|psalm|chant|karaoke|choir|lyrics?|sing[ -]?along|"
    r"louvor|adora[cç][aã]o|louange|cantique|lobpreis|lied|alabanza|adoraci[oó]n|himno|"
    r"canto|canzone|lode|adorazione|inno|"
    r"pujian|penyembahan|rohani|th[aá]nh ca|ibada|sifa|letras?|paroles|liedtext|liedtekst|"
    r"lirik|versuri|napisy|tekst|sözleri|uwielbienie|pie[sś][nń]|c[aâ]ntare|[iî]nchinare|"
    r"chv[aá]la|p[ií]se[nň]|piese[nň]|dics[oő][ií]t[oő]|[eé]nek|pjesma|slavljenje|"
    r"tap[iı]nma|ilahi|adhurimi|lavd[eë]rimi|addoli|adhradh)\b|"
    r"песн|пісн|поклон|хвал|суруд|پرستش|ترنيمة|تسبيح|"
    r"orin|abụ|egwu|waƙa|wakar|faarfannaa|sirba|hees|nzembo|indirimbo|nyimbo|"
    r"rwiyo|nziyo|ennyimba|dwom|cân|amhrán|"
    r"መዝሙር|찬양|예배|가사|자막|敬拜|赞美|讚美|賛美|礼拝|歌詞|歌词|字幕|นมัสการ|เพลง|आराधना|উপাসনা|ஆராதனை|ఆరాధన|ആരാധന",
    re.I,
)

SUBTITLE_ONLY_EVIDENCE = re.compile(r"subtitles?|captions?|subtitled|translated|translation", re.I)
STRONG_MUSIC_CHANNEL = re.compile(
    r"\b(?:music|worship|songs?|lyrics?|karaoke|hymns?|choir|louange|praise|lobpreis|alabanza|louvor)\b|"
    r"찬양|敬拜|讚美|赞美|賛美|پرستش|ترنيم",
    re.I,
)

AMBIGUOUS_SPOKEN_PROGRAMME = re.compile(
    r"\b(?:film|testimon(?:y|ies)|gospel video|gospel message|christian message|my story with god)\b",
    re.I,
)
EXPLICIT_MUSIC_TITLE = re.compile(
    r"\b(?:song|music|hymn|psalm|chant|karaoke|choir|lyrics?|lyric video|sing[ -]?along)\b|"
    r"песн|пісн|суруд|ترنيمة|تسبيح|찬양|예배|歌詞|歌词|賛美|礼拝|เพลง|आराधना|উপাসনা|ஆராதனை|ఆరాధన|ആരാധന",
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
    "sr": re.compile(r"srpsk|српск|хришћан|слављењ", re.I),
    "bg": re.compile(r"българск|християнск|хваление", re.I),
    "tr": re.compile(r"t[uü]rk[cç]e|s[oö]zleri|altyaz", re.I),
    "ar": re.compile(r"عربي|العربية|ترنيمة|تسبيح|يسوع|المسيح", re.I),
    "fa": re.compile(r"فارسی|پرستش|سرود|عیسی|مسیحی", re.I),
    "ur": re.compile(r"اردو|مسیحی|گیت|یسوع", re.I),
    "pa": re.compile(r"ਪੰਜਾਬੀ|ਮਸੀਹੀ|ਯਿਸੂ|ਭਗਤੀ|ਉਸਤਤ", re.I),
    "hi": re.compile(r"हिन्दी|मसीही|आराधना|यीशु", re.I),
    "mr": re.compile(r"मराठी|ख्रिस्ती|उपासना", re.I),
    "ne": re.compile(r"नेपाली|ईसाई|आराधना", re.I),
    "bn": re.compile(r"বাংলা|খ্রিস্টান|উপাসনা|যীশু", re.I),
    "zh": re.compile(r"中文|国语|國語|普通话|普通話|敬拜|赞美|讚美", re.I),
    "yue": re.compile(r"粵語|粤语|廣東話|广东话", re.I),
    "am": re.compile(r"አማርኛ|የአምልኮ|የክርስቲያን", re.I),
    "ti": re.compile(r"ትግርኛ|መዝሙር", re.I),
    "om": re.compile(r"afaan oromoo|oromo|faarfannaa|waaqeffannaa", re.I),
    "so": re.compile(r"somali|hees|cibaado|masiixi", re.I),
    "vi": re.compile(r"ti[eế]ng vi[eệ]t|lời bài hát|phụ đề|th[aá]nh ca", re.I),
    "id": re.compile(r"bahasa indonesia|lirik|rohani|pujian", re.I),
    "ms": re.compile(r"bahasa melayu|lirik", re.I),
    "tl": re.compile(r"tagalog|filipino|awit|papuri", re.I),
    "sw": re.compile(r"kiswahili|swahili|mungu|yesu|ibada|sifa", re.I),
    "yo": re.compile(r"yoruba|orin|ijosin|ìjọsìn|iyin", re.I),
    "ig": re.compile(r"igbo|abụ|egwu|jizọs|ofufe", re.I),
    "ha": re.compile(r"hausa|waƙa|wakar|yabon|bautar", re.I),
    "zu": re.compile(r"zulu|isizulu|iculo|ukukhonza", re.I),
    "xh": re.compile(r"xhosa|isixhosa|ingoma|yokudumisa", re.I),
    "lg": re.compile(r"luganda|ennyimba|okutendereza", re.I),
    "tw": re.compile(r"twi|ayeyi|nnwom|som dwom", re.I),
    "sn": re.compile(r"shona|rwiyo|nziyo|kunamata|kurumbidza", re.I),
    "rw": re.compile(r"kinyarwanda|indirimbo|kuramya|guhimbaza", re.I),
    "ln": re.compile(r"lingala|nzembo|losambo|kokumisa", re.I),
    "af": re.compile(r"afrikaans|lirieke", re.I),
    "ca": re.compile(r"catal[aà]|lletra|lloan[cç]a", re.I),
    "eu": re.compile(r"euskara|euskaraz|abesti|gurtza", re.I),
    "gl": re.compile(r"galego|galega|letra|louvanza", re.I),
    "cy": re.compile(r"cymraeg|geiriau|addoliad", re.I),
    "ga": re.compile(r"gaeilge|focail|adhradh", re.I),
    "sq": re.compile(r"shqip|shqiptar|adhurimi|lavdërimi", re.I),
    "hy": re.compile(r"հայերեն|քրիստոնեական|երկրպագության|փառաբանություն", re.I),
    "ka": re.compile(r"ქართული|ქრისტიანული|სადიდებელი|თაყვანისცემა", re.I),
    "ku": re.compile(r"kurd[iî]|xiristiyan|perestiy|پەرستن|مەسیحی", re.I),
    "prs": re.compile(r"دری|سرود|پرستشی|مسیحی", re.I),
    "ps": re.compile(r"پښتو|مسیحي|عبادت|ستاینه", re.I),
    "bs": re.compile(r"bosansk|tekst pjesme|slavljenje", re.I),
    "sl": re.compile(r"slovensk|besedilo|slaviln", re.I),
    "mk": re.compile(r"македонск|христијан", re.I),
    "az": re.compile(r"azərbaycan|mahnı sözləri|ibadət", re.I),
    "kk": re.compile(r"қазақ|ән мәтіні|мадақ", re.I),
    "ky": re.compile(r"кыргыз|сыйынуу|мактоо", re.I),
    "tg": re.compile(r"тоҷик|суруди масеҳӣ|ибодат", re.I),
    "uz": re.compile(r"o['‘’]?zbek|qo['‘’]?shiq matni|sajda", re.I),
    "mn": re.compile(r"монгол|дууны үг|магтаал", re.I),
    "or": re.compile(r"odia|oriya|ଓଡ଼ିଆ|ଗୀତ", re.I),
    "as": re.compile(r"assamese|অসমীয়া|গান", re.I),
    "jv": re.compile(r"jawa|javanese|lagu rohani", re.I),
    "su": re.compile(r"sunda|sundanese|lagu rohani", re.I),
    "bbc": re.compile(r"batak|ende rohani", re.I),
    "tn": re.compile(r"setswana|sefela|difela", re.I),
    "ny": re.compile(r"chichewa|nyanja|nyimbo", re.I),
    "rn": re.compile(r"kirundi|indirimbo", re.I),
    "wo": re.compile(r"wolof|wólof", re.I),
    "tpi": re.compile(r"tok pisin|lotu song", re.I),
    "qu": re.compile(r"quechua|kichwa|takiy", re.I),
}

SCRIPT_SIGNALS: dict[str, re.Pattern[str]] = {
    "uk": re.compile(r"[ІіЇїЄєҐґ]"),
    "sr": re.compile(r"[ЉљЊњЋћЂђЈј]"),
    "el": re.compile(r"[Α-ω]"),
    "fa": re.compile(r"[پچژگ]"), "ur": re.compile(r"[ٹڈڑںھے]"),
    "pa": re.compile(r"[\u0a00-\u0a7f]"),
    "bn": re.compile(r"[\u0980-\u09ff]"), "ta": re.compile(r"[\u0b80-\u0bff]"),
    "te": re.compile(r"[\u0c00-\u0c7f]"), "kn": re.compile(r"[\u0c80-\u0cff]"),
    "ml": re.compile(r"[\u0d00-\u0d7f]"), "gu": re.compile(r"[\u0a80-\u0aff]"),
    "si": re.compile(r"[\u0d80-\u0dff]"), "ko": re.compile(r"[\uac00-\ud7af]"),
    "ja": re.compile(r"[\u3040-\u30ff]"), "th": re.compile(r"[\u0e00-\u0e7f]"),
    "he": re.compile(r"[\u0590-\u05ff]"), "hy": re.compile(r"[\u0530-\u058f]"),
    "ka": re.compile(r"[\u10a0-\u10ff]"), "or": re.compile(r"[\u0b00-\u0b7f]"),
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
    if language != "English" and re.search(r"english\s+(subtitles?|captions?|translation|lyrics?|words)|eng\s*sub", title, re.I):
        return "Native-language vocal with English subtitles"
    if language != "English" and re.search(
        r"subtitles?|translated|translation|subtitulado|legendado|sous[- ]titres|untertitel|"
        r"terjemahan|traduction|tradu[cç][aã]o|traducci[oó]n|t[lł]umaczenie|перевод|ترجمة|ترجمه|زیرنویس|번역|자막|翻訳|翻译|字幕",
        title,
        re.I,
    ):
        return "English vocal with translated subtitles"
    if language != "English" and re.search(
        rf"(?:subtitles?|sottotitoli|testo|lyrics?)\s+(?:in\s+)?{language_alias}|"
        rf"{language_alias}\s+(?:subtitles?|sottotitoli|text|lyrics?)",
        title,
        re.I,
    ) and re.search(r"hillsong|bethel|elevation|maverick|english|original", title, re.I):
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
    if REJECT.search(value) or EXCLUDED_CHANNEL.search(channel) or SECULAR_FALSE_POSITIVE.search(value):
        return False
    if not SONG_CONTEXT.search(value):
        return False
    if SUBTITLE_ONLY_EVIDENCE.search(title) and not SONG_CONTEXT.search(title) and not STRONG_MUSIC_CHANNEL.search(channel):
        return False
    if AMBIGUOUS_SPOKEN_PROGRAMME.search(title) and not EXPLICIT_MUSIC_TITLE.search(title):
        return False
    if re.search(r"\bpreaching\b", value, re.I) and not re.search(r"\b(song|hymn|lyrics?|worship music)\b", value, re.I):
        return False
    if re.search(r"\bconference\s*20\d{2}\b", title, re.I) and not re.search(r"\b(song|hymn|lyrics?|lyric video|worship|praise)\b", title, re.I):
        return False
    if re.search(r"\btalk talk\s*[-–—]\s*it'?s my life\b", value, re.I):
        return False
    return bool(CHRISTIAN_SIGNAL.search(value))


def is_existing_quality_row(title: str, channel: str, language: str, code: str) -> bool:
    """Retain earlier reviewed rows while applying the shared hard rejects.

    Older imports include many genuine translations whose title is only a song
    name plus "translated". New discovery uses the stricter song-context gate,
    but previously reviewed rows are not discarded solely for terse metadata.
    """
    value = f"{title} {channel}"
    if REJECT.search(value) or EXCLUDED_CHANNEL.search(channel) or SECULAR_FALSE_POSITIVE.search(value):
        return False
    if AMBIGUOUS_SPOKEN_PROGRAMME.search(title) and not EXPLICIT_MUSIC_TITLE.search(title):
        return False
    if re.search(r"\bpreaching\b", value, re.I) and not re.search(r"\b(song|hymn|lyrics?|worship music)\b", value, re.I):
        return False
    if re.search(r"\bconference\s*20\d{2}\b", title, re.I) and not re.search(r"\b(song|hymn|lyrics?|lyric video|worship|praise)\b", title, re.I):
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
