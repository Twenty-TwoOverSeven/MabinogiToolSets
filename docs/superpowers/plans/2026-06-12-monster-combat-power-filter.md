# Monster Combat Power Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `怪物筛选` tab that uses the current character CP, or a manual override, to find monsters by Weakest/Weak/Normal/Strong/Awful/Boss rank.

**Architecture:** Keep the app as a static browser app with no npm or backend. Add focused monster domain modules for rank calculation and filtering, a generated/static monster data file for browser loading, and a small data-refresh script that stores a raw source snapshot in the repository. Integrate the tab into `src/ui/renderApp.js` without changing the profile export schema.

**Tech Stack:** Plain browser JavaScript, static HTML, CSS, Python standard library for optional data refresh, existing browser test harness in `tests/browser-tests.html`.

---

## File Structure

- Create `src/monsters/monsterRanks.js`: pure CP rank helpers, range calculation, manual override resolution, and filter logic.
- Create `src/monsters/monsterRecords.js`: runtime monster records loaded by the static page.
- Create `tests/monsterRanks.test.js`: domain tests for rank boundaries, default filters, searches, and override behavior.
- Create `tools/buildMonsterData.py`: Python standard-library data refresh script for Mabinogi World Wiki source data and generated runtime JS.
- Create `data/raw/mabinogi-world-monster-cp.json`: raw-ish normalized snapshot saved in the repo.
- Modify `index.html`: load monster scripts before `renderApp.js`.
- Modify `tests/browser-tests.html`: load monster scripts and tests.
- Modify `src/ui/renderApp.js`: add tab state, monster filter state, tab rendering, event bindings, and no-redraw updates where needed.
- Modify `src/styles.css`: add tab, filter, rank badge, and monster table styling.
- Test with `tests/browser-tests.html` in a browser.

## Task 1: Monster Rank Domain Logic

**Files:**
- Create: `src/monsters/monsterRanks.js`
- Create: `tests/monsterRanks.test.js`
- Modify: `tests/browser-tests.html`

- [ ] **Step 1: Add failing domain tests**

Create `tests/monsterRanks.test.js`:

```javascript
(function () {
  const {
    calculateMonsterRank,
    calculateMonsterRankRanges,
    filterMonsters,
    resolveMonsterFilterCombatPower,
  } = window.MabinogiCP;
  const { expectClose, expectEqual, test } = window.MabinogiCPTest;

  const monsters = [
    {
      id: 'gray-wolf',
      zhCNName: '灰狼',
      zhTWName: '灰狼',
      enName: 'Gray Wolf',
      combatPower: 90,
      locations: ['迪尔科内尔'],
      introducedBy: 'G1',
      isEvent: false,
      translationStatus: 'confirmed',
      source: 'test',
    },
    {
      id: 'red-spider',
      zhCNName: '红蜘蛛',
      zhTWName: '紅蜘蛛',
      enName: 'Red Spider',
      combatPower: 140,
      locations: ['艾菲地下城'],
      introducedBy: 'G1',
      isEvent: false,
      translationStatus: 'autoConverted',
      source: 'test',
    },
    {
      id: 'future-boss',
      zhCNName: '后期首领',
      zhTWName: '後期首領',
      enName: 'Future Boss',
      combatPower: 400,
      locations: ['后期区域'],
      introducedBy: 'G22',
      isEvent: false,
      translationStatus: 'missing',
      source: 'test',
    },
    {
      id: 'unknown-snake',
      zhCNName: '未知蛇',
      zhTWName: '未知蛇',
      enName: 'Unknown Snake',
      combatPower: 80,
      locations: ['未知地点'],
      introducedBy: 'unknown',
      isEvent: false,
      translationStatus: 'confirmed',
      source: 'test',
    },
    {
      id: 'event-rat',
      zhCNName: '活动老鼠',
      zhTWName: '活動老鼠',
      enName: 'Event Rat',
      combatPower: 85,
      locations: ['活动'],
      introducedBy: 'G1',
      isEvent: true,
      translationStatus: 'confirmed',
      source: 'test',
    },
  ];

  test('monster rank boundaries use left-closed right-open ranges', () => {
    expectEqual(calculateMonsterRank(79.99, 100).id, 'weakest');
    expectEqual(calculateMonsterRank(80, 100).id, 'weak');
    expectEqual(calculateMonsterRank(100, 100).id, 'normal');
    expectEqual(calculateMonsterRank(140, 100).id, 'strong');
    expectEqual(calculateMonsterRank(200, 100).id, 'awful');
    expectEqual(calculateMonsterRank(300, 100).id, 'boss');
  });

  test('monster rank ranges are derived from active combat power', () => {
    const ranges = calculateMonsterRankRanges(100);

    expectClose(ranges.weakest.min, 0);
    expectClose(ranges.weakest.maxExclusive, 80);
    expectClose(ranges.weak.min, 80);
    expectClose(ranges.weak.maxExclusive, 100);
    expectClose(ranges.normal.min, 100);
    expectClose(ranges.normal.maxExclusive, 140);
    expectClose(ranges.strong.min, 140);
    expectClose(ranges.strong.maxExclusive, 200);
    expectClose(ranges.awful.min, 200);
    expectClose(ranges.awful.maxExclusive, 300);
    expectClose(ranges.boss.min, 300);
    expectEqual(ranges.boss.maxExclusive, null);
  });

  test('manual combat power overrides current character combat power', () => {
    const resolved = resolveMonsterFilterCombatPower(250, '100');

    expectEqual(resolved.ok, true);
    expectEqual(resolved.source, 'manual');
    expectClose(resolved.value, 100);
  });

  test('invalid manual combat power returns a validation message', () => {
    const resolved = resolveMonsterFilterCombatPower(250, '-1');

    expectEqual(resolved.ok, false);
    expectEqual(resolved.error, '手动战力必须是大于 0 的数字。');
  });

  test('empty manual combat power uses current character combat power', () => {
    const resolved = resolveMonsterFilterCombatPower(250, '');

    expectEqual(resolved.ok, true);
    expectEqual(resolved.source, 'profile');
    expectClose(resolved.value, 250);
  });

  test('default monster filter keeps G13 and earlier non-event records only', () => {
    const result = filterMonsters(monsters, {
      combatPower: 100,
      selectedRanks: ['weakest', 'weak', 'normal', 'strong', 'awful', 'boss'],
      nameQuery: '',
      locationQuery: '',
      dataScope: 'g13',
      includeUnknownIntroducedBy: false,
      translationStatus: 'all',
    });

    expectEqual(result.map((item) => item.id).join(','), 'gray-wolf,red-spider');
    expectEqual(result[0].rank.id, 'weak');
    expectEqual(result[1].rank.id, 'strong');
  });

  test('complete monster filter can include future and unknown version records', () => {
    const result = filterMonsters(monsters, {
      combatPower: 100,
      selectedRanks: ['weakest', 'weak', 'normal', 'strong', 'awful', 'boss'],
      nameQuery: '',
      locationQuery: '',
      dataScope: 'all',
      includeUnknownIntroducedBy: true,
      translationStatus: 'all',
    });

    expectEqual(result.map((item) => item.id).join(','), 'unknown-snake,gray-wolf,red-spider,future-boss');
  });

  test('monster search matches simplified, traditional, English, and locations', () => {
    expectEqual(filterMonsters(monsters, filter({ nameQuery: '红蜘蛛' }))[0].id, 'red-spider');
    expectEqual(filterMonsters(monsters, filter({ nameQuery: '紅蜘蛛' }))[0].id, 'red-spider');
    expectEqual(filterMonsters(monsters, filter({ nameQuery: 'gray' }))[0].id, 'gray-wolf');
    expectEqual(filterMonsters(monsters, filter({ locationQuery: '艾菲' }))[0].id, 'red-spider');
  });

  test('monster filter can limit by translation status', () => {
    const result = filterMonsters(monsters, filter({ translationStatus: 'autoConverted' }));

    expectEqual(result.length, 1);
    expectEqual(result[0].id, 'red-spider');
  });

  function filter(overrides = {}) {
    return {
      combatPower: 100,
      selectedRanks: ['weakest', 'weak', 'normal', 'strong', 'awful', 'boss'],
      nameQuery: '',
      locationQuery: '',
      dataScope: 'g13',
      includeUnknownIntroducedBy: false,
      translationStatus: 'all',
      ...overrides,
    };
  }
})();
```

