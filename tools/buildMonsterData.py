"""Refresh monster combat power data from Mabinogi World Wiki.

The source page renders its table through Semantic MediaWiki, so this script
queries the same public properties directly instead of scraping generated HTML.
"""

from __future__ import annotations

import argparse
import hashlib
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
    "|?Monster cp",
    "|?Monster field locations list",
    "|?Monster missions list",
]

ZH_CN_OVERRIDES = {
    "Banner Imp": "旗帜小恶魔",
    "Black Poisonous Spider": "黑毒蜘蛛",
    "Black Prison Zombie": "黑色监狱僵尸",
    "Black Spider": "黑蜘蛛",
    "Black Wolf": "黑狼",
    "Blue Wolf": "蓝狼",
    "Brown Dire Wolf": "棕色恐狼",
    "Captain Red Skeleton": "红骷髅队长",
    "Captain Skeleton": "骷髅队长",
    "Coffin Mimic": "棺材宝箱怪",
    "Dark Skeleton": "黑暗骷髅",
    "Forest Golem": "森林魔像",
    "Giant Black Spider": "巨大黑蜘蛛",
    "Giant Golden Spider": "巨大金蜘蛛",
    "Giant Imp": "巨大小恶魔",
    "Giant Ogre": "巨大食人魔",
    "Giant Red Spider": "巨大红蜘蛛",
    "Giant Spider": "巨大蜘蛛",
    "Giant White Wolf": "巨大白狼",
    "Golem": "魔像",
    "Gray Prison Zombie": "灰色监狱僵尸",
    "Gray Wolf": "灰狼",
    "Great Mimic": "巨大宝箱怪",
    "Ice Mimic": "冰宝箱怪",
    "Imp": "小恶魔",
    "Invisible Imp": "隐形小恶魔",
    "King Mimic": "国王宝箱怪",
    "Magic Golem": "魔法魔像",
    "Metal Skeleton": "金属骷髅",
    "Mimic": "宝箱怪",
    "Ogre Executioner": "食人魔处刑者",
    "Ogre Warrior (Large)": "大型食人魔战士",
    "Old Mimic": "古老宝箱怪",
    "Pirate Skeleton": "海盗骷髅",
    "Pot-Belly Spider": "大肚蜘蛛",
    "Red Skeleton (Full Armor)": "红色全身铠甲骷髅",
    "Red Skeleton (Heavy Armor)": "红色重甲骷髅",
    "Red Skeleton (Light Armor)": "红色轻甲骷髅",
    "Red Spider": "红蜘蛛",
    "Sand Mimic": "沙漠宝箱怪",
    "Skeleton (Full Armor)": "全身铠甲骷髅",
    "Skeleton (Heavy Armor)": "重甲骷髅",
    "Skeleton (Light Armor)": "轻甲骷髅",
    "Skeleton Soldier": "骷髅士兵",
    "Skeleton Wolf": "骷髅狼",
    "Small Golem": "小魔像",
    "Snow Golem": "雪原魔像",
    "Snow Imp": "雪原小恶魔",
    "Snow Zombie": "雪原僵尸",
    "Stone Golem": "石魔像",
    "Stone Imp": "石头小恶魔",
    "Stone Mimic": "石头宝箱怪",
    "Stone Zombie": "石头僵尸",
    "Sulfur Spider": "硫磺蜘蛛",
    "White Dire Wolf": "白色恐狼",
    "White Spider": "白蜘蛛",
    "White Wolf": "白狼",
    "Zombie": "僵尸",
    "Zombie Soldier": "僵尸士兵",
}

