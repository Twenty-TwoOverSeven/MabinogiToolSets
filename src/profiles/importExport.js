(function () {
  const app = (window.MabinogiCP = window.MabinogiCP || {});
  const SCHEMA_VERSION = 1;
  const RACES = ['人类', '精灵', '巨人'];
  const STAT_KEYS = ['life', 'mana', 'stamina', 'strength', 'intelligence', 'dexterity', 'will', 'luck'];

  app.exportProfiles = function exportProfiles(profiles) {
    return JSON.stringify(
      {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        profiles,
      },
      null,
      2,
    );
  };

  app.importProfiles = function importProfiles(json, options) {
    let data;

    try {
      data = JSON.parse(json);
    } catch {
      return { ok: false, error: 'JSON 格式无效' };
    }

    if (!isRecord(data)) {
      return { ok: false, error: '存档根对象无效' };
    }

    if (data.schemaVersion !== SCHEMA_VERSION) {
      return { ok: false, error: `不支持的存档版本：${String(data.schemaVersion)}` };
    }

    if (!Array.isArray(data.profiles)) {
      return { ok: false, error: '存档缺少角色列表' };
    }

    const unknownSkillIds = new Set();
    const imported = [];

    for (const value of data.profiles) {
      const parsed = parseProfile(value, options.knownSkillIds, unknownSkillIds);

      if (!parsed.ok) {
        return parsed;
      }

      imported.push(parsed.profile);
    }

    if (options.mode === 'replace') {
      return { ok: true, profiles: imported, unknownSkillIds: Array.from(unknownSkillIds) };
    }

    const merged = options.existingProfiles.slice();

    for (const profile of imported) {
      merged.push({
        ...profile,
        id: crypto.randomUUID(),
        name: nextAvailableName(profile.name, merged),
      });
    }

    return { ok: true, profiles: merged, unknownSkillIds: Array.from(unknownSkillIds) };
  };

  function parseProfile(value, knownSkillIds, unknownSkillIds) {
    if (!isRecord(value)) {
      return { ok: false, error: '角色档案结构无效' };
    }

    if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.title !== 'string') {
      return { ok: false, error: '角色基础信息无效' };
    }

    if (!RACES.includes(value.race)) {
      return { ok: false, error: `角色种族无效：${String(value.race)}` };
    }

    const stats = parseStats(value.stats);

    if (!stats.ok) {
      return stats;
    }

    if (!Array.isArray(value.skills)) {
      return { ok: false, error: '角色技能列表无效' };
    }

    const skills = [];

    for (const skill of value.skills) {
      if (!isRecord(skill) || typeof skill.skillId !== 'string' || !app.isSkillRank(skill.rank)) {
        return { ok: false, error: '角色技能条目无效' };
      }

      if (!knownSkillIds.has(skill.skillId)) {
        unknownSkillIds.add(skill.skillId);
      }

      skills.push({ skillId: skill.skillId, rank: skill.rank });
    }

    return {
      ok: true,
      profile: {
        id: value.id,
        name: value.name,
        race: value.race,
        title: value.title,
        stats: stats.value,
        skills,
      },
    };
  }

  function parseStats(value) {
    if (!isRecord(value)) {
      return { ok: false, error: '白值属性结构无效' };
    }

    const stats = {};

    for (const key of STAT_KEYS) {
      const statValue = value[key];

      if (typeof statValue !== 'number' || Number.isNaN(statValue) || statValue < 0) {
        return { ok: false, error: `白值属性无效：${key}` };
      }

      stats[key] = statValue;
    }

    return { ok: true, value: stats };
  }

  function nextAvailableName(name, profiles) {
    const existingNames = new Set(profiles.map((profile) => profile.name));

    if (!existingNames.has(name)) {
      return name;
    }

    let index = 2;

    while (existingNames.has(`${name} (${index})`)) {
      index += 1;
    }

    return `${name} (${index})`;
  }

  function isRecord(value) {
    return typeof value === 'object' && value !== null;
  }
})();
