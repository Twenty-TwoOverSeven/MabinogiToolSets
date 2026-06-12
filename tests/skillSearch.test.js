(function () {
  const { G13_SKILLS, knownSkillIds, searchSkills, SKILL_RANKS } = window.MabinogiCP;
  const { expectEqual, test } = window.MabinogiCPTest;

  test('search finds mainland Simplified Chinese names', () => {
    const result = searchSkills('防御', G13_SKILLS, []);

    expectEqual(result[0].id, 'defense');
  });

  test('search finds windmill by mainland name', () => {
    const result = searchSkills('风车', G13_SKILLS, []);

    expectEqual(result[0].id, 'windmill');
  });

  test('search finds official mainland basic magic names', () => {
    expectEqual(searchSkills('冰箭', G13_SKILLS, [])[0].id, 'icebolt');
    expectEqual(searchSkills('火箭', G13_SKILLS, [])[0].id, 'firebolt');
    expectEqual(searchSkills('雷箭', G13_SKILLS, [])[0].id, 'lightningbolt');
  });

  test('search finds official mainland combat action names', () => {
    expectEqual(searchSkills('践踏', G13_SKILLS, [])[0].id, 'stomp');
    expectEqual(searchSkills('跳斩', G13_SKILLS, [])[0].id, 'down_attack');
    expectEqual(searchSkills('冲撞', G13_SKILLS, [])[0].id, 'assault');
    expectEqual(searchSkills('无限斩', G13_SKILLS, [])[0].id, 'final_hit');
  });

  test('search finds verified official mainland skill names', () => {
    const expectedByName = {
      制作精通: 'making_mastery',
      治愈: 'first_aid',
      格斗精通: 'melee_combat_mastery',
      躲避: 'evasion',
      挑衅: 'taunt',
      风之壁障: 'wind_breaker',
      助攻箭: 'support_shot',
      远距离战术精通: 'ranged_combat_mastery',
      旋转箭: 'arrow_revolver',
      冰雹: 'hailstorm',
      魔法组合: 'bolt_composer',
      魔法精通: 'magic_mastery',
      治疗术: 'healing',
      旋风炮: 'wind_blast',
      电火花: 'spark',
      高温爆发: 'heat_buster',
      栅栏: 'protective_wall',
      风暴: 'frozen_blast',
    };

    Object.keys(expectedByName).forEach((name) => {
      expectEqual(searchSkills(name, G13_SKILLS, [])[0].id, expectedByName[name]);
    });
  });

  test('search finds Taiwan source names', () => {
    const result = searchSkills('防禦', G13_SKILLS, []);

    expectEqual(result[0].id, 'defense');
  });

  test('search finds windmill by Taiwan source name', () => {
    const result = searchSkills('旋風擺蓮腿', G13_SKILLS, []);

    expectEqual(result[0].id, 'windmill');
  });

  test('search excludes learned skills', () => {
    const result = searchSkills('防', G13_SKILLS, [{ skillId: 'defense', rank: 'F' }]);

    expectEqual(result.some((skill) => skill.id === 'defense'), false);
  });

  test('knownSkillIds exposes ids for import validation', () => {
    expectEqual(knownSkillIds(G13_SKILLS).has('defense'), true);
    expectEqual(knownSkillIds(G13_SKILLS).has('frozen_blast'), true);
  });

  test('later skills are not included', () => {
    const excludedIds = [
      'lance_mastery',
      'lance_counter',
      'lance_charge',
      'rage_impact',
      'bash',
      'urgent_shot',
      'moving_casting',
      'meteor_strike',
      'instant_casting',
      'dual_gun_mastery',
      'shuriken_mastery',
      'chain_blade_mastery',
    ];
    const hasLaterSkill = G13_SKILLS.some((skill) => excludedIds.includes(skill.id));

    expectEqual(hasLaterSkill, false);
  });

  test('G13 early skill table includes the selected full reference subset', () => {
    expectEqual(G13_SKILLS.length, 67);
  });

  test('all skills include every supported rank', () => {
    const complete = G13_SKILLS.every((skill) => SKILL_RANKS.every((rank) => typeof skill.combatPowerByRank[rank] === 'number'));

    expectEqual(complete, true);
  });
})();
