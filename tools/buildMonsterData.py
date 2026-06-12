"""Refresh monster combat power data from Mabinogi World Wiki.

The source page renders its table through Semantic MediaWiki, so this script
queries the same public properties directly instead of scraping generated HTML.
"""

from __future__ import annotations

import datetime as _datetime
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RAW_OUTPUT = ROOT / "data" / "raw" / "mabinogi-world-monster-cp.json"
JS_OUTPUT = ROOT / "src" / "monsters" / "monsterRecords.js"

SOURCE_PAGE_URL = "https://wiki.mabinogiworld.com/view/List_of_Monster_CP"
API_ENDPOINT = "https://wiki.mabinogiworld.com/api.php"
USER_AGENT = "MabinogiCombatPowerDataBuilder/1.0 (https://wiki.mabinogiworld.com/view/List_of_Monster_CP)"

BASE_QUERY_PARTS = [
    "[[Monster difficulty parent::~*]]",
    "[[Monster cp::>>0]]",
    "[[Monster family::!~*Event*]]",
    "|?Monster cp",
    "|?Monster field locations list",
    "|?Monster missions list",
]

TRANSLATION_OVERRIDES = {
    "Gray Wolf": ("灰狼", "灰狼"),
    "Red Spider": ("红蜘蛛", "紅蜘蛛"),
    "Giant Spider": ("巨大蜘蛛", "巨大蜘蛛"),
    "Zombie": ("僵尸", "殭屍"),
    "Golem": ("魔像", "魔像"),
    "White Spider": ("白蜘蛛", "白蜘蛛"),
    "Black Spider": ("黑蜘蛛", "黑蜘蛛"),
    "Skeleton": ("骷髅", "骷髏"),
    "Mimic": ("宝箱怪", "寶箱怪"),
    "Imp": ("小恶魔", "小惡魔"),
    "Goblin": ("哥布林", "哥布林"),
    "Kobold": ("狗头人", "狗頭人"),
    "Ogre Warrior": ("食人魔战士", "食人魔戰士"),
}

VERSION_HINTS = [
    ("G1", ("tir chonaill", "dunbarton", "alby", "ciar", "rabbie", "math", "barri", "fiodh")),
    ("G2", ("rundal",)),
    ("G3", ("coill", "peaca")),
    ("G4", ("connous", "longa")),
    ("G5", ("metus", "par")),
    ("G8", ("zardine",)),
    ("G10", ("tara",)),
    ("G9", ("shadow", "taillteann")),
    ("G13", ("avon",)),
]

EVENT_HINTS = ("event", "halloween", "christmas", "anniversary")