- [ ] **Step 2: Load failing tests in browser harness**

Modify `tests/browser-tests.html` so the script block includes monster domain files before the test files:

```html
    <script src="../src/skills/g13Skills.js"></script>
    <script src="../src/skills/skillSearch.js"></script>
    <script src="../src/monsters/monsterRanks.js"></script>
    <script src="../src/monsters/monsterRecords.js"></script>
    <script src="../src/state/appState.js"></script>
    <script src="../src/ui/renderApp.js"></script>
    <script src="./domain.test.js"></script>
    <script src="./importExport.test.js"></script>
    <script src="./skillSearch.test.js"></script>
    <script src="./monsterRanks.test.js"></script>
    <script src="./ui.test.js"></script>
```

Run: open `tests/browser-tests.html` in a browser.

Expected: failures mentioning `calculateMonsterRank is not a function` or missing `src/monsters/monsterRanks.js`.

- [ ] **Step 3: Implement monster rank helpers**

Create `src/monsters/monsterRanks.js`:

```javascript
(function () {
  const app = (window.MabinogiCP = window.MabinogiCP || {});

  const G13_ORDER = new Map([
    ['G1', 1],
    ['G2', 2],
    ['G3', 3],
    ['G4', 4],
    ['G5', 5],
    ['G6', 6],
    ['G7', 7],
    ['G8', 8],
    ['G9', 9],
    ['G10', 10],
    ['G11', 11],
    ['G12', 12],
    ['G13', 13],
  ]);

  app.MONSTER_RANKS = [
    { id: 'weakest', label: 'Weakest', zhCNLabel: '非常弱的敌人', minRatio: 0, maxRatio: 0.8 },
    { id: 'weak', label: 'Weak', zhCNLabel: '弱的敌人', minRatio: 0.8, maxRatio: 1 },
    { id: 'normal', label: '同级', zhCNLabel: '无标示', minRatio: 1, maxRatio: 1.4 },
    { id: 'strong', label: 'Strong', zhCNLabel: '强敌', minRatio: 1.4, maxRatio: 2 },
    { id: 'awful', label: 'Awful', zhCNLabel: '非常强悍的敌人', minRatio: 2, maxRatio: 3 },
    { id: 'boss', label: 'Boss', zhCNLabel: '首领级的敌人', minRatio: 3, maxRatio: null },
  ];

  app.DEFAULT_MONSTER_FILTERS = {
    selectedRanks: app.MONSTER_RANKS.map((rank) => rank.id),
    nameQuery: '',
    locationQuery: '',
    dataScope: 'g13',
    includeUnknownIntroducedBy: false,
    translationStatus: 'all',
    manualCombatPower: '',
  };

  app.calculateMonsterRank = function calculateMonsterRank(monsterCombatPower, characterCombatPower) {
    if (!Number.isFinite(monsterCombatPower) || !Number.isFinite(characterCombatPower) || characterCombatPower <= 0) {
      return null;
    }

    const ratio = monsterCombatPower / characterCombatPower;

    return app.MONSTER_RANKS.find((rank) => ratio >= rank.minRatio && (rank.maxRatio === null || ratio < rank.maxRatio)) || null;
  };

  app.calculateMonsterRankRanges = function calculateMonsterRankRanges(characterCombatPower) {
    return app.MONSTER_RANKS.reduce((ranges, rank) => {
      ranges[rank.id] = {
        min: rank.minRatio * characterCombatPower,
        maxExclusive: rank.maxRatio === null ? null : rank.maxRatio * characterCombatPower,
      };
      return ranges;
    }, {});
  };

  app.resolveMonsterFilterCombatPower = function resolveMonsterFilterCombatPower(profileCombatPower, manualCombatPower) {
    const trimmed = String(manualCombatPower || '').trim();

    if (trimmed !== '') {
      const value = Number(trimmed);

      if (!Number.isFinite(value) || value <= 0) {
        return { ok: false, value: null, source: 'manual', error: '手动战力必须是大于 0 的数字。' };
      }

      return { ok: true, value, source: 'manual', error: '' };
    }

    if (!Number.isFinite(profileCombatPower) || profileCombatPower <= 0) {
      return { ok: false, value: null, source: 'profile', error: '当前角色战力必须大于 0，请完善角色数据或填写手动战力。' };
    }

    return { ok: true, value: profileCombatPower, source: 'profile', error: '' };
  };

  app.filterMonsters = function filterMonsters(monsters, filters) {
    const selectedRanks = new Set(filters.selectedRanks);
    const nameQuery = normalize(filters.nameQuery);
    const locationQuery = normalize(filters.locationQuery);

    return monsters
      .filter((monster) => Number.isFinite(monster.combatPower))
      .filter((monster) => includeByScope(monster, filters))
      .map((monster) => ({ ...monster, rank: app.calculateMonsterRank(monster.combatPower, filters.combatPower) }))
      .filter((monster) => monster.rank && selectedRanks.has(monster.rank.id))
      .filter((monster) => matchesName(monster, nameQuery))
      .filter((monster) => matchesLocation(monster, locationQuery))
      .filter((monster) => filters.translationStatus === 'all' || monster.translationStatus === filters.translationStatus)
      .sort((left, right) => left.combatPower - right.combatPower || left.enName.localeCompare(right.enName));
  };

  function includeByScope(monster, filters) {
    if (monster.isEvent) {
      return false;
    }

    if (filters.dataScope === 'all') {
      return filters.includeUnknownIntroducedBy || monster.introducedBy !== 'unknown';
    }

    if (monster.introducedBy === 'unknown') {
      return Boolean(filters.includeUnknownIntroducedBy);
    }

    return G13_ORDER.has(monster.introducedBy) && G13_ORDER.get(monster.introducedBy) <= 13;
  }

  function matchesName(monster, query) {
    if (!query) {
      return true;
    }

    return [monster.zhCNName, monster.zhTWName, monster.enName].some((value) => normalize(value).includes(query));
  }

  function matchesLocation(monster, query) {
    if (!query) {
      return true;
    }

    return (monster.locations || []).some((location) => normalize(location).includes(query));
  }

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase();
  }
})();
```

