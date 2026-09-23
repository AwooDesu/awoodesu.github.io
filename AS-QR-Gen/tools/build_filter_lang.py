"""Build filter_lang.json for the AS-QR-Gen dev copy.

Pulls element / class / faction / No-Element names for all 8 site languages
(us/tw/th/pt/kr/jp/idn/es) straight from the game lua localization, and merges
hand-written filter-chrome words (review these if you speak the language).

Usage: py tools/build_filter_lang.py
Writes ../filter_lang.json.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
LUA_BASE = r"C:\Stuff\AlchemyStarsLua\all 1.43 lua in original path\PublishResources\config\localization"
OUT = os.path.join(os.path.dirname(HERE), "filter_lang.json")

LOCALES = ["us", "tw", "th", "pt", "kr", "jp", "idn", "es"]

ELEMENT_KEYS = {"1": "str_pet_filter_water_element", "2": "str_pet_filter_fire_element",
                "3": "str_pet_filter_sen_element", "4": "str_pet_filter_electricity_element"}
CLASS_KEYS = {"2001": "str_pet_tag_job_name_color_change", "2002": "str_pet_tag_job_name_return_blood",
              "2003": "str_pet_tag_job_name_attack", "2004": "str_pet_tag_job_name_function"}
FACTION_KEYS = {str(1000 + i): "str_pet_tag_faction_name_%d" % i for i in range(1, 10)}
NONE_KEY = "str_tale_pet_att_none"

# Display name for the special element 6. The lua only has "No Element" and
# equivalents, but the site shows the shorter "None" instead.
NONE_NAMES = {
    "us": "None", "tw": "無", "th": "ไม่มี", "pt": "Nenhum",
    "kr": "없음", "jp": "なし", "idn": "Tidak Ada", "es": "Ninguno",
}

# Hand-written filter chrome (EN verified, others best-effort - please review).
# "az" is the alphabetical-sort button label: native script ranges where they exist.
CHROME = {
    "us": {"rarity": "Rarity", "class": "Class", "primary": "Primary", "secondary": "Secondary",
           "faction": "Faction", "all": "All", "az": "A–Z",
           "search": "Search..."},
    "tw": {"rarity": "稀有度", "class": "職業", "primary": "主屬性", "secondary": "副屬性",
           "faction": "陣營", "all": "全部", "az": "A–Z",
           "search": "搜尋..."},
    "th": {"rarity": "ระดับความหายาก", "class": "อาชีพ", "primary": "ธาตุหลัก", "secondary": "ธาตุรอง",
           "faction": "สังกัด", "all": "ทั้งหมด", "az": "ก–ฮ",
           "search": "ค้นหา..."},
    "pt": {"rarity": "Raridade", "class": "Classe", "primary": "Primário", "secondary": "Secundário",
           "faction": "Facção", "all": "Todos", "az": "A–Z",
           "search": "Pesquisar..."},
    "kr": {"rarity": "등급", "class": "클래스", "primary": "주 속성", "secondary": "부 속성",
           "faction": "세력", "all": "전체", "az": "가–힣",
           "search": "검색..."},
    "jp": {"rarity": "レアリティ", "class": "クラス", "primary": "主属性", "secondary": "副属性",
           "faction": "勢力", "all": "全て", "az": "あ–ん",
           "search": "検索..."},
    "idn": {"rarity": "Kelangkaan", "class": "Kelas", "primary": "Utama", "secondary": "Sekunder",
            "faction": "Fraksi", "all": "Semua", "az": "A–Z",
            "search": "Cari..."},
    "es": {"rarity": "Rareza", "class": "Clase", "primary": "Primario", "secondary": "Secundario",
           "faction": "Facción", "all": "Todos", "az": "A–Z",
           "search": "Buscar..."},
}


def find_in_locale(loc, key):
    lb = os.path.join(LUA_BASE, loc)
    for root, _dirs, files in os.walk(lb):
        for f in files:
            if not f.endswith(".lua"):
                continue
            try:
                t = open(os.path.join(root, f), encoding="utf-8").read()
            except Exception:
                continue
            if key in t:
                m = re.search(r"[^\n]*\b" + re.escape(key) + r'\s*=\s*"([^"]*)"', t)
                if m:
                    return m.group(1)
    return None


def main():
    out = {}
    for loc in LOCALES:
        entry = dict(CHROME[loc])
        entry["elements"] = {k: find_in_locale(loc, lk) for k, lk in ELEMENT_KEYS.items()}
        entry["elements"]["6"] = NONE_NAMES[loc]
        entry["classes"] = {k: find_in_locale(loc, lk) for k, lk in CLASS_KEYS.items()}
        entry["factions"] = {k: find_in_locale(loc, lk) for k, lk in FACTION_KEYS.items()}
        missing = [k for d in (entry["elements"], entry["classes"], entry["factions"])
                   for k, v in d.items() if not v]
        if missing:
            print("WARN %s missing: %s" % (loc, missing))
        out[loc] = entry
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("wrote %s" % OUT)


if __name__ == "__main__":
    main()