def main() -> None:
    raw_rows = fetch_monster_rows()
    normalized_records = normalize_rows(raw_rows)
    runtime_records = [runtime_record(record) for record in normalized_records]

    raw_payload = {
        "sourceUrl": SOURCE_PAGE_URL,
        "apiEndpoint": API_ENDPOINT,
        "sourceQuery": "".join(BASE_QUERY_PARTS),
        "generatedAt": _datetime.datetime.now(_datetime.UTC).replace(microsecond=0).isoformat(),
        "recordCount": len(normalized_records),
        "records": normalized_records,
    }

    RAW_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    JS_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    RAW_OUTPUT.write_text(json.dumps(raw_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    JS_OUTPUT.write_text(render_js(runtime_records), encoding="utf-8")

    print(f"Wrote {len(normalized_records)} records to {RAW_OUTPUT.relative_to(ROOT).as_posix()}")
    print(f"Wrote {len(runtime_records)} records to {JS_OUTPUT.relative_to(ROOT).as_posix()}")


def fetch_monster_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0

    while True:
        query = "".join(BASE_QUERY_PARTS + [f"|limit=500|offset={offset}"])
        data = fetch_json(
            API_ENDPOINT
            + "?"
            + urllib.parse.urlencode(
                {
                    "action": "ask",
                    "query": query,
                    "format": "json",
                }
            )
        )
        query_payload = data.get("query", {})
        rows.extend(query_payload.get("results", {}).values())

        next_offset = data.get("query-continue-offset")
        if next_offset is None:
            break

        offset = int(next_offset)

    return rows


def fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def normalize_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    used_ids: dict[str, int] = {}

    for row in sorted(rows, key=row_sort_key):
        en_name = extract_name(row)
        combat_power = extract_combat_power(row)

        if not en_name or combat_power is None:
            continue

        locations = extract_locations(row)
        base_id = slugify(en_name)
        used_ids[base_id] = used_ids.get(base_id, 0) + 1
        record_id = base_id if used_ids[base_id] == 1 else f"{base_id}-{used_ids[base_id]}"
        zh_cn_name, zh_tw_name, translation_status = translate_name(en_name)

        records.append(
            {
                "id": record_id,
                "zhCNName": zh_cn_name,
                "zhTWName": zh_tw_name,
                "enName": en_name,
                "combatPower": combat_power,
                "locations": locations,
                "introducedBy": infer_introduced_by(en_name, locations),
                "isEvent": infer_is_event(en_name, locations),
                "translationStatus": translation_status,
                "source": "mabinogi-world",
                "raw": {
                    "fulltext": row.get("fulltext", ""),
                    "fullurl": row.get("fullurl", ""),
                    "displaytitle": row.get("displaytitle", ""),
                    "printouts": row.get("printouts", {}),
                },
            }
        )

    return records


def row_sort_key(row: dict[str, Any]) -> tuple[str, int, str]:
    return (extract_name(row).lower(), extract_combat_power(row) or 0, row.get("fullurl", ""))


def extract_name(row: dict[str, Any]) -> str:
    raw_name = str(row.get("displaytitle") or row.get("fulltext") or "").split("#", 1)[0]
    return clean_text(raw_name)


def extract_combat_power(row: dict[str, Any]) -> int | None:
    values = row.get("printouts", {}).get("Monster cp", [])

    if not values:
        return None

    match = re.search(r"\d[\d,]*", str(values[0]))
    return int(match.group(0).replace(",", "")) if match else None


def extract_locations(row: dict[str, Any]) -> list[str]:
    printouts = row.get("printouts", {})
    values = [
        *printouts.get("Monster field locations list", []),
        *printouts.get("Monster missions list", []),
    ]
    locations: list[str] = []
    seen: set[str] = set()

    for value in values:
        for part in split_location_value(value):
            location = clean_text(part)
            key = location.lower()
            if location and key not in seen:
                locations.append(location)
                seen.add(key)

    return locations


def split_location_value(value: Any) -> list[str]:
    text = re.sub(r"<br\s*/?>", "\n", format_printout_value(value), flags=re.IGNORECASE)
    return [part.strip() for part in re.split(r"\s*(?:,|;|\n|<br\s*/?>)\s*", text) if part.strip()]


def format_printout_value(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("fulltext") or value.get("displaytitle") or value.get("fullurl") or "")

    return str(value)


def clean_text(value: str) -> str:
    text = str(value)
    text = re.sub(r"\[\[[^|\]]+\|([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\[https?://[^\s\]]+\s+([^\]]+)\]", r"\1", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"'{2,}", "", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"^\s*[*#;:]+\s*", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "monster"


def translate_name(en_name: str) -> tuple[str, str, str]:
    override = TRANSLATION_OVERRIDES.get(en_name)

    if override:
        return override[0], override[1], "confirmed"

    return en_name, "", "missing"


def infer_introduced_by(en_name: str, locations: list[str]) -> str:
    haystack = " ".join([en_name, *locations]).lower()

    for generation, hints in VERSION_HINTS:
        if any(hint in haystack for hint in hints):
            return generation

    return "unknown"


def infer_is_event(en_name: str, locations: list[str]) -> bool:
    haystack = " ".join([en_name, *locations]).lower()
    return any(hint in haystack for hint in EVENT_HINTS)


def runtime_record(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record["id"],
        "zhCNName": record["zhCNName"],
        "zhTWName": record["zhTWName"],
        "enName": record["enName"],
        "combatPower": record["combatPower"],
        "locations": record["locations"],
        "introducedBy": record["introducedBy"],
        "isEvent": record["isEvent"],
        "translationStatus": record["translationStatus"],
        "source": record["source"],
    }


def render_js(records: list[dict[str, Any]]) -> str:
    payload = json.dumps(records, ensure_ascii=False, indent=2)
    return (
        "(function () {\n"
        "  const app = (window.MabinogiCP = window.MabinogiCP || {});\n\n"
        "  app.MONSTER_RECORDS = "
        + indent_multiline(payload, "  ")
        + ";\n"
        "})();\n"
    )


def indent_multiline(value: str, prefix: str) -> str:
    lines = value.splitlines()
    return lines[0] + "\n" + "\n".join(prefix + line for line in lines[1:])


if __name__ == "__main__":
    main()