- [ ] **Step 4: Add temporary monster records module**

Create `src/monsters/monsterRecords.js` so the browser harness can load it before the generated data task:

```javascript
(function () {
  const app = (window.MabinogiCP = window.MabinogiCP || {});

  app.MONSTER_RECORDS = [
    {
      id: 'gray-wolf',
      zhCNName: '灰狼',
      zhTWName: '灰狼',
      enName: 'Gray Wolf',
      combatPower: 90,
      locations: ['Tir Chonaill'],
      introducedBy: 'G1',
      isEvent: false,
      translationStatus: 'confirmed',
      source: 'seed',
    },
    {
      id: 'red-spider',
      zhCNName: '红蜘蛛',
      zhTWName: '紅蜘蛛',
      enName: 'Red Spider',
      combatPower: 140,
      locations: ['Alby Dungeon'],
      introducedBy: 'G1',
      isEvent: false,
      translationStatus: 'autoConverted',
      source: 'seed',
    },
  ];
})();
```

- [ ] **Step 5: Verify domain tests pass**

Run: open `tests/browser-tests.html` in a browser.

Expected: all existing tests and the new monster rank tests pass.

- [ ] **Step 6: Commit monster rank domain logic**

```powershell
$message = @'
Add monster rank filtering domain logic

'@
git add "src/monsters/monsterRanks.js" "src/monsters/monsterRecords.js" "tests/monsterRanks.test.js" "tests/browser-tests.html"
git commit -m $message
```

## Task 2: Monster Data Refresh Script and Runtime Data

**Files:**
- Create: `tools/buildMonsterData.py`
- Create: `data/raw/mabinogi-world-monster-cp.json`
- Modify: `src/monsters/monsterRecords.js`

- [ ] **Step 1: Add Python data refresh script**

Create `tools/buildMonsterData.py`:

