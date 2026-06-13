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
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RAW_OUTPUT = ROOT / "data" / "raw" / "mabinogi-world-monster-cp.json"
G13_RAW_OUTPUT = ROOT / "data" / "raw" / "g13-local-monster-cp.json"
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

LOCATION_EXACT_ZH_CN = {
    "?": "未知",
    "(Chest Event)": "宝箱活动",
    "Avalon (South of Outskirts of Avalon moongate)": "阿瓦隆（阿瓦隆外围月门南侧）",
    "Albey Dungeon (All except Blue and Red)": "阿尔贝地下城（除蓝色、红色外）",
    "Connous (Central Longa Desert)": "肯奴斯（伦迦沙漠中央）",
    "Courcle (Cenae Meadows)": "克拉格（塞奈草原）",
    "Dunbarton (Dunbarton Library during G1 Final Quest)": "敦巴伦（G1 最终任务的敦巴伦图书馆）",
    "Tir Chonaill (Past)": "迪尔科内尔（过去）",
}

LOCATION_TERM_ZH_CN = {
    "Abb Neagh Castle Dungeon": "阿布内尔城地下城",
    "Abb Neagh Castle": "阿布内尔城",
    "Abb Neagh": "阿布内尔",
    "Alby": "伊比",
    "Albey": "阿尔贝",
    "Avalon": "阿瓦隆",
    "Avon": "埃文",
    "Baol": "巴尔",
    "Barri": "巴里",
    "Bangor": "班格",
    "Ciar": "赛尔",
    "Ceo Island": "凯欧岛",
    "Coill": "克丽尔",
    "Connous": "肯奴斯",
    "Corrib Valley": "科利布山谷",
    "Corrib": "科利布",
    "Courcle": "克拉格",
    "Cursed Labyrinth": "被诅咒的地下迷宫",
    "Episodes 3": "第 3 章",
    "Dugald Aisle": "杜加德走廊",
    "Dugald Castle Dungeon": "杜加德城堡地下城",
    "Dunbarton": "敦巴伦",
    "Emain Macha": "艾明马恰",
    "Filia": "菲利亚",
    "Fiodh": "菲奥纳",
    "Gairech Hills": "盖尔茨",
    "Gairech": "盖尔茨",
    "Herba Jungle": "赫尔巴密林",
    "Iria": "伊利亚",
    "Kaypi Canyon": "凯皮峡谷",
    "Karu Forest": "卡鲁森林",
    "Karu": "卡鲁",
    "Longa Desert": "伦迦沙漠",
    "Longa": "伦迦",
    "Maiz Prairie": "梅兹平原",
    "Maiz": "梅兹",
    "Math": "玛斯",
    "Metus": "梅图斯",
    "Morva Aisle": "莫尔巴走廊",
    "Muyu Desert": "穆游沙漠",
    "Neres Plateau": "内勒斯台地",
    "Nekojima": "猫岛",
    "Osna Sail": "奥斯纳赛尔",
    "Outskirts of Avalon": "阿瓦隆外围",
    "Pantay Swamp": "潘泰沼泽",
    "Par": "帕鲁",
    "Peaca": "皮卡",
    "Physis": "彼辛斯",
    "Rabbie": "拉比",
    "Rano": "拉诺",
    "Rat Island": "老鼠岛",
    "Renes": "雷内斯",
    "Rundal": "伦达",
    "Scathach Beach": "斯卡哈海滨",
    "Scathach": "斯卡哈",
    "Sen Mag Castle Dungeon": "仙魔城堡地下城",
    "Sen Mag": "仙魔平原",
    "Sliab Cuilin": "斯利亚布库林",
    "Snake Mark": "蛇纹",
    "Snaky Energy": "蛇之气息",
    "Solea": "索里埃",
    "Taillteann": "塔汀",
    "Tara": "塔拉",
    "Tarlach's Glasses Pouch": "塔拉克眼镜袋",
    "Tarlach": "塔拉克",
    "Tir Chonaill": "迪尔科内尔",
    "Vales": "巴勒斯",
    "Zardine": "扎尔丁",
    "Belvast": "贝尔法斯特",
    "Ifrit": "伊弗利特",
    "History's Curtain Call": "历史的谢幕",
    "Saga Episode": "莎士比亚篇章",
    "Saga": "莎士比亚篇",
    "Shadow Mission": "影子任务",
    "Theater Mission": "剧场任务",
    "Theater Missions": "剧场任务",
    "Dungeon": "地下城",
    "Ruins": "遗迹",
    "Castle": "城",
    "Library": "图书馆",
    "Moongate": "月门",
    "moongate": "月门",
    "Field": "野外",
    "Forest": "森林",
    "Desert": "沙漠",
    "Prairie": "平原",
    "Beach": "海滨",
    "Cave": "洞穴",
    "Arena": "竞技场",
    "Cliff": "悬崖",
    "Canyon": "峡谷",
    "Valley": "山谷",
    "Jungle": "密林",
    "Swamp": "沼泽",
    "Island": "岛",
    "Plateau": "台地",
    "Beginner": "新手",
    "Basic": "初级",
    "Intermediate": "中级",
    "Advanced": "高级",
    "Hardmode": "困难模式",
    "Hard Mode": "困难模式",
    "Normal": "普通",
    "Lower": "低级",
    "Low": "低级",
    "Boss": "BOSS",
    "Final": "最终",
    "Solo": "单人",
    "Goddess": "女神",
    "Infiltration": "潜入",
    "Siren": "赛连",
    "Mysterious": "神秘",
    "Black Fomor Pass": "黑色魔族通行证",
    "Fomor Pass": "魔族通行证",
    "Red Gem": "红宝石",
    "Blue Gem": "蓝宝石",
    "Yellow Gem": "黄宝石",
    "Green Gem": "绿宝石",
    "Emerald": "翡翠",
    "Amethyst": "紫水晶",
    "Topaz": "黄宝石",
    "Ruby": "红宝石",
    "Jasper": "碧玉",
    "Black Orb": "黑色宝珠",
    "Blue Orb": "蓝色宝珠",
    "Green Orb": "绿色宝珠",
    "Red Orb": "红色宝珠",
    "Silver Orb": "银色宝珠",
    "Black": "黑色",
    "Blue": "蓝色",
    "Green": "绿色",
    "Red": "红色",
    "Silver": "银色",
    "Golden": "黄金",
    "Event": "活动",
    "Halloween": "万圣节",
    "Christmas": "圣诞节",
    "Anniversary": "周年",
    "Chest": "宝箱",
    "Quest": "任务",
    "Mission": "任务",
    "Memory RP": "记忆 RP",
    "Summoned by": "由其召唤：",
    "Via Exploration": "通过探险",
    "Exploration Treasure Box": "探险宝箱",
    "Exploration": "探险",
    "Mana Tunnel": "魔法之门",
    "Lizard Mark": "蜥蜴纹",
    "Tree Mark": "树纹",
    "Mark": "标记",
    "north of": "北侧",
    "by the": "在",
    "Near": "附近",
    "near": "附近",
    "Entrance": "入口",
    "Central": "中央",
    "North": "北部",
    "South": "南部",
    "East": "东部",
    "West": "西部",
    "Northeast": "东北部",
    "Northwest": "西北部",
    "Southeast": "东南部",
    "Southwest": "西南部",
    "slightly northeast": "稍偏东北",
    "slightly": "稍偏",
    "Past": "过去",
    "inside": "内部",
    "Inside": "内部",
    "outside": "外部",
    "Outside": "外部",
}

