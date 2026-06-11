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

    function setState(next) {
      state = ensureStateHasProfile(next);
      app.saveState(localStorage, state);
      draw();
    }

    function draw() {
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

          <section class="panel">
            <h2>角色档案</h2>
            <label>选择角色
              <select data-profile-select>
                ${state.profiles.map((item) => `<option value="${item.id}" ${item.id === state.activeProfileId ? 'selected' : ''}>${escapeHtml(item.name || '未命名角色')}</option>`).join('')}
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

          <section class="panel result-panel">
            <h2>计算结果</h2>
            <p>总战斗力：${result.total.toFixed(2)}</p>
            <p>最高技能：${result.highestSkill ? `${escapeHtml(result.highestSkill.name)} ${result.highestSkill.combatPower}` : '无'}</p>
            <p>次高技能：${result.secondHighestSkill ? `${escapeHtml(result.secondHighestSkill.name)} ${result.secondHighestSkill.combatPower}` : '无'}</p>
            <p>技能贡献：${result.skillContribution.toFixed(2)}</p>
            <p>白值贡献：${result.baseStatContribution.toFixed(2)}</p>
            <ul>${result.statContributions.map((item) => `<li>${item.label}: ${item.contribution.toFixed(2)}</li>`).join('')}</ul>
          </section>
        </main>
      `;

      bindEvents();
    }

    function bindEvents() {
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
          setState(app.updateActiveProfile(state, (profile) => ({ ...profile, [key]: input.value })));
        });
      });

      root.querySelectorAll('[data-stat]').forEach((input) => {
        input.addEventListener('input', () => {
          const key = input.dataset.stat;
          const value = Math.max(0, Number(input.value || 0));
          importMessage = '';
          setState(app.updateActiveProfile(state, (profile) => ({ ...profile, stats: { ...profile.stats, [key]: value } })));
        });
      });

      root.querySelector('[data-skill-search]').addEventListener('input', (event) => {
        skillQuery = event.target.value;
        draw();
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

  function renderStatInput(field, profile, result) {
    const contribution = result.statContributions.find((item) => item.key === field.key);

    return `<label>${field.label}
      <input type="number" min="0" data-stat="${field.key}" value="${profile.stats[field.key]}" />
      <span class="field-help">贡献：${contribution.contribution.toFixed(2)}</span>
    </label>`;
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
})();