```python
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

SOURCE_PAGE = "List_of_Monster_CP"
SOURCE_URL = "https://wiki.mabinogiworld.com/view/List_of_Monster_CP"
API_URL = "https://wiki.mabinogiworld.com/api.php"
ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "data" / "raw" / "mabinogi-world-monster-cp.json"
JS_PATH = ROOT / "src" / "monsters" / "monsterRecords.js"

VERSION_HINTS = {
    "Tir Chonaill": "G1",
    "Dunbarton": "G1",
    "Alby": "G1",
    "Ciar": "G1",
    "Rabbie": "G1",
    "Math": "G1",
    "Barri": "G1",
    "Fiodh": "G1",
    "Rundal": "G2",
    "Coill": "G3",
    "Peaca": "G3",
    "Connous": "G4",
    "Longa": "G4",
    "Metus": "G5",
    "Par": "G5",
    "Zardine": "G8",
    "Shadow": "G9",
    "Taillteann": "G9",
    "Tara": "G10",
    "Avon": "G13",
}

EVENT_WORDS = ("Event", "Halloween", "Christmas", "Anniversary")

ZH_CN_OVERRIDES = {
    "Gray Wolf": "灰狼",
    "Red Spider": "红蜘蛛",
    "Giant Spider": "巨大蜘蛛",
    "Zombie": "僵尸",
    "Golem": "巨魔像",
    "White Spider": "白蜘蛛",
    "Black Spider": "黑蜘蛛",
    "Skeleton": "骷髅",
    "Mimic": "宝箱怪",
    "Imp": "小恶魔",
    "Goblin": "哥布林",
    "Kobold": "狗头人",
    "Ogre Warrior": "食人魔战士",
}

ZH_TW_OVERRIDES = {
    "Gray Wolf": "灰狼",
    "Red Spider": "紅蜘蛛",
    "Giant Spider": "巨大蜘蛛",
    "Zombie": "殭屍",
    "Golem": "巨魔像",
    "White Spider": "白蜘蛛",
    "Black Spider": "黑蜘蛛",
    "Skeleton": "骷髏",
    "Mimic": "寶箱怪",
    "Imp": "小惡魔",
    "Goblin": "哥布林",
    "Kobold": "狗頭人",
    "Ogre Warrior": "食人魔戰士",
}


def main() -> int:
    text = fetch_page_text()
    rows = parse_monster_rows(text)
    raw_records = [to_raw_record(row) for row in rows]
    runtime_records = [to_runtime_record(record) for record in raw_records if record["combatPower"] is not None]

    RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
    RAW_PATH.write_text(json.dumps({
        "source": SOURCE_URL,
        "recordCount": len(raw_records),
        "records": raw_records,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    JS_PATH.parent.mkdir(parents=True, exist_ok=True)
    JS_PATH.write_text(render_js(runtime_records), encoding="utf-8")

    print(f"Wrote {len(raw_records)} raw records to {RAW_PATH}")
    print(f"Wrote {len(runtime_records)} runtime records to {JS_PATH}")
    return 0


def fetch_page_text() -> str:
    query = urllib.parse.urlencode({
        "action": "parse",
        "page": SOURCE_PAGE,
        "prop": "wikitext",
        "format": "json",
        "formatversion": "2",
    })
    request = urllib.request.Request(f"{API_URL}?{query}", headers={"User-Agent": "MabinogiCombatPowerDataBuilder/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload["parse"]["wikitext"]


def parse_monster_rows(text: str) -> list[dict]:
    rows = []
    current_location_notes: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("*"):
            current_location_notes.append(strip_markup(stripped.lstrip("* ").strip()))
            continue
        if not stripped.startswith("|"):
            continue
        cells = split_table_row(stripped)
        if len(cells) < 2:
            continue
        name = strip_markup(cells[0])
        combat_power = parse_number(strip_markup(cells[1]))
        if not name or name.lower() == "monster" or combat_power is None:
            continue
        rows.append({
            "name": name,
            "combatPower": combat_power,
            "hitPoints": strip_markup(cells[2]) if len(cells) > 2 else "",
            "meleeDamage": strip_markup(cells[3]) if len(cells) > 3 else "",
            "rangedDamage": strip_markup(cells[4]) if len(cells) > 4 else "",
            "defense": strip_markup(cells[5]) if len(cells) > 5 else "",
            "protection": strip_markup(cells[6]) if len(cells) > 6 else "",
            "experience": strip_markup(cells[7]) if len(cells) > 7 else "",
            "goldMin": strip_markup(cells[8]) if len(cells) > 8 else "",
            "goldMax": strip_markup(cells[9]) if len(cells) > 9 else "",
            "location": strip_markup(cells[10]) if len(cells) > 10 else "",
            "locationNotes": current_location_notes,
        })
        current_location_notes = []
    return rows


def split_table_row(line: str) -> list[str]:
    content = line.strip().strip("|")
    return [cell.strip() for cell in content.split("|")]


def strip_markup(value: str) -> str:
    value = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", value)
    value = re.sub(r"\[\[([^\]]+)\]\]", r"\1", value)
    value = re.sub(r"\[https?://[^\s\]]+\s+([^\]]+)\]", r"\1", value)
    value = re.sub(r"<[^>]+>", "", value)
    value = value.replace("'''", "").replace("''", "")
    return html.unescape(value).strip()


def parse_number(value: str) -> float | None:
    match = re.search(r"-?\d+(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?", value)
    if not match:
        return None
    return float(match.group(0).replace(",", ""))


def to_raw_record(row: dict) -> dict:
    locations = [row["location"], *row["locationNotes"]]
    locations = [location for location in locations if location]
    return {
        "enName": row["name"],
        "combatPower": row["combatPower"],
        "locations": locations,
        "raw": row,
        "source": SOURCE_URL,
    }


def to_runtime_record(record: dict) -> dict:
    en_name = record["enName"]
    zh_cn = ZH_CN_OVERRIDES.get(en_name, en_name)
    zh_tw = ZH_TW_OVERRIDES.get(en_name, "")
    translation_status = "confirmed" if en_name in ZH_CN_OVERRIDES else "missing"
    return {
        "id": slugify(en_name),
        "zhCNName": zh_cn,
        "zhTWName": zh_tw,
        "enName": en_name,
        "combatPower": record["combatPower"],
        "locations": record["locations"],
        "introducedBy": infer_introduced_by(record["locations"]),
        "isEvent": infer_is_event(record),
        "translationStatus": translation_status,
        "source": SOURCE_URL,
    }


def infer_introduced_by(locations: list[str]) -> str:
    joined = " ".join(locations)
    for token, generation in VERSION_HINTS.items():
        if token in joined:
            return generation
    return "unknown"


def infer_is_event(record: dict) -> bool:
    haystack = f"{record['enName']} {' '.join(record['locations'])}"
    return any(word in haystack for word in EVENT_WORDS)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug or "monster"


def render_js(records: list[dict]) -> str:
    return "(function () {\n  const app = (window.MabinogiCP = window.MabinogiCP || {});\n\n  app.MONSTER_RECORDS = " + json.dumps(records, ensure_ascii=False, indent=2) + ";\n})();\n"


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run data builder**

Run:

```powershell
python "tools/buildMonsterData.py"
```

Expected: the command prints two `Wrote ... records` lines, creates `data/raw/mabinogi-world-monster-cp.json`, and replaces `src/monsters/monsterRecords.js`.

- [ ] **Step 3: Review generated files for obvious parser failures**

Run:

```powershell
python -c "import json; p='data/raw/mabinogi-world-monster-cp.json'; d=json.load(open(p, encoding='utf-8')); print(d['recordCount']); print(d['records'][0]['enName'], d['records'][0]['combatPower'])"
```

Expected: the first printed number is greater than `100`, and the second printed line shows a monster name and numeric CP.

- [ ] **Step 4: Verify tests still pass after generated data loads**

Run: open `tests/browser-tests.html` in a browser.

Expected: all browser tests pass. If a generated `id` collides in real data, update `slugify()` to append a numeric suffix during `to_runtime_record()` and rerun the builder.

- [ ] **Step 5: Commit monster data pipeline**

```powershell
$message = @'
Add monster CP data pipeline

