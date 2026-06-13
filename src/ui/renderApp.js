(function () {
  const app = (window.MabinogiCP = window.MabinogiCP || {});

  const STAT_FIELDS = [
    { key: 'life', label: '生命力' },
    { key: 'mana', label: '魔法值' },
    { key: 'stamina', label: '体力值' },
    { key: 'strength', label: '力量' },
    { key: 'intelligence', label: '智力' },
    { key: 'dexterity', label: '敏捷' },
    { key: 'will', label: '意志' },
    { key: 'luck', label: '幸运' },
  ];

  app.renderApp = function renderApp(root) {
    let state = app.loadState(localStorage) || app.createAppState();
    let skillQuery = '';
    let importMessage = '';
    let activeTab = 'character';
    let monsterFilters = { ...app.DEFAULT_MONSTER_FILTERS };

    function setState(next) {
      state = ensureStateHasProfile(next);
      app.saveState(localStorage, state);
      draw();
    }

    function draw() {
      const focusState = captureFocus(root);
      const profile = app.activeProfile(state);
      const result = app.calculateCombatPower(profile, app.G13_SKILLS);
      const suggestions = app.searchSkills(skillQuery, app.G13_SKILLS, profile.skills).slice(0, 8);

      root.innerHTML = `
        <main class="app-shell">
          <header class="app-header">
            <h1>洛奇战斗力计算器</h1>
            <p>浏览器自动保存只作临时便利，请定期导出 JSON 备份。</p>
            <div class="backup-actions">
              <button data-export-json>导出 JSON</button>
              <label class="file-action">替换导入 <input data-import-replace type="file" accept="application/json" /></label>
              <label class="file-action">合并导入 <input data-import-merge type="file" accept="application/json" /></label>
            </div>
            <p class="import-message" data-import-message>${escapeHtml(importMessage)}</p>
          </header>

          ${renderTabs(activeTab)}
          ${activeTab === 'character' ? renderCharacterTab(state, profile, result, suggestions, skillQuery) : renderMonsterTab(result, monsterFilters)}
        </main>
      `;

      bindEvents();
      restoreFocus(root, focusState);
    }

    function bindEvents() {
      root.querySelectorAll('[data-tab]').forEach((button) => {
        button.addEventListener('click', () => {
          activeTab = button.dataset.tab;
          draw();
        });
      });

      bindCommonEvents();

      if (activeTab === 'monsters') {
        bindMonsterEvents();
        return;
      }

      root.querySelector('[data-profile-select]').addEventListener('change', (event) => {
        setState(app.selectProfile(state, event.target.value));
      });

      root.querySelector('[data-add-profile]').addEventListener('click', () => {
        importMessage = '';
        setState(app.addProfile(state, app.createDefaultProfile()));
      });

      root.querySelector('[data-duplicate-profile]').addEventListener('click', () => {
        const current = app.activeProfile(state);
        const copy = JSON.parse(JSON.stringify(current));
        copy.id = crypto.randomUUID();
        copy.name = `${current.name || '未命名角色'} 副本`;
        importMessage = '';
        setState(app.addProfile(state, copy));
      });

      root.querySelector('[data-delete-profile]').addEventListener('click', () => {
        const current = app.activeProfile(state);

        if (confirm(`确定删除角色“${current.name || '未命名角色'}”吗？`)) {
          importMessage = '';
          setState(app.deleteProfile(state, current.id));
        }
      });

      root.querySelectorAll('[data-field]').forEach((input) => {
        input.addEventListener('input', () => {
          const key = input.dataset.field;
          importMessage = '';
          state = app.updateActiveProfile(state, (profile) => ({ ...profile, [key]: input.value }));
          app.saveState(localStorage, state);
          updateImportMessage();
        });
      });

      root.querySelectorAll('[data-stat]').forEach((input) => {
        input.addEventListener('input', () => {
          const key = input.dataset.stat;
          const value = Number(input.value || 0);

          if (!Number.isFinite(value) || value < 0) {
            importMessage = `白值属性无效：${statLabel(key)}`;
            updateImportMessage();
            return;
          }

          importMessage = '';
          state = app.updateActiveProfile(state, (profile) => ({ ...profile, stats: { ...profile.stats, [key]: value } }));
          app.saveState(localStorage, state);
          updateImportMessage();
          updateCalculatedView();
        });
      });

      const skillSearchInput = root.querySelector('[data-skill-search]');
      let isComposing = false;

      skillSearchInput.addEventListener('compositionstart', () => {
        isComposing = true;
      });

      skillSearchInput.addEventListener('compositionend', (event) => {
        isComposing = false;
        skillQuery = event.target.value;
        draw();
      });

      skillSearchInput.addEventListener('input', (event) => {
        skillQuery = event.target.value;

        if (!isComposing) {
          draw();
        }
      });

      root.querySelectorAll('[data-add-skill]').forEach((button) => {
        button.addEventListener('click', () => {
          const skillId = button.dataset.addSkill;
          skillQuery = '';
          importMessage = '';
          setState(app.updateActiveProfile(state, (profile) => ({ ...profile, skills: [...profile.skills, { skillId, rank: 'F' }] })));
        });
      });

      root.querySelectorAll('[data-rank-for]').forEach((select) => {
        select.addEventListener('change', () => {
          const skillId = select.dataset.rankFor;
          importMessage = '';
          setState(app.updateActiveProfile(state, (profile) => ({
            ...profile,
            skills: profile.skills.map((skill) => (skill.skillId === skillId ? { ...skill, rank: select.value } : skill)),
          })));
        });
      });

      root.querySelectorAll('[data-remove-skill]').forEach((button) => {
        button.addEventListener('click', () => {
          const skillId = button.dataset.removeSkill;
          importMessage = '';
          setState(app.updateActiveProfile(state, (profile) => ({
            ...profile,
            skills: profile.skills.filter((skill) => skill.skillId !== skillId),
          })));
        });
      });
    }

    function bindCommonEvents() {
      root.querySelector('[data-export-json]').addEventListener('click', () => {
        try {
          downloadJson(app.exportProfiles(state.profiles));
          importMessage = '已生成 JSON 备份。';
          draw();
        } catch (error) {
          importMessage = error.message;
          draw();
        }
      });

      root.querySelector('[data-import-replace]').addEventListener('change', (event) => {
        importFromInput(event.currentTarget, 'replace');
      });

      root.querySelector('[data-import-merge]').addEventListener('change', (event) => {
        importFromInput(event.currentTarget, 'merge');
      });
    }

    function bindMonsterEvents() {
      root.querySelectorAll('[data-monster-rank]').forEach((input) => {
        input.addEventListener('change', () => {
          const selectedRanks = Array.from(root.querySelectorAll('[data-monster-rank]:checked')).map((item) => item.value);
          monsterFilters = { ...monsterFilters, selectedRanks };
          draw();
        });
      });

      const manualInput = root.querySelector('[data-monster-manual-cp]');
      manualInput.addEventListener('input', (event) => {
        monsterFilters = { ...monsterFilters, manualCombatPower: event.target.value };
        draw();
      });

      const nameInput = root.querySelector('[data-monster-name-query]');
      bindMonsterTextFilter(nameInput, 'nameQuery');

      const locationInput = root.querySelector('[data-monster-location-query]');
      bindMonsterTextFilter(locationInput, 'locationQuery');

      root.querySelector('[data-monster-data-scope]').addEventListener('change', (event) => {
        monsterFilters = { ...monsterFilters, dataScope: event.target.value };
        draw();
      });

      root.querySelector('[data-monster-include-unknown]').addEventListener('change', (event) => {
        monsterFilters = { ...monsterFilters, includeUnknownIntroducedBy: event.target.checked };
        draw();
      });

    }

    function bindMonsterTextFilter(input, key) {
      let isComposing = false;

      input.addEventListener('compositionstart', () => {
        isComposing = true;
      });

      input.addEventListener('compositionend', (event) => {
        isComposing = false;
        monsterFilters = { ...monsterFilters, [key]: event.target.value };
        draw();
      });

      input.addEventListener('input', (event) => {
        monsterFilters = { ...monsterFilters, [key]: event.target.value };

        if (!isComposing) {
          draw();
        }
      });
    }

    async function importFromInput(input, mode) {
      const file = input.files && input.files[0];

      if (!file) {
        return;
      }

      const text = await file.text();
      const result = app.importProfiles(text, {
        knownSkillIds: app.knownSkillIds(app.G13_SKILLS),
        existingProfiles: state.profiles,
        mode,
      });

      input.value = '';

      if (!result.ok) {
        importMessage = result.error;
        draw();
        return;
      }

      const profiles = result.profiles.length > 0 ? result.profiles : [app.createDefaultProfile()];
      const unknownMessage = result.unknownSkillIds.length > 0 ? ` 未识别技能：${result.unknownSkillIds.join(', ')}` : '';
      importMessage = `导入完成。${unknownMessage}`;
      setState({ profiles, activeProfileId: profiles[0].id });
    }

    draw();

    function updateCalculatedView() {
      const profile = app.activeProfile(state);
      const result = app.calculateCombatPower(profile, app.G13_SKILLS);
      const resultPanel = root.querySelector('.result-panel');

      resultPanel.outerHTML = renderResultPanel(result);

      result.statContributions.forEach((item) => {
        const contribution = root.querySelector(`[data-stat-contribution="${item.key}"]`);

        if (contribution) {
          contribution.textContent = `贡献：${item.contribution.toFixed(2)}`;
        }
      });
    }

    function updateImportMessage() {
      const message = root.querySelector('[data-import-message]');

      if (message) {
        message.textContent = importMessage;
      }
    }
  };

  function ensureStateHasProfile(state) {
    if (state.profiles.length > 0) {
      return state;
    }

    return app.createAppState();
  }

  function renderRaceOptions(value) {
    return ['人类', '精灵', '巨人'].map((race) => `<option value="${race}" ${race === value ? 'selected' : ''}>${race}</option>`).join('');
  }

  function renderTabs(activeTab) {
    return `<nav class="page-tabs" aria-label="页面切换">
      <button class="page-tab ${activeTab === 'character' ? 'page-tab--active' : ''}" data-tab="character" type="button">角色战力</button>
      <button class="page-tab ${activeTab === 'monsters' ? 'page-tab--active' : ''}" data-tab="monsters" type="button">怪物筛选</button>
    </nav>`;
  }

  function renderCharacterTab(state, profile, result, suggestions, skillQuery) {
    return `<div class="tab-panel tab-panel--character">
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
    </div>`;
  }

  function renderStatInput(field, profile, result) {
    const contribution = result.statContributions.find((item) => item.key === field.key);

    return `<label>${field.label}
      <input type="number" min="0" data-stat="${field.key}" value="${profile.stats[field.key]}" />
      <span class="field-help" data-stat-contribution="${field.key}">贡献：${contribution.contribution.toFixed(2)}</span>
    </label>`;
  }

  function renderResultPanel(result) {
    return `<section class="panel result-panel">
      <h2>计算结果</h2>
      <p>总战斗力：${result.total.toFixed(2)}</p>
      <p>最高技能：${result.highestSkill ? `${escapeHtml(result.highestSkill.name)} ${result.highestSkill.combatPower}` : '无'}</p>
      <p>次高技能：${result.secondHighestSkill ? `${escapeHtml(result.secondHighestSkill.name)} ${result.secondHighestSkill.combatPower}` : '无'}</p>
      <p>技能贡献：${result.skillContribution.toFixed(2)}</p>
      <p>白值贡献：${result.baseStatContribution.toFixed(2)}</p>
      <ul>${result.statContributions.map((item) => `<li>${item.label}: ${item.contribution.toFixed(2)}</li>`).join('')}</ul>
    </section>`;
  }

  function renderMonsterTab(result, filters) {
    const resolved = app.resolveMonsterFilterCombatPower(result.total, filters.manualCombatPower);
    const combatPower = resolved.ok ? resolved.value : null;
    const monsters = resolved.ok ? app.filterMonsters(app.MONSTER_RECORDS, { ...filters, combatPower }) : [];
    const sourceText = resolved.ok ? (resolved.source === 'manual' ? '手动覆盖' : '来自当前角色') : '';
    const message = resolved.ok ? '' : resolved.error;
    const ranges = resolved.ok ? app.calculateMonsterRankRanges(combatPower) : null;

    return `<section class="monster-layout">
      <aside class="panel monster-filter-panel monster-filters">
        <h2>筛选条件</h2>
        <div class="monster-filter-grid">
          <label>手动战力
            <input data-monster-manual-cp type="number" min="0" step="0.01" value="${escapeHtml(filters.manualCombatPower)}" placeholder="默认使用当前角色" />
          </label>
          <label>名称搜索
            <input data-monster-name-query value="${escapeHtml(filters.nameQuery)}" placeholder="中文、繁中或英文" />
          </label>
          <label>地点搜索
            <input data-monster-location-query value="${escapeHtml(filters.locationQuery)}" placeholder="地点或来源" />
          </label>
          <label>资料范围
            <select data-monster-data-scope>
              <option value="g13" ${filters.dataScope === 'g13' ? 'selected' : ''}>G13 及以前</option>
              <option value="all" ${filters.dataScope === 'all' ? 'selected' : ''}>全部已知数据</option>
            </select>
          </label>
          <label class="checkbox-label">
            <input data-monster-include-unknown type="checkbox" ${filters.includeUnknownIntroducedBy ? 'checked' : ''} />
            包含未知世代
          </label>
        </div>
        <fieldset class="monster-rank-filters">
          <legend>相对强度</legend>
          ${app.MONSTER_RANKS.map((rank) => `<label class="checkbox-label">
            <input data-monster-rank type="checkbox" value="${escapeHtml(rank.id)}" ${filters.selectedRanks.includes(rank.id) ? 'checked' : ''} />
            ${escapeHtml(formatMonsterRankLabel(rank))}
          </label>`).join('')}
        </fieldset>
      </aside>

      <section class="panel monster-result-panel">
        <h2>筛选结果</h2>
        <div class="monster-summary-grid">
          <p>筛选战力：<strong data-active-monster-cp>${resolved.ok ? combatPower.toFixed(2) : '无'}</strong></p>
          <p>来源：<strong data-monster-source>${escapeHtml(sourceText)}</strong></p>
          <p>结果数：<strong>${monsters.length}</strong></p>
        </div>
        <p class="monster-message" data-monster-message>${escapeHtml(message)}</p>

        <h2>强度 CP 范围</h2>
        ${renderMonsterRankRanges(ranges)}
        ${renderMonsterDataScopeNote(filters)}

        <section class="monster-results" data-monster-results>
          <h2>怪物列表（${monsters.length}）</h2>
          ${renderMonsterResults(monsters)}
        </section>
      </section>
    </section>`;
  }

  function renderMonsterRankRanges(ranges) {
    if (!ranges) {
      return '<p class="empty-state">需要有效战力后才会显示范围。</p>';
    }

    return `<div class="monster-range-grid">
      ${app.MONSTER_RANKS.map((rank) => `<div class="monster-range-card">
        <strong>${escapeHtml(formatMonsterRankLabel(rank))}</strong>
        <span>${formatRange(ranges[rank.id])}</span>
      </div>`).join('')}
    </div>`;
  }

  function renderMonsterDataScopeNote(filters) {
    if (filters.dataScope !== 'all') {
      return '';
    }

    return '<p class="monster-data-scope-note" data-monster-data-scope-note>全部已知数据可能包含后期、版本未知或活动记录。</p>';
  }

  function renderMonsterResults(monsters) {
    if (monsters.length === 0) {
      return '<p class="empty-state">没有符合条件的怪物。</p>';
    }

    return `<div class="monster-table-wrap">
      <table class="monster-table">
        <thead>
          <tr>
            <th>中文名</th>
            <th>繁中名</th>
            <th>英文原名</th>
            <th>CP</th>
            <th>相对强度</th>
            <th>地点或来源</th>
          </tr>
        </thead>
        <tbody>
          ${monsters.map((monster) => `<tr>
            <td>${escapeHtml(monster.zhCNName || '')}</td>
            <td>${escapeHtml(monster.zhTWName || '')}</td>
            <td>${escapeHtml(monster.enName || '')}</td>
            <td>${Number(monster.combatPower).toFixed(0)}</td>
            <td data-monster-rank-label>${escapeHtml(formatMonsterRankLabel(monster.rank))}</td>
            <td>${escapeHtml(formatMonsterLocation(monster))}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  function formatRange(range) {
    const min = range.min.toFixed(2);

    if (range.maxExclusive === null) {
      return `CP >= ${min}`;
    }

    return `${min} <= CP < ${range.maxExclusive.toFixed(2)}`;
  }

  function formatMonsterLocation(monster) {
    const displayLocations =
      monster.zhCNLocations && monster.zhCNLocations.length > 0 ? monster.zhCNLocations : monster.locations || [];

    return displayLocations.length > 0 ? displayLocations.join('、') : '未知';
  }

  function formatMonsterRankLabel(rank) {
    return rank.label || rank.id;
  }

  function statLabel(key) {
    const field = STAT_FIELDS.find((item) => item.key === key);

    return field ? field.label : key;
  }

  function renderLearnedSkills(profile, highestId, secondId) {
    if (profile.skills.length === 0) {
      return '<p class="empty-state">尚未添加技能。</p>';
    }

    return profile.skills
      .map((entry) => {
        const skill = app.G13_SKILLS.find((item) => item.id === entry.skillId);

        if (!skill) {
          return `<div class="skill-row"><span>未知技能：${escapeHtml(entry.skillId)}</span><span>${escapeHtml(entry.rank)}</span><button data-remove-skill="${escapeHtml(entry.skillId)}">移除</button></div>`;
        }

        const rowClass = entry.skillId === highestId ? 'skill-row--top' : entry.skillId === secondId ? 'skill-row--second' : '';

        return `<div class="skill-row ${rowClass}">
          <span>${escapeHtml(skill.zhCNName)}</span>
          <select data-rank-for="${skill.id}">
            ${app.SKILL_RANKS.map((rank) => `<option value="${rank}" ${rank === entry.rank ? 'selected' : ''}>${rank}</option>`).join('')}
          </select>
          <span>${skill.combatPowerByRank[entry.rank]}</span>
          <button data-remove-skill="${skill.id}">移除</button>
        </div>`;
      })
      .join('');
  }

  function downloadJson(json) {
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = `mabinogi-combat-power-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
  }

  function captureFocus(root) {
    const active = document.activeElement;

    if (!active || !root.contains(active)) {
      return null;
    }

    const selector = focusSelector(active);

    if (!selector) {
      return null;
    }

    return {
      selector,
      start: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      end: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
    };
  }

  function restoreFocus(root, focusState) {
    if (!focusState) {
      return;
    }

    const next = root.querySelector(focusState.selector);

    if (!next) {
      return;
    }

    next.focus();

    if (typeof next.setSelectionRange === 'function' && focusState.start !== null && focusState.end !== null) {
      const length = next.value.length;
      next.setSelectionRange(Math.min(focusState.start, length), Math.min(focusState.end, length));
    }
  }

  function focusSelector(element) {
    if (element.dataset.tab) {
      return `[data-tab="${cssEscape(element.dataset.tab)}"]`;
    }

    if (element.dataset.field) {
      return `[data-field="${cssEscape(element.dataset.field)}"]`;
    }

    if (element.dataset.stat) {
      return `[data-stat="${cssEscape(element.dataset.stat)}"]`;
    }

    if (element.dataset.skillSearch !== undefined) {
      return '[data-skill-search]';
    }

    if (element.dataset.monsterManualCp !== undefined) {
      return '[data-monster-manual-cp]';
    }

    if (element.dataset.monsterNameQuery !== undefined) {
      return '[data-monster-name-query]';
    }

    if (element.dataset.monsterLocationQuery !== undefined) {
      return '[data-monster-location-query]';
    }

    if (element.dataset.monsterRank !== undefined) {
      return `[data-monster-rank][value="${cssEscape(element.value)}"]`;
    }

    if (element.dataset.monsterDataScope !== undefined) {
      return '[data-monster-data-scope]';
    }

    if (element.dataset.monsterIncludeUnknown !== undefined) {
      return '[data-monster-include-unknown]';
    }

    if (element.dataset.rankFor) {
      return `[data-rank-for="${cssEscape(element.dataset.rankFor)}"]`;
    }

    return null;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }

    return String(value).replace(/["\\]/g, '\\$&');
  }
})();
