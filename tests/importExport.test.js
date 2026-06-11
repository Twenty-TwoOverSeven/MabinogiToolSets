(function () {
  const { exportProfiles, importProfiles } = window.MabinogiCP;
  const { expectEqual, test } = window.MabinogiCPTest;

  const profile = {
    id: 'char-1',
    name: '主号',
    race: '人类',
    title: '猛者',
    stats: {
      life: 100,
      mana: 90,
      stamina: 80,
      strength: 70,
      intelligence: 60,
      dexterity: 50,
      will: 40,
      luck: 30,
    },
    skills: [{ skillId: 'defense', rank: '1' }],
  };

  test('profiles round trip through JSON', () => {
    const json = exportProfiles([profile]);
    const result = importProfiles(json, { knownSkillIds: new Set(['defense']), existingProfiles: [], mode: 'replace' });

    expectEqual(result.ok, true);
    expectEqual(result.profiles[0].name, '主号');
    expectEqual(result.profiles[0].skills[0].rank, '1');
  });

  test('unsupported schema is rejected', () => {
    const result = importProfiles(JSON.stringify({ schemaVersion: 999, profiles: [] }), {
      knownSkillIds: new Set(),
      existingProfiles: [],
      mode: 'replace',
    });

    expectEqual(result.ok, false);
    expectEqual(result.error, '不支持的存档版本：999');
  });

  test('duplicate names are suffixed during merge', () => {
    const json = exportProfiles([profile]);
    const result = importProfiles(json, { knownSkillIds: new Set(['defense']), existingProfiles: [profile], mode: 'merge' });

    expectEqual(result.ok, true);
    expectEqual(result.profiles[1].name, '主号 (2)');
  });

  test('unknown skill ids are reported but preserved', () => {
    const json = exportProfiles([{ ...profile, skills: [{ skillId: 'unknown_skill', rank: 'F' }] }]);
    const result = importProfiles(json, { knownSkillIds: new Set(['defense']), existingProfiles: [], mode: 'replace' });

    expectEqual(result.ok, true);
    expectEqual(result.unknownSkillIds[0], 'unknown_skill');
    expectEqual(result.profiles[0].skills[0].skillId, 'unknown_skill');
  });

  test('non-finite stat values are rejected', () => {
    const json = '{"schemaVersion":1,"exportedAt":"2026-06-11T00:00:00.000Z","profiles":[{"id":"char-1","name":"主号","race":"人类","title":"猛者","stats":{"life":1e999,"mana":90,"stamina":80,"strength":70,"intelligence":60,"dexterity":50,"will":40,"luck":30},"skills":[]}]}';
    const result = importProfiles(json, { knownSkillIds: new Set(['defense']), existingProfiles: [], mode: 'replace' });

    expectEqual(result.ok, false);
    expectEqual(result.error, '白值属性无效：life');
  });

  test('invalid import mode is rejected', () => {
    const json = exportProfiles([profile]);
    const result = importProfiles(json, { knownSkillIds: new Set(['defense']), existingProfiles: [], mode: 'append' });

    expectEqual(result.ok, false);
    expectEqual(result.error, '导入模式无效：append');
  });

  test('export rejects non-finite stat values', () => {
    let message = '';

    try {
      exportProfiles([{ ...profile, stats: { ...profile.stats, life: Infinity } }]);
    } catch (error) {
      message = error.message;
    }

    expectEqual(message, '白值属性无效：life');
  });

  test('duplicate skill ids are rejected during import', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-06-11T00:00:00.000Z',
      profiles: [{ ...profile, skills: [{ skillId: 'defense', rank: 'F' }, { skillId: 'defense', rank: '1' }] }],
    });
    const result = importProfiles(json, { knownSkillIds: new Set(['defense']), existingProfiles: [], mode: 'replace' });

    expectEqual(result.ok, false);
    expectEqual(result.error, '角色技能重复：defense');
  });

  test('unsafe profile ids are rejected during import', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-06-11T00:00:00.000Z',
      profiles: [{ ...profile, id: 'x" onclick="alert(1)' }],
    });
    const result = importProfiles(json, { knownSkillIds: new Set(['defense']), existingProfiles: [], mode: 'replace' });

    expectEqual(result.ok, false);
    expectEqual(result.error, '角色 ID 无效');
  });
})();