'@
git add "tools/buildMonsterData.py" "data/raw/mabinogi-world-monster-cp.json" "src/monsters/monsterRecords.js"
git commit -m $message
```

## Task 3: Monster Filter Tab UI

**Files:**
- Modify: `index.html`
- Modify: `src/ui/renderApp.js`
- Modify: `src/styles.css`
- Modify: `tests/ui.test.js`

- [ ] **Step 1: Load monster scripts in the app page**

Modify `index.html`:

```html
    <script src="./src/skills/g13Skills.js"></script>
    <script src="./src/skills/skillSearch.js"></script>
    <script src="./src/monsters/monsterRanks.js"></script>
    <script src="./src/monsters/monsterRecords.js"></script>
    <script src="./src/state/appState.js"></script>
    <script src="./src/ui/renderApp.js"></script>
```

- [ ] **Step 2: Add failing UI tests for the tab**

Append these tests to `tests/ui.test.js` before the closing `})();`:

```javascript
  test('monster tab uses current profile combat power by default', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    const strengthInput = root.querySelector('[data-stat="strength"]');
    strengthInput.value = '100';
    strengthInput.dispatchEvent(new Event('input', { bubbles: true }));

    root.querySelector('[data-tab="monsters"]').click();

    expectEqual(root.querySelector('[data-active-monster-cp]').textContent.includes('100.00'), true);
    expectEqual(root.querySelector('[data-monster-source]').textContent, '来自当前角色');

    root.remove();
    localStorage.clear();
  });

  test('monster tab manual override changes filter source only', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);
    root.querySelector('[data-tab="monsters"]').click();

    const manualInput = root.querySelector('[data-monster-manual-cp]');
    manualInput.value = '100';
    manualInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-monster-source]').textContent, '手动覆盖');
    expectEqual(root.querySelector('[data-active-monster-cp]').textContent.includes('100.00'), true);
    expectEqual(root.querySelector('.result-panel').textContent.includes('总战斗力：0.00'), true);

    root.remove();
    localStorage.clear();
  });

  test('monster tab validates invalid manual combat power', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);
    root.querySelector('[data-tab="monsters"]').click();

    const manualInput = root.querySelector('[data-monster-manual-cp]');
    manualInput.value = '-5';
    manualInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-monster-message]').textContent, '手动战力必须是大于 0 的数字。');

    root.remove();
    localStorage.clear();
  });

  test('monster tab can search generated monster records', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);
    root.querySelector('[data-tab="monsters"]').click();

    const manualInput = root.querySelector('[data-monster-manual-cp]');
    manualInput.value = '100';
    manualInput.dispatchEvent(new Event('input', { bubbles: true }));

    const searchInput = root.querySelector('[data-monster-name-query]');
    searchInput.value = 'gray';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-monster-results]').textContent.toLocaleLowerCase().includes('gray'), true);

    root.remove();
    localStorage.clear();
  });
