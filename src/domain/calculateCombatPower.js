(function () {
  const app = (window.MabinogiCP = window.MabinogiCP || {});

  const STAT_MULTIPLIERS = [
    { key: 'life', label: '生命力', multiplier: 1 },
    { key: 'mana', label: '魔法值', multiplier: 0.5 },
    { key: 'stamina', label: '体力值', multiplier: 0.5 },
    { key: 'strength', label: '力量', multiplier: 1 },
    { key: 'intelligence', label: '智力', multiplier: 0.2 },
    { key: 'dexterity', label: '敏捷', multiplier: 0.1 },
    { key: 'will', label: '意志', multiplier: 0.5 },
    { key: 'luck', label: '幸运', multiplier: 0.1 },
  ];

  app.calculateCombatPower = function calculateCombatPower(profile, skillRecords) {
    const skillsById = new Map(skillRecords.map((skill) => [skill.id, skill]));
    const rankedSkills = profile.skills
      .map((entry, learnedIndex) => {
        const skill = skillsById.get(entry.skillId);

        if (!skill) {
          return null;
        }

        return {
          skillId: skill.id,
          name: skill.zhCNName,
          rank: entry.rank,
          combatPower: skill.combatPowerByRank[entry.rank],
          learnedIndex,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.combatPower - left.combatPower || left.learnedIndex - right.learnedIndex);

    const highestSkill = rankedSkills[0] || null;
    const secondHighestSkill = rankedSkills[1] || null;
    const skillContribution = (highestSkill ? highestSkill.combatPower : 0) + (secondHighestSkill ? secondHighestSkill.combatPower : 0) * 0.5;
    const statContributions = app.calculateStatContributions(profile.stats);
    const baseStatContribution = statContributions.reduce((sum, item) => sum + item.contribution, 0);

    return {
      total: skillContribution + baseStatContribution,
      highestSkill,
      secondHighestSkill,
      skillContribution,
      baseStatContribution,
      statContributions,
      rankedSkills,
    };
  };

  app.calculateStatContributions = function calculateStatContributions(stats) {
    return STAT_MULTIPLIERS.map(({ key, label, multiplier }) => {
      const value = Number(stats[key] || 0);

      return {
        key,
        label,
        value,
        multiplier,
        contribution: value * multiplier,
      };
    });
  };
})();
