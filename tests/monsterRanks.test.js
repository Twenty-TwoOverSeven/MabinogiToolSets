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