```

Run: open `tests/browser-tests.html` in a browser.

Expected: the new UI tests fail because the tab and selectors do not exist yet.

- [ ] **Step 3: Add UI state and tab shell**

Modify the top of `app.renderApp` in `src/ui/renderApp.js`:

```javascript
  app.renderApp = function renderApp(root) {
    let state = app.loadState(localStorage) || app.createAppState();
    let skillQuery = '';
    let importMessage = '';
    let activeTab = 'character';
    let monsterFilters = { ...app.DEFAULT_MONSTER_FILTERS };
```

In `draw()`, replace the current direct section rendering inside `<main class="app-shell">` with a tab bar and a conditional body:

```javascript
            <div class="app-tabs" role="tablist">
              <button class="app-tab ${activeTab === 'character' ? 'app-tab--active' : ''}" data-tab="character" type="button">角色战力</button>
              <button class="app-tab ${activeTab === 'monsters' ? 'app-tab--active' : ''}" data-tab="monsters" type="button">怪物筛选</button>
            </div>
            ${activeTab === 'character' ? renderCharacterTab(state, profile, result, suggestions, skillQuery) : renderMonsterTab(profile, result, monsterFilters)}
```

Move the existing profile/stat/skill/result sections into a new helper named `renderCharacterTab`:

```javascript
  function renderCharacterTab(state, profile, result, suggestions, skillQuery) {
    return `
      <section class="panel">
        <h2>角色档案</h2>
        <label>选择角色
          <select data-profile-select>
            ${state.profiles.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === state.activeProfileId ? 'selected' : ''}>${escapeHtml(item.name || '未命名角色')}</option>`).join('')}
          </select>
        </label>
        <div class="profile-actions">
          <button data-add-profile>新建角色</button>
          <button data-duplicate-profile>复制当前角色</button>
          <button data-delete-profile ${state.profiles.length === 1 ? 'disabled' : ''}>删除当前角色</button>
        </div>
        <label>角色名 <input data-field="name" value="${escapeHtml(profile.name)}" /></label>
        <label>种族
          <select data-field="race">${renderRaceOptions(profile.race)}</select>
        </label>
        <label>称号 <input data-field="title" value="${escapeHtml(profile.title)}" /></label>
      </section>

      <section class="panel">
        <h2>白值属性</h2>
        <div class="stat-grid">
          ${STAT_FIELDS.map((field) => renderStatInput(field, profile, result)).join('')}
        </div>
      </section>

      <section class="panel">
        <h2>技能</h2>
        <label>搜索技能 <input data-skill-search value="${escapeHtml(skillQuery)}" placeholder="输入大陆名或台湾名" /></label>
        <div class="suggestions">
          ${suggestions.map((skill) => `<button data-add-skill="${skill.id}">添加 ${escapeHtml(skill.zhCNName)}</button>`).join('')}
        </div>
        <div class="skill-list">${renderLearnedSkills(profile, result.highestSkill && result.highestSkill.skillId, result.secondHighestSkill && result.secondHighestSkill.skillId)}</div>
      </section>

      ${renderResultPanel(result)}
    `;
  }
```

- [ ] **Step 4: Guard character-tab-only event bindings**

In `bindEvents()`, add tab binding first:

```javascript
      root.querySelectorAll('[data-tab]').forEach((button) => {
        button.addEventListener('click', () => {
          activeTab = button.dataset.tab;
          draw();
        });
      });

      if (activeTab === 'monsters') {
        bindMonsterEvents();
        return;
      }
```

This prevents character selectors from being queried while the monster tab is active.

- [ ] **Step 5: Render monster tab**

Add `renderMonsterTab` below `renderResultPanel`:

```javascript
  function renderMonsterTab(profile, result, filters) {
    const resolved = app.resolveMonsterFilterCombatPower(result.total, filters.manualCombatPower);
    const activeCombatPower = resolved.ok ? resolved.value : null;
    const activeFilters = activeCombatPower === null ? null : { ...filters, combatPower: activeCombatPower };
    const monsters = activeFilters ? app.filterMonsters(app.MONSTER_RECORDS, activeFilters) : [];
    const ranges = activeCombatPower === null ? null : app.calculateMonsterRankRanges(activeCombatPower);

    return `<section class="monster-layout">
      <aside class="panel monster-filters">
        <h2>怪物筛选</h2>
        <p class="field-help">当前角色：${escapeHtml(profile.name || '未命名角色')}</p>
        <p data-monster-source>${resolved.source === 'manual' ? '手动覆盖' : '来自当前角色'}</p>
        <p data-active-monster-cp>当前使用战力：${activeCombatPower === null ? '无效' : activeCombatPower.toFixed(2)}</p>
        <p class="import-message" data-monster-message>${escapeHtml(resolved.error)}</p>
        <label>手动覆盖战力
          <input data-monster-manual-cp type="number" min="0" value="${escapeHtml(filters.manualCombatPower)}" placeholder="留空使用当前角色" />
        </label>
        <fieldset class="monster-fieldset">
          <legend>强度</legend>
          <div class="monster-rank-options">
            ${app.MONSTER_RANKS.map((rank) => `<label><input data-monster-rank type="checkbox" value="${rank.id}" ${filters.selectedRanks.includes(rank.id) ? 'checked' : ''} /> ${rank.label}</label>`).join('')}
          </div>
        </fieldset>
        <label>名称搜索
          <input data-monster-name-query value="${escapeHtml(filters.nameQuery)}" placeholder="简体、繁中或英文" />
        </label>
        <label>地点搜索
          <input data-monster-location-query value="${escapeHtml(filters.locationQuery)}" placeholder="地点或来源场景" />
        </label>
        <label>数据范围
          <select data-monster-data-scope>
            <option value="g13" ${filters.dataScope === 'g13' ? 'selected' : ''}>G13 及以前</option>
            <option value="all" ${filters.dataScope === 'all' ? 'selected' : ''}>全部已知数据</option>
          </select>
        </label>
        <label class="inline-check">
          <input data-monster-include-unknown type="checkbox" ${filters.includeUnknownIntroducedBy ? 'checked' : ''} />
          包含版本未知
        </label>
        <label>译名状态
          <select data-monster-translation-status>
            <option value="all" ${filters.translationStatus === 'all' ? 'selected' : ''}>全部</option>
            <option value="confirmed" ${filters.translationStatus === 'confirmed' ? 'selected' : ''}>已确认</option>
            <option value="autoConverted" ${filters.translationStatus === 'autoConverted' ? 'selected' : ''}>自动转换</option>
            <option value="missing" ${filters.translationStatus === 'missing' ? 'selected' : ''}>待翻译</option>
          </select>
        </label>
      </aside>
      <section class="panel monster-results" data-monster-results>
        ${renderMonsterRanges(ranges)}
        <p>结果数量：${monsters.length}</p>
        ${filters.dataScope === 'all' ? '<p class="import-message">全部已知数据可能包含后期、版本未知或译名未校对记录。</p>' : ''}
        ${monsters.length === 0 ? renderMonsterEmptyState(activeCombatPower) : renderMonsterTable(monsters)}
      </section>
    </section>`;
  }
```

