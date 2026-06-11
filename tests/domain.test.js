(function () {
  const { calculateCombatPower } = window.MabinogiCP;
  const { expectClose, expectEqual, test } = window.MabinogiCPTest;

  const skills = [
    {
      id: 'defense',
      zhCNName: '防御',
      twName: '防禦',
      category: '战斗',
      introducedBy: 'G1',
      combatPowerByRank: {
        练习: 0,
        F: 30,
        E: 60,
        D: 90,
        C: 120,
        B: 150,
        A: 180,
        9: 210,
        8: 230,
        7: 260,
        6: 290,
        5: 320,
        4: 350,
        3: 380,
        2: 390,
        1: 400,
      },
    },
    {
      id: 'smash',
      zhCNName: '重击',
      twName: '重擊',
      category: '战斗',
      introducedBy: 'G1',
      combatPowerByRank: {
        练习: 0,
        F: 5,
        E: 10,
        D: 30,
        C: 50,
        B: 70,
        A: 90,
        9: 110,
        8: 130,
        7: 150,
        6: 170,
        5: 200,
        4: 230,
        3: 260,
        2: 290,
        1: 320,
      },
    },
    {
      id: 'magnum_shot',
      zhCNName: '穿心箭',
      twName: '穿心箭',
      category: '远距离',
      introducedBy: 'G1',
      combatPowerByRank: {
        练习: 0,
        F: 5,
        E: 10,
        D: 30,
        C: 50,
        B: 70,
        A: 90,
        9: 110,
        8: 130,
        7: 150,
        6: 170,
        5: 200,
        4: 230,
        3: 260,
        2: 290,
        1: 320,
      },
    },
  ];

  function profile(overrides = {}) {
    return {
      id: 'char-1',
      name: '测试角色',
      race: '人类',
      title: '测试称号',
      stats: {
        life: 100,
        mana: 90,
        stamina: 60,
        strength: 50,
        intelligence: 40,
        dexterity: 30,
        will: 20,
        luck: 10,
      },
      skills: [],
      ...overrides,
    };
  }

  test('no skills uses base stats only', () => {
    const result = calculateCombatPower(profile(), skills);

    expectEqual(result.highestSkill, null);
    expectEqual(result.secondHighestSkill, null);
    expectClose(result.baseStatContribution, 149.5);
    expectClose(result.total, 149.5);
  });

  test('one skill uses highest and zero second skill', () => {
    const result = calculateCombatPower(profile({ skills: [{ skillId: 'defense', rank: '1' }] }), skills);

    expectEqual(result.highestSkill.skillId, 'defense');
    expectEqual(result.secondHighestSkill, null);
    expectClose(result.skillContribution, 400);
    expectClose(result.total, 549.5);
  });

  test('two skills add half of second skill', () => {
    const result = calculateCombatPower(
      profile({
        skills: [
          { skillId: 'defense', rank: '1' },
          { skillId: 'smash', rank: '1' },
        ],
      }),
      skills,
    );

    expectEqual(result.highestSkill.skillId, 'defense');
    expectEqual(result.secondHighestSkill.skillId, 'smash');
    expectClose(result.skillContribution, 560);
    expectClose(result.total, 709.5);
  });

  test('tied skills keep stable learned order', () => {
    const result = calculateCombatPower(
      profile({
        skills: [
          { skillId: 'smash', rank: '1' },
          { skillId: 'magnum_shot', rank: '1' },
        ],
      }),
      skills,
    );

    expectEqual(result.highestSkill.skillId, 'smash');
    expectEqual(result.secondHighestSkill.skillId, 'magnum_shot');
  });
})();
