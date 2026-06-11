(function () {
  const { G13_SKILLS, knownSkillIds, searchSkills, SKILL_RANKS } = window.MabinogiCP;
  const { expectEqual, test } = window.MabinogiCPTest;

  test('search finds mainland Simplified Chinese names', () => {
    const result = searchSkills('防御', G13_SKILLS, []);

    expectEqual(result[0].id, 'defense');
  });

  test('search finds Taiwan source names', () => {
    const result = searchSkills('防禦', G13_SKILLS, []);

    expectEqual(result[0].id, 'defense');
  });

  test('search excludes learned skills', () => {
    const result = searchSkills('防', G13_SKILLS, [{ skillId: 'defense', rank: 'F' }]);

    expectEqual(result.some((skill) => skill.id === 'defense'), false);
  });

  test('knownSkillIds exposes ids for import validation', () => {
    expectEqual(knownSkillIds(G13_SKILLS).has('defense'), true);
  });

  test('later skills are not included', () => {
    const hasLaterSkill = G13_SKILLS.some((skill) => ['dual_gun_mastery', 'shuriken_mastery', 'chain_blade_mastery'].includes(skill.id));

    expectEqual(hasLaterSkill, false);
  });

  test('all skills include every supported rank', () => {
    const complete = G13_SKILLS.every((skill) => SKILL_RANKS.every((rank) => typeof skill.combatPowerByRank[rank] === 'number'));

    expectEqual(complete, true);
  });
})();