G13_ZH_CN_OVERRIDES = {
    "Arachne": "阿拉克尼",
    "Bard Skeleton": "吟游骷髅",
    "Black Leopard": "黑豹",
    "Black Succubus": "黑色女妖",
    "Captain Skeleton": "海盗船长骷髅",
    "Dark Rat Man": "暗黑鼠人",
    "Emerald Magic Golem": "翡翠魔法石巨人",
    "Giant Golden Spider": "巨型黄金蜘蛛",
    "Giant Ice Sprite": "巨大冰光羽",
    "Giant Imp": "巨大小鬼",
    "Giant Red Spider": "巨大红蜘蛛",
    "Giant Spider": "巨型蜘蛛",
    "Golem": "石巨人",
    "Gray Gremlin": "灰色鬼魔",
    "Master Lich": "怪物死尸",
    "Metal Bard Skeleton": "金属吟游骷髅",
    "Metal Skeleton": "金属骷髅",
    "Mirror Witch": "镜子魔女",
    "Red Succubus": "红色女妖",
    "Siren": "赛连",
    "Small Golem": "小石巨人",
    "Stone Gargoyle": "石像翼魔",
    "Wendigo": "袁迪",
    "Werewolf": "狼人",
}


def main() -> None:
    args = parse_args()

    if args.source == "g13-local":
        normalized_records = normalize_g13_local_records(
            args.g13_monster_xml,
            args.g13_race_xml,
            args.g13_race_localization,
        )
        verify_records(normalized_records)
        write_g13_raw_records(normalized_records, args.g13_monster_xml, args.g13_race_xml, args.g13_race_localization)
        print(f"Wrote {len(normalized_records)} records to {G13_RAW_OUTPUT.relative_to(ROOT).as_posix()}")
    else:
        G13_ZH_CN_OVERRIDES.update(load_g13_race_name_overrides(args.g13_race_xml, args.g13_race_localization))

    if args.source == "mabinogi-world" and args.fetch:
        raw_rows = fetch_monster_rows()
        normalized_records = normalize_rows(raw_rows)
        verify_records(normalized_records)
        write_raw_records(normalized_records)
        print(f"Wrote {len(normalized_records)} records to {RAW_OUTPUT.relative_to(ROOT).as_posix()}")
    elif args.source == "mabinogi-world":
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
        "--source",
        choices=("mabinogi-world", "g13-local"),
        default="mabinogi-world",
        help="Source to use for generated runtime monster records.",
    )
    parser.add_argument(
        "--fetch",
        "--refresh-source",
        action="store_true",
        dest="fetch",
        help="Fetch Mabinogi World Wiki and refresh the committed raw source JSON before generating runtime data.",
    )
    parser.add_argument(
        "--g13-race-xml",
        type=Path,
        help="Optional G13 data/db/race.xml path. Required for --source g13-local; otherwise used with --g13-race-localization for official Simplified Chinese monster names.",
    )
    parser.add_argument(
        "--g13-monster-xml",
        type=Path,
        help="Optional G13 server data/db/monster.xml path. Required for --source g13-local.",
    )
    parser.add_argument(
        "--g13-race-localization",
        type=Path,
        help="Optional G13 language3 data/local/xml/race.japan.txt path. Required for --source g13-local; otherwise used with --g13-race-xml.",
    )
    return parser.parse_args()