- [ ] **Step 6: Render rank ranges, empty state, and results table**

Add helpers below `renderMonsterTab`:

```javascript
  function renderMonsterRanges(ranges) {
    if (!ranges) {
      return '<p class="empty-state">当前战力无效，无法计算怪物强度区间。</p>';
    }

    return `<div class="monster-ranges">
      ${app.MONSTER_RANKS.map((rank) => `<div class="monster-range monster-range--${rank.id}">
        <strong>${rank.label}</strong>
        <span>${formatRange(ranges[rank.id])}</span>
      </div>`).join('')}
    </div>`;
  }

  function renderMonsterEmptyState(activeCombatPower) {
    return activeCombatPower === null
      ? '<p class="empty-state">请完善角色战力或填写有效的手动战力。</p>'
      : '<p class="empty-state">当前条件下没有匹配怪物，可调整强度、范围或搜索条件。</p>';
  }

  function renderMonsterTable(monsters) {
    return `<table class="monster-table">
      <thead>
        <tr>
          <th>中文名</th>
          <th>繁中名</th>
          <th>英文原名</th>
          <th>CP</th>
          <th>相对强度</th>
          <th>地点/来源</th>
          <th>译名状态</th>
        </tr>
      </thead>
      <tbody>
        ${monsters.map((monster) => `<tr>
          <td>${escapeHtml(monster.zhCNName || monster.enName)}</td>
          <td>${escapeHtml(monster.zhTWName || '')}</td>
          <td>${escapeHtml(monster.enName)}</td>
          <td>${monster.combatPower}</td>
          <td>${escapeHtml(monster.rank.label)} / ${escapeHtml(monster.rank.zhCNLabel)}</td>
          <td>${escapeHtml((monster.locations || []).join('、') || monster.source)}</td>
          <td>${translationStatusLabel(monster.translationStatus)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  function formatRange(range) {
    const min = Math.ceil(range.min);

    if (range.maxExclusive === null) {
      return `${min}+`;
    }

    return `${min} - ${Math.max(min, Math.ceil(range.maxExclusive) - 1)}`;
  }

  function translationStatusLabel(status) {
    const labels = {
      confirmed: '已确认',
      autoConverted: '自动转换',
      missing: '待翻译',
    };

    return labels[status] || status;
  }
```

- [ ] **Step 7: Bind monster filter events**

Inside `app.renderApp`, add this function before `importFromInput`:

```javascript
    function bindMonsterEvents() {
      root.querySelector('[data-monster-manual-cp]').addEventListener('input', (event) => {
        monsterFilters = { ...monsterFilters, manualCombatPower: event.target.value };
        draw();
      });

      root.querySelectorAll('[data-monster-rank]').forEach((input) => {
        input.addEventListener('change', () => {
          const selectedRanks = Array.from(root.querySelectorAll('[data-monster-rank]:checked')).map((item) => item.value);
          monsterFilters = { ...monsterFilters, selectedRanks };
          draw();
        });
      });

      root.querySelector('[data-monster-name-query]').addEventListener('input', (event) => {
        monsterFilters = { ...monsterFilters, nameQuery: event.target.value };
        draw();
      });

      root.querySelector('[data-monster-location-query]').addEventListener('input', (event) => {
        monsterFilters = { ...monsterFilters, locationQuery: event.target.value };
        draw();
      });

      root.querySelector('[data-monster-data-scope]').addEventListener('change', (event) => {
        monsterFilters = { ...monsterFilters, dataScope: event.target.value };
        draw();
      });

      root.querySelector('[data-monster-include-unknown]').addEventListener('change', (event) => {
        monsterFilters = { ...monsterFilters, includeUnknownIntroducedBy: event.target.checked };
        draw();
      });

      root.querySelector('[data-monster-translation-status]').addEventListener('change', (event) => {
        monsterFilters = { ...monsterFilters, translationStatus: event.target.value };
        draw();
      });
    }
```

- [ ] **Step 8: Extend focus preservation for monster fields**

Add these cases to `focusSelector(element)`:

```javascript
    if (element.dataset.monsterManualCp !== undefined) {
      return '[data-monster-manual-cp]';
    }

    if (element.dataset.monsterNameQuery !== undefined) {
      return '[data-monster-name-query]';
    }

    if (element.dataset.monsterLocationQuery !== undefined) {
      return '[data-monster-location-query]';
    }
```

- [ ] **Step 9: Add styles for tabs and monster results**

Append to `src/styles.css`:

```css
.app-tabs {
  display: flex;
  gap: 8px;
  margin: 0 0 16px;
}

.app-tab {
  background: #e2e8f0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  font-weight: 700;
}

.app-tab--active {
  background: #ffffff;
  border-color: #e5e7eb;
  color: #0f172a;
}

.monster-layout {
  display: grid;
  gap: 16px;
  grid-template-columns: 300px 1fr;
}

.monster-fieldset {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin: 0 0 10px;
  padding: 10px;
}

.monster-rank-options {
  display: grid;
  gap: 6px;
}

.inline-check {
  align-items: center;
  display: flex;
  gap: 8px;
}

.monster-ranges {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  margin-bottom: 12px;
}

.monster-range {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
}

.monster-range strong,
.monster-range span {
  display: block;
}

.monster-table {
  border-collapse: collapse;
  width: 100%;
}

.monster-table th,
.monster-table td {
  border-bottom: 1px solid #e5e7eb;
  padding: 8px;
  text-align: left;
}

@media (max-width: 900px) {
  .monster-layout {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 10: Verify UI tests pass**

Run: open `tests/browser-tests.html` in a browser.

Expected: all tests pass, including monster tab tests.

- [ ] **Step 11: Commit monster filter UI**

```powershell
$message = @'
Add monster filter tab UI

'@
git add "index.html" "src/ui/renderApp.js" "src/styles.css" "tests/ui.test.js"
git commit -m $message
```

## Task 4: Data Quality Pass and Documentation

**Files:**
- Modify: `data/raw/mabinogi-world-monster-cp.json`
- Modify: `src/monsters/monsterRecords.js`
- Modify: `docs/superpowers/specs/2026-06-12-monster-combat-power-filter-design.md`

- [ ] **Step 1: Check default G13 result count**

Run in browser console on `index.html` after loading the app:

```javascript
const cp = 100;
const results = MabinogiCP.filterMonsters(MabinogiCP.MONSTER_RECORDS, {
  ...MabinogiCP.DEFAULT_MONSTER_FILTERS,
  combatPower: cp,
});
console.log(results.length, results.slice(0, 5).map((monster) => `${monster.enName}:${monster.combatPower}`));
```

Expected: `results.length` is greater than `0`, and printed records have finite CP values.

- [ ] **Step 2: Add confirmed translations for common early monsters found in generated data**

Open `tools/buildMonsterData.py` and extend `ZH_CN_OVERRIDES` and `ZH_TW_OVERRIDES` only with names that appear in `data/raw/mabinogi-world-monster-cp.json`.

Use this exact pattern:

```python
ZH_CN_OVERRIDES = {
    "Gray Wolf": "灰狼",
    "Red Spider": "红蜘蛛",
    "Giant Spider": "巨大蜘蛛",
    "Zombie": "僵尸",
    "Golem": "巨魔像",
    "White Spider": "白蜘蛛",
    "Black Spider": "黑蜘蛛",
    "Skeleton": "骷髅",
    "Mimic": "宝箱怪",
    "Imp": "小恶魔",
    "Goblin": "哥布林",
    "Kobold": "狗头人",
    "Ogre Warrior": "食人魔战士",
}
```

After adding entries, rerun:

```powershell
python "tools/buildMonsterData.py"
```

Expected: `src/monsters/monsterRecords.js` updates, and records with override names have `translationStatus: "confirmed"`.

- [ ] **Step 3: Document data refresh command in the spec**

Add this section before `## 已确认决策` in `docs/superpowers/specs/2026-06-12-monster-combat-power-filter-design.md`:

````markdown
## 数据刷新流程

怪物 CP 数据通过 `tools/buildMonsterData.py` 刷新。该脚本使用 Python 标准库读取 Mabinogi World Wiki 的 `List of Monster CP` 页面，写入 `data/raw/mabinogi-world-monster-cp.json`，并生成浏览器使用的 `src/monsters/monsterRecords.js`。

刷新命令：

```powershell
python "tools/buildMonsterData.py"
```

刷新后需要检查默认 G13 结果、译名状态和版本未知比例，确认没有明显解析错误后再提交。
````

- [ ] **Step 4: Verify tests and data refresh**

Run:

```powershell
python "tools/buildMonsterData.py"
```

Expected: prints two `Wrote ... records` lines.

Run: open `tests/browser-tests.html` in a browser.

Expected: all tests pass.

- [ ] **Step 5: Commit data quality documentation**

```powershell
$message = @'
Document monster data refresh workflow

'@
git add "tools/buildMonsterData.py" "data/raw/mabinogi-world-monster-cp.json" "src/monsters/monsterRecords.js" "docs/superpowers/specs/2026-06-12-monster-combat-power-filter-design.md"
git commit -m $message
```

## Task 5: Final Verification

**Files:**
- No planned source edits.

- [ ] **Step 1: Verify working tree**

Run:

```powershell
git status --short
```

Expected: no output.

- [ ] **Step 2: Verify data script**

Run:

```powershell
python "tools/buildMonsterData.py"
```

Expected: prints two `Wrote ... records` lines and exits `0`.

- [ ] **Step 3: Verify browser tests**

Run: open `tests/browser-tests.html` in a browser.

Expected: the page reports all tests passed. Record the exact pass count in the final implementation summary.

- [ ] **Step 4: Manual smoke test**

Open `index.html` in a browser and perform:

1. Enter `100` in `力量`.
2. Switch to `怪物筛选`.
3. Confirm `当前使用战力` shows `100.00` and `来自当前角色`.
4. Enter `200` in manual override.
5. Confirm `当前使用战力` shows `200.00` and `手动覆盖`.
6. Search `gray`.
7. Confirm the table filters to records matching `gray` when generated data contains that name.
8. Switch back to `角色战力`.
9. Confirm the character result still shows the original calculated total, not the manual override.

- [ ] **Step 5: Final status**

Run:

```powershell
git status --short
```

Expected: no output after any generated files are committed.