ZH_TW_OVERRIDES = {
    "Banner Imp": "旗幟小惡魔",
    "Black Poisonous Spider": "黑毒蜘蛛",
    "Black Prison Zombie": "黑色監獄殭屍",
    "Black Spider": "黑蜘蛛",
    "Black Wolf": "黑狼",
    "Blue Wolf": "藍狼",
    "Brown Dire Wolf": "棕色恐狼",
    "Captain Red Skeleton": "紅骷髏隊長",
    "Captain Skeleton": "骷髏隊長",
    "Coffin Mimic": "棺材寶箱怪",
    "Dark Skeleton": "黑暗骷髏",
    "Forest Golem": "森林魔像",
    "Giant Black Spider": "巨大黑蜘蛛",
    "Giant Golden Spider": "巨大金蜘蛛",
    "Giant Imp": "巨大小惡魔",
    "Giant Ogre": "巨大食人魔",
    "Giant Red Spider": "巨大紅蜘蛛",
    "Giant Spider": "巨大蜘蛛",
    "Giant White Wolf": "巨大白狼",
    "Golem": "魔像",
    "Gray Prison Zombie": "灰色監獄殭屍",
    "Gray Wolf": "灰狼",
    "Great Mimic": "巨大寶箱怪",
    "Ice Mimic": "冰寶箱怪",
    "Imp": "小惡魔",
    "Invisible Imp": "隱形小惡魔",
    "King Mimic": "國王寶箱怪",
    "Magic Golem": "魔法魔像",
    "Metal Skeleton": "金屬骷髏",
    "Mimic": "寶箱怪",
    "Ogre Executioner": "食人魔處刑者",
    "Ogre Warrior (Large)": "大型食人魔戰士",
    "Old Mimic": "古老寶箱怪",
    "Pirate Skeleton": "海盜骷髏",
    "Pot-Belly Spider": "大肚蜘蛛",
    "Red Skeleton (Full Armor)": "紅色全身鎧甲骷髏",
    "Red Skeleton (Heavy Armor)": "紅色重甲骷髏",
    "Red Skeleton (Light Armor)": "紅色輕甲骷髏",
    "Red Spider": "紅蜘蛛",
    "Sand Mimic": "沙漠寶箱怪",
    "Skeleton (Full Armor)": "全身鎧甲骷髏",
    "Skeleton (Heavy Armor)": "重甲骷髏",
    "Skeleton (Light Armor)": "輕甲骷髏",
    "Skeleton Soldier": "骷髏士兵",
    "Skeleton Wolf": "骷髏狼",
    "Small Golem": "小魔像",
    "Snow Golem": "雪原魔像",
    "Snow Imp": "雪原小惡魔",
    "Snow Zombie": "雪原殭屍",
    "Stone Golem": "石魔像",
    "Stone Imp": "石頭小惡魔",
    "Stone Mimic": "石頭寶箱怪",
    "Stone Zombie": "石頭殭屍",
    "Sulfur Spider": "硫磺蜘蛛",
    "White Dire Wolf": "白色恐狼",
    "White Spider": "白蜘蛛",
    "White Wolf": "白狼",
    "Zombie": "殭屍",
    "Zombie Soldier": "殭屍士兵",
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
    args = parse_args()

    if args.fetch:
        raw_rows = fetch_monster_rows()
        normalized_records = normalize_rows(raw_rows)
        verify_records(normalized_records)
        write_raw_records(normalized_records)
        print(f"Wrote {len(normalized_records)} records to {RAW_OUTPUT.relative_to(ROOT).as_posix()}")
    else:
        normalized_records = load_raw_records()

    normalized_records = [derive_runtime_source_record(record) for record in normalized_records]
    verify_records(normalized_records)
    runtime_records = [runtime_record(record) for record in normalized_records]

    JS_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    JS_OUTPUT.write_text(render_js(runtime_records), encoding="utf-8")

    print(f"Wrote {len(runtime_records)} records to {JS_OUTPUT.relative_to(ROOT).as_posix()}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build browser monster combat power records.")
    parser.add_argument(
        "--fetch",
        "--refresh-source",
        action="store_true",
        dest="fetch",
        help="Fetch Mabinogi World Wiki and refresh the committed raw source JSON before generating runtime data.",
    )
    return parser.parse_args()


def load_raw_records() -> list[dict[str, Any]]:
    payload = json.loads(RAW_OUTPUT.read_text(encoding="utf-8"))
    records = payload.get("records", [])

    if not isinstance(records, list):
        raise ValueError("Raw monster data must contain a records list")

    return records


def write_raw_records(normalized_records: list[dict[str, Any]]) -> None:
    raw_payload = {
        "sourceUrl": SOURCE_PAGE_URL,
        "apiEndpoint": API_ENDPOINT,
        "sourceQuery": "".join(BASE_QUERY_PARTS),
        "recordCount": len(normalized_records),
        "records": normalized_records,
    }

    RAW_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    RAW_OUTPUT.write_text(json.dumps(raw_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
    candidates: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, int, tuple[str, ...]]] = set()

    for row in sorted(rows, key=row_sort_key):
        en_name = extract_name(row)
        combat_power = extract_combat_power(row)

        if not en_name or combat_power is None:
            continue

        locations = extract_locations(row)
        key = normalized_record_key(en_name, combat_power, locations)
        if key in seen_keys:
            continue

        seen_keys.add(key)
        zh_cn_name, zh_tw_name, translation_status = translate_name(en_name)

        candidates.append(
            {
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

    return assign_stable_ids(candidates)


def assign_stable_ids(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    name_counts: dict[str, int] = {}
    used_ids: set[str] = set()
    assigned_records: list[dict[str, Any]] = []

    for record in records:
        name_counts[record["enName"]] = name_counts.get(record["enName"], 0) + 1

    for record in records:
        base_id = slugify(record["enName"])
        record_key = normalized_record_key(record["enName"], record["combatPower"], record["locations"])
        record_id = base_id

        if name_counts[record["enName"]] > 1:
            record_id = f"{base_id}-{record['combatPower']}-{short_hash(record_key)}"

        if record_id in used_ids:
            record_id = f"{record_id}-{short_hash(record_key)}"

        used_ids.add(record_id)
        assigned_records.append({"id": record_id, **record})

    return assigned_records


def row_sort_key(row: dict[str, Any]) -> tuple[str, int, str]:
    return (extract_name(row).lower(), extract_combat_power(row) or 0, row.get("fullurl", ""))


def normalized_record_key(en_name: str, combat_power: int, locations: list[str]) -> tuple[str, int, tuple[str, ...]]:
    return (
        normalize_key_text(en_name),
        combat_power,
        tuple(sorted(normalize_key_text(location) for location in locations)),
    )


def normalize_key_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def short_hash(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:8]


def verify_records(records: list[dict[str, Any]]) -> None:
    ids = [record["id"] for record in records]
    keys = [normalized_record_key(record["enName"], record["combatPower"], record["locations"]) for record in records]

    if len(ids) != len(set(ids)):
        raise ValueError("Generated monster records contain duplicate ids")

    if len(keys) != len(set(keys)):
        raise ValueError("Generated monster records contain duplicate normalized keys")

    zombies = [record for record in records if record["enName"] == "Zombie"]
    for zombie in zombies:
        if any(not is_event_text(location) for location in zombie["locations"]) and zombie["isEvent"]:
            raise ValueError("Zombie with regular locations must not be marked as an event record")


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
    zh_cn_name = ZH_CN_OVERRIDES.get(en_name)
    zh_tw_name = ZH_TW_OVERRIDES.get(en_name)

    if zh_cn_name or zh_tw_name:
        return zh_cn_name or "", zh_tw_name or "", "confirmed"

    return "", "", "missing"


def infer_introduced_by(en_name: str, locations: list[str]) -> str:
    haystack = " ".join([en_name, *locations]).lower()

    for generation, hints in VERSION_HINTS:
        if any(hint in haystack for hint in hints):
            return generation

    return "unknown"


def infer_is_event(en_name: str, locations: list[str]) -> bool:
    if is_event_text(en_name):
        return True

    return bool(locations) and all(is_event_text(location) for location in locations)


def is_event_text(value: str) -> bool:
    text = str(value or "").lower()
    return any(hint in text for hint in EVENT_HINTS)


def derive_runtime_source_record(record: dict[str, Any]) -> dict[str, Any]:
    en_name = str(record["enName"])
    locations = [str(location) for location in record.get("locations", [])]
    zh_cn_name, zh_tw_name, translation_status = translate_name(en_name)

    return {
        **record,
        "zhCNName": zh_cn_name,
        "zhTWName": zh_tw_name,
        "introducedBy": infer_introduced_by(en_name, locations),
        "isEvent": infer_is_event(en_name, locations),
        "translationStatus": translation_status,
    }


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