def load_g13_race_name_overrides(race_xml: Path | None, race_localization: Path | None) -> dict[str, str]:
    if not race_xml and not race_localization:
        return {}

    if not race_xml or not race_localization:
        raise ValueError("--g13-race-xml and --g13-race-localization must be provided together")

    if not race_xml.exists():
        raise FileNotFoundError(race_xml)

    if not race_localization.exists():
        raise FileNotFoundError(race_localization)

    zh_by_id: dict[str, str] = {}
    for line in read_text_with_fallback(race_localization).splitlines():
        match = re.match(r"^(\d+)\t(.+)$", line)
        if match:
            zh_by_id[match.group(1)] = match.group(2).strip()

    overrides: dict[str, str] = {}
    root = ET.parse(race_xml).getroot()
    for race in root.findall("./RaceList/Race"):
        en_name = str(race.attrib.get("EnglishName") or "").strip()
        local_name = str(race.attrib.get("LocalName") or "")
        match = re.search(r"xml\.race\.(\d+)", local_name)
        if en_name and match:
            zh_name = zh_by_id.get(match.group(1), "")
            if zh_name and en_name not in overrides:
                overrides[en_name] = zh_name

    return overrides


def read_text_with_fallback(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-16", "utf-16-le", "gb18030"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeError:
            continue

    return path.read_text()


def load_raw_records() -> list[dict[str, Any]]:
    payload = json.loads(RAW_OUTPUT.read_text(encoding="utf-8-sig"))
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


def write_g13_raw_records(
    normalized_records: list[dict[str, Any]],
    monster_xml: Path | None,
    race_xml: Path | None,
    race_localization: Path | None,
) -> None:
    raw_payload = {
        "source": "g13-local",
        "sourceFiles": {
            "monsterXml": monster_xml.name if monster_xml else "",
            "raceXml": race_xml.name if race_xml else "",
            "raceLocalization": race_localization.name if race_localization else "",
        },
        "recordCount": len(normalized_records),
        "records": normalized_records,
    }

    G13_RAW_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    G13_RAW_OUTPUT.write_text(json.dumps(raw_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_g13_local_records(monster_xml: Path | None, race_xml: Path | None, race_localization: Path | None) -> list[dict[str, Any]]:
    if not monster_xml or not race_xml or not race_localization:
        raise ValueError("--source g13-local requires --g13-monster-xml, --g13-race-xml, and --g13-race-localization")

    for path in (monster_xml, race_xml, race_localization):
        if not path.exists():
            raise FileNotFoundError(path)

    zh_by_id = load_numbered_localization(race_localization)
    races_by_id = load_races_by_id(race_xml, zh_by_id)
    root = ET.parse(monster_xml).getroot()
    records: list[dict[str, Any]] = []

    for monster in root.findall("./MonsterList/Monster"):
        race_id = str(monster.attrib.get("RaceID") or "").strip()
        race = races_by_id.get(race_id, {})
        class_name = str(monster.attrib.get("RaceClassName") or race.get("className") or "").strip()
        en_name = str(race.get("enName") or class_name or f"Race {race_id}").strip()
        zh_cn_name = str(race.get("zhCNName") or "").strip()
        combat_power = parse_number(monster.attrib.get("CombatPower2")) or parse_number(monster.attrib.get("CombatPower"))

        if not race_id or not class_name or combat_power is None:
            continue

        records.append(
            {
                "id": f"g13-{race_id}-{slugify(class_name)}",
                "raceId": int(race_id) if race_id.isdigit() else race_id,
                "raceClassName": class_name,
                "zhCNName": zh_cn_name,
                "zhTWName": "",
                "enName": en_name,
                "combatPower": combat_power,
                "baseCombatPower": parse_number(monster.attrib.get("CombatPower")),
                "combatPower2": parse_number(monster.attrib.get("CombatPower2")),
                "level": parse_number(monster.attrib.get("Level")),
                "life": parse_number(monster.attrib.get("Life")),
                "attackMin": parse_number(monster.attrib.get("AttMin")),
                "attackMax": parse_number(monster.attrib.get("AttMax")),
                "defense": parse_number(monster.attrib.get("Defense")),
                "protect": parse_number(monster.attrib.get("Protect")),
                "bonusExp": parse_number(monster.attrib.get("BonusExp")),
                "locations": [],
                "zhCNLocations": [],
                "introducedBy": "G13",
                "isEvent": infer_g13_local_event(class_name, en_name, zh_cn_name),
                "translationStatus": "confirmed" if zh_cn_name else "missing",
                "source": "g13-local",
            }
        )

    records.sort(key=lambda record: (str(record["zhCNName"] or record["enName"]).lower(), str(record["raceClassName"]).lower()))
    return records


def load_numbered_localization(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}

    for line in read_g13_localization_text(path).splitlines():
        match = re.match(r"^(\d+)\t(.+)$", line)
        if match:
            values[match.group(1)] = match.group(2).strip()

    return values


def read_g13_localization_text(path: Path) -> str:
    for encoding in ("gb18030", "utf-8-sig", "utf-16", "utf-16-le"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeError:
            continue

    return path.read_text()


def load_races_by_id(race_xml: Path, zh_by_id: dict[str, str]) -> dict[str, dict[str, str]]:
    races: dict[str, dict[str, str]] = {}
    root = ET.parse(race_xml).getroot()

    for race in root.findall("./RaceList/Race"):
        race_id = str(race.attrib.get("ID") or "").strip()
        local_name = str(race.attrib.get("LocalName") or "")
        local_match = re.search(r"xml\.race\.(\d+)", local_name)
        zh_cn_name = zh_by_id.get(local_match.group(1), "") if local_match else ""

        if race_id:
            races[race_id] = {
                "className": str(race.attrib.get("ClassName") or "").strip(),
                "enName": str(race.attrib.get("EnglishName") or "").strip(),
                "zhCNName": zh_cn_name,
            }

    return races


def parse_number(value: Any) -> int | float | None:
    text = str(value or "").strip()

    if not text:
        return None

    try:
        number = float(text)
    except ValueError:
        return None

    return int(number) if number.is_integer() else number


def infer_g13_local_event(class_name: str, en_name: str, zh_cn_name: str) -> bool:
    text = " ".join([class_name, en_name, zh_cn_name]).lower()
    return any(hint in text for hint in EVENT_HINTS)


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

    if not records_are_g13_local(records) and len(keys) != len(set(keys)):
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


def translate_locations(locations: list[str]) -> list[str]:
    translated: list[str] = []
    seen: set[str] = set()

    for location in locations:
        translated_location = translate_location(location)
        key = translated_location.lower()
        if translated_location and key not in seen:
            translated.append(translated_location)
            seen.add(key)

    return translated


def translate_location(location: str) -> str:
    text = clean_text(location)

    if not text:
        return ""

    if text in LOCATION_EXACT_ZH_CN:
        return LOCATION_EXACT_ZH_CN[text]

    translated = text
    for en_term, zh_term in sorted(LOCATION_TERM_ZH_CN.items(), key=lambda item: len(item[0]), reverse=True):
        translated = replace_location_term(translated, en_term, zh_term)

    translated = re.sub(r"\s+", " ", translated).strip()
    translated = re.sub(r"(?<=[\u4e00-\u9fff）])\s+(?=[\u4e00-\u9fffA-Z])", "", translated)
    translated = translated.replace(" (", "（").replace(")", "）")
    translated = translated.replace(" / ", " / ")

    return translated


def replace_location_term(text: str, en_term: str, zh_term: str) -> str:
    if re.search(r"[A-Za-z0-9]$", en_term):
        pattern = rf"(?<![A-Za-z0-9]){re.escape(en_term)}(?![A-Za-z0-9])"
    else:
        pattern = re.escape(en_term)

    return re.sub(pattern, zh_term, text)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "monster"


def translate_name(en_name: str) -> tuple[str, str, str]:
    zh_cn_name = G13_ZH_CN_OVERRIDES.get(en_name) or ZH_CN_OVERRIDES.get(en_name)
    zh_tw_name = ZH_TW_OVERRIDES.get(en_name)

    if zh_cn_name or zh_tw_name:
        return zh_cn_name or "", zh_tw_name or "", "confirmed"

    return "", "", "missing"


def infer_introduced_by(en_name: str, locations: list[str]) -> str:
    haystack = " ".join([en_name, *locations]).lower()

    for generation, hints in VERSION_HINTS:
        if any(hint in haystack for hint in hints):
            return generation

    if en_name in G13_ZH_CN_OVERRIDES:
        return "G13"

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
    if record.get("source") == "g13-local":
        zh_cn_name = str(record.get("zhCNName") or "")
        zh_tw_name = str(record.get("zhTWName") or "")
        translation_status = str(record.get("translationStatus") or ("confirmed" if zh_cn_name else "missing"))
        introduced_by = str(record.get("introducedBy") or "G13")
        is_event = bool(record.get("isEvent"))
    else:
        zh_cn_name, zh_tw_name, translation_status = translate_name(en_name)
        introduced_by = infer_introduced_by(en_name, locations)
        is_event = infer_is_event(en_name, locations)
    zh_cn_locations = translate_locations(locations)

    return {
        **record,
        "zhCNName": zh_cn_name,
        "zhTWName": zh_tw_name,
        "zhCNLocations": zh_cn_locations,
        "introducedBy": introduced_by,
        "isEvent": is_event,
        "translationStatus": translation_status,
    }


def runtime_record(record: dict[str, Any]) -> dict[str, Any]:
    runtime = {
        "id": record["id"],
        "zhCNName": record["zhCNName"],
        "zhTWName": record["zhTWName"],
        "enName": record["enName"],
        "combatPower": record["combatPower"],
        "locations": record["locations"],
        "zhCNLocations": record.get("zhCNLocations", []),
        "introducedBy": record["introducedBy"],
        "isEvent": record["isEvent"],
        "translationStatus": record["translationStatus"],
        "source": record["source"],
    }

    for key in (
        "raceId",
        "raceClassName",
        "baseCombatPower",
        "combatPower2",
        "level",
        "life",
        "attackMin",
        "attackMax",
        "defense",
        "protect",
        "bonusExp",
    ):
        if key in record:
            runtime[key] = record[key]

    return runtime


def records_are_g13_local(records: list[dict[str, Any]]) -> bool:
    return bool(records) and all(record.get("source") == "g13-local" for record in records)


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
