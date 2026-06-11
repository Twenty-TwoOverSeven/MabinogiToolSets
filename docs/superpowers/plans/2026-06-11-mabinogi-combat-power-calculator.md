# 洛奇战斗力计算器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个无需 npm、无需构建步骤、可直接双击 `index.html` 打开的本地静态洛奇战斗力计算器。

**Architecture:** 使用普通 HTML/CSS/JavaScript。所有脚本以经典 `<script src="..."></script>` 按顺序加载，并把功能挂到单一全局对象 `window.MabinogiCP`，避免 `file://` 打开时 ES modules 的跨源限制。

**Tech Stack:** HTML, CSS, 原生经典 JavaScript, `localStorage`, `FileReader`, `Blob`。禁止 npm、Node 包管理器、Vite、构建器、测试框架和 ES modules。

---

## 文件结构

- Create: `index.html` - 应用入口，按顺序加载所有普通脚本。
- Create: `src/styles.css` - 页面样式和技能高亮样式。
- Create: `src/domain/ranks.js` - 挂载 `MabinogiCP.SKILL_RANKS` 和 `MabinogiCP.isSkillRank`。
- Create: `src/domain/calculateCombatPower.js` - 挂载 `MabinogiCP.calculateCombatPower`。
- Create: `src/profiles/profileFactory.js` - 挂载 `MabinogiCP.createDefaultProfile`。
- Create: `src/profiles/importExport.js` - 挂载 `MabinogiCP.exportProfiles` 和 `MabinogiCP.importProfiles`。
- Create: `src/skills/g13Skills.js` - 挂载 `MabinogiCP.G13_SKILLS`。
- Create: `src/skills/skillSearch.js` - 挂载 `MabinogiCP.searchSkills` 和 `MabinogiCP.knownSkillIds`。
- Create: `src/state/appState.js` - 挂载多角色状态工具。
- Create: `src/ui/renderApp.js` - 挂载 `MabinogiCP.renderApp`。
- Create: `src/main.js` - 启动应用。
- Create: `tests/browser-tests.html` - 浏览器测试入口，按顺序加载测试脚本。
- Create: `tests/testHarness.js` - 挂载测试断言工具。
- Create: `tests/domain.test.js` - 公式测试。
- Create: `tests/importExport.test.js` - 导入导出测试。
- Create: `tests/skillSearch.test.js` - 搜索测试。
- Create: `docs/data/g13-skill-name-map.md` - 技能译名映射说明。
- Create: `README.md` - 使用和验证说明。

## Task 1: Static App Shell

**Files:**
- Create: `index.html`
- Create: `src/styles.css`
- Create: `src/main.js`

- [x] **Step 1: Create `index.html`**

`index.html` must use a normal script, not `type="module"`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>洛奇战斗力计算器</title>
    <link rel="stylesheet" href="./src/styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <script src="./src/main.js"></script>
  </body>
</html>
```

- [x] **Step 2: Create base styles**

`src/styles.css` includes base font, reset, `.app-shell`, `.panel`, `.app-header`, `.skill-row--top`, and `.skill-row--second`.

- [x] **Step 3: Create minimal startup script**

`src/main.js` uses an IIFE, checks `#app`, and renders `洛奇战斗力计算器` plus `应用初始化完成。`

- [ ] **Step 4: Verify and commit**

Open `index.html` in a browser. Expected: the heading and initialization text render with no console error.

Commit:

```powershell
git add index.html src/styles.css src/main.js
git commit -m "Add static app shell"
```

## Task 2: Browser Test Harness And Calculation Core

**Files:**
- Create: `src/domain/ranks.js`
- Create: `src/domain/calculateCombatPower.js`
- Create: `tests/testHarness.js`
- Create: `tests/domain.test.js`
- Create: `tests/browser-tests.html`

- [ ] **Step 1: Add `tests/testHarness.js`**

Expose `MabinogiCPTest.test`, `MabinogiCPTest.expectEqual`, `MabinogiCPTest.expectClose`, and `MabinogiCPTest.renderResults`.

- [ ] **Step 2: Add `tests/browser-tests.html`**

Load scripts in this order: `testHarness.js`, `../src/domain/ranks.js`, `../src/domain/calculateCombatPower.js`, `domain.test.js`, then call `MabinogiCPTest.renderResults()`.

- [ ] **Step 3: Add ranks**

`src/domain/ranks.js` creates `window.MabinogiCP` if missing and assigns:

```js
SKILL_RANKS = ['练习', 'F', 'E', 'D', 'C', 'B', 'A', '9', '8', '7', '6', '5', '4', '3', '2', '1']
```

- [ ] **Step 4: Add failing formula tests**

`tests/domain.test.js` covers no skills, one skill, two skills, and tied skill values.

- [ ] **Step 5: Implement `calculateCombatPower`**

Use the confirmed formula:

```text
最高技能 + 0.5 * 次高技能 + 0.5 * 生命力 + 0.33 * 魔法值 + 0.33 * 体力值 + 1.0 * 力量 + 0.2 * 智力 + 0.1 * 敏捷 + 0.5 * 意志 + 0.1 * 幸运
```

Tie-breaking uses learned skill order.

- [ ] **Step 6: Verify and commit**

Open `tests/browser-tests.html`. Expected: `4/4 passed`.

Commit:

```powershell
git add src/domain tests/testHarness.js tests/domain.test.js tests/browser-tests.html
git commit -m "Add combat power calculation logic"
```

## Task 3: Profiles And JSON Persistence

**Files:**
- Create: `src/profiles/profileFactory.js`
- Create: `src/profiles/importExport.js`
- Create: `tests/importExport.test.js`

- [ ] **Step 1: Add default profile factory**

`createDefaultProfile(name = '新角色')` returns one human profile with empty title, zero stats, and no skills.

- [ ] **Step 2: Add import/export tests**

Tests cover JSON round trip, unsupported schema, duplicate name merge, and unknown skill IDs preserved with warnings.

- [ ] **Step 3: Implement JSON persistence**

Use schema version `1`. Import validates race, non-negative numeric stats, legal ranks, and profile shape before changing state.

- [ ] **Step 4: Verify and commit**

Update `tests/browser-tests.html` to load profile scripts and `importExport.test.js`. Expected after opening: `8/8 passed`.

Commit:

```powershell
git add src/profiles tests/importExport.test.js tests/browser-tests.html
git commit -m "Add profile JSON import and export"
```

## Task 4: G13 Skill Data And Search

**Files:**
- Create: `docs/data/g13-skill-name-map.md`
- Create: `src/skills/g13Skills.js`
- Create: `src/skills/skillSearch.js`
- Create: `tests/skillSearch.test.js`

- [ ] **Step 1: Add mapping doc**

Record reviewed Taiwan-to-mainland names. If an official mainland name is missing, stop and ask the user instead of guessing.

- [ ] **Step 2: Add starter skill data**

Include at least `defense`, `smash`, `magnum_shot`, and `water_cannon`, each with all 16 rank values.

- [ ] **Step 3: Add search logic**

Search by `zhCNName` and `twName`, exclude already learned skills, and expose known skill IDs.

- [ ] **Step 4: Verify and commit**

Update `tests/browser-tests.html` to load skill scripts and `skillSearch.test.js`. Expected after opening: `13/13 passed`.

Commit:

```powershell
git add docs/data/g13-skill-name-map.md src/skills tests/skillSearch.test.js tests/browser-tests.html
git commit -m "Add G13 skill data and search"
```

## Task 5: App State And Full UI

**Files:**
- Create: `src/state/appState.js`
- Create: `src/ui/renderApp.js`
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Add state helpers**

Support create state, active profile lookup, update active profile, add profile, select profile, duplicate profile, delete profile while keeping at least one profile, save to and load from `localStorage`.

- [ ] **Step 2: Add UI renderer**

Render character selection, create/copy/delete controls, name/race/title fields, eight stat inputs, skill search/add list, rank selectors, row highlights for highest and second-highest skills, result summary, JSON export, replace import, and merge import.

- [ ] **Step 3: Load scripts in `index.html`**

Load scripts in dependency order before `src/main.js`: ranks, calculator, profile factory, import/export, skills, search, state, UI, main. All scripts are normal scripts, not modules.

- [ ] **Step 4: Update `src/main.js`**

Call `window.MabinogiCP.renderApp(app)` instead of rendering the placeholder.

- [ ] **Step 5: Verify and commit**

Open `index.html`. Expected:
- Create/switch/copy/delete profiles works.
- Editing `力量` to `100` shows total `100.00`.
- Searching `防御`, adding it, and changing rank to `1` shows highest skill `防御 400`.
- Highest row is highlighted without an inline label.
- Export downloads JSON; replace import restores it.

Commit:

```powershell
git add index.html src/state src/ui src/main.js src/styles.css
git commit -m "Add static calculator UI"
```

## Task 6: Final Docs And Verification

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/plans/2026-06-11-mabinogi-combat-power-calculator.md`

- [ ] **Step 1: Add README**

Document direct browser use, `tests/browser-tests.html`, manual verification, and the no npm/no build constraint.

- [ ] **Step 2: Final verification**

Open `tests/browser-tests.html` and `index.html` in the target browser. Expected: all tests pass and manual checklist passes.

- [ ] **Step 3: Commit final docs**

```powershell
git add README.md docs/superpowers/plans/2026-06-11-mabinogi-combat-power-calculator.md
git commit -m "Document static calculator usage"
```

## Self-Review

- No npm, Node package manager, Vite, build tool, test framework, or ES modules are used.
- Direct `file://` browser opening is supported because scripts are classic scripts.
- Original spec coverage is preserved: multi-profile, JSON import/export, eight stat formula, skill search-add editing, highest/second-highest row highlighting, and result breakdown.
