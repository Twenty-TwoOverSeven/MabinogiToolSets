(function () {
  const app = (window.MabinogiCP = window.MabinogiCP || {});

  const MANUAL_COMBAT_POWER_ERROR = '手动战力必须是大于 0 的数字。';
  const PROFILE_COMBAT_POWER_ERROR = '当前角色战力必须大于 0，请完善角色数据或填写手动战力。';

  app.MONSTER_RANKS = [
    {
      id: 'weakest',
      label: 'Weakest',
      minRatio: 0,
      maxRatio: 0.8,
    },
    {
      id: 'weak',
      label: 'Weak',
      minRatio: 0.8,
      maxRatio: 1,
    },
    {
      id: 'normal',
      label: 'Normal',
      minRatio: 1,
      maxRatio: 1.4,
    },
    {
      id: 'strong',
      label: 'Strong',
      minRatio: 1.4,
      maxRatio: 2,
    },
    {
      id: 'awful',
      label: 'Awful',
      minRatio: 2,
      maxRatio: 3,
    },
    {
      id: 'boss',
      label: 'Boss',
      minRatio: 3,
      maxRatio: null,
    },
  ];

  app.DEFAULT_MONSTER_FILTERS = {
    combatPower: null,
    manualCombatPower: '',
    selectedRanks: app.MONSTER_RANKS.map((rank) => rank.id),
    nameQuery: '',
    locationQuery: '',
    dataScope: 'g13',
    includeUnknownIntroducedBy: false,
    translationStatus: 'all',
  };

  app.calculateMonsterRank = function calculateMonsterRank(monsterCombatPower, characterCombatPower) {
    const monsterValue = Number(monsterCombatPower);
    const characterValue = Number(characterCombatPower);

    if (!Number.isFinite(monsterValue) || monsterValue < 0 || !Number.isFinite(characterValue) || characterValue <= 0) {
      return null;
    }

    const ranges = app.calculateMonsterRankRanges(characterCombatPower);

    return app.MONSTER_RANKS.find((rank) => {
      const range = ranges[rank.id];

      return monsterValue >= range.min && (range.maxExclusive === null || monsterValue < range.maxExclusive);
    }) || null;
  };

  app.calculateMonsterRankRanges = function calculateMonsterRankRanges(characterCombatPower) {
    const characterValue = Number(characterCombatPower);

    return app.MONSTER_RANKS.reduce((ranges, rank) => {
      ranges[rank.id] = {
        min: characterValue * rank.minRatio,
        maxExclusive: rank.maxRatio === null ? null : characterValue * rank.maxRatio,
      };

      return ranges;
    }, {});
  };

  app.resolveMonsterFilterCombatPower = function resolveMonsterFilterCombatPower(profileCombatPower, manualCombatPower) {
    const manualText = String(manualCombatPower || '').trim();

    if (manualText !== '') {
      const manualValue = Number(manualText);

      if (!Number.isFinite(manualValue) || manualValue <= 0) {
        return {
          ok: false,
          error: MANUAL_COMBAT_POWER_ERROR,
        };
      }

      return {
        ok: true,
        source: 'manual',
        value: manualValue,
      };
    }

    const profileValue = Number(profileCombatPower);

    if (!Number.isFinite(profileValue) || profileValue <= 0) {
      return {
        ok: false,
        error: PROFILE_COMBAT_POWER_ERROR,
      };
    }

    return {
      ok: true,
      source: 'profile',
      value: profileValue,
    };
  };

  app.filterMonsters = function filterMonsters(monsters, filters) {
    const activeFilters = {
      ...app.DEFAULT_MONSTER_FILTERS,
      ...(filters || {}),
    };
    const selectedRanks =
      Array.isArray(activeFilters.selectedRanks) && activeFilters.selectedRanks.length > 0
        ? new Set(activeFilters.selectedRanks)
        : new Set();
    const nameQuery = normalizeSearchText(activeFilters.nameQuery);
    const locationQuery = normalizeSearchText(activeFilters.locationQuery);
    const translationStatus = activeFilters.translationStatus || 'all';

    return (monsters || [])
      .filter((monster) => isInDataScope(monster, activeFilters))
      .map((monster) => ({
        ...monster,
        rank: app.calculateMonsterRank(monster.combatPower, activeFilters.combatPower),
      }))
      .filter((monster) => monster.rank !== null)
      .filter((monster) => selectedRanks.has(monster.rank.id))
      .filter((monster) => translationStatus === 'all' || monster.translationStatus === translationStatus)
      .filter((monster) => matchesNameQuery(monster, nameQuery))
      .filter((monster) => matchesLocationQuery(monster, locationQuery))
      .sort((left, right) => {
        if (left.combatPower !== right.combatPower) {
          return left.combatPower - right.combatPower;
        }

        return String(left.enName || '').localeCompare(String(right.enName || ''));
      });
  };

  function isInDataScope(monster, filters) {
    if (filters.dataScope !== 'all' && monster.isEvent) {
      return false;
    }

    const generation = parseGeneration(monster.introducedBy);

    if (generation === null) {
      return Boolean(filters.includeUnknownIntroducedBy);
    }

    if (filters.dataScope === 'all') {
      return true;
    }

    return generation >= 1 && generation <= 13;
  }

  function parseGeneration(introducedBy) {
    const match = /^G(\d+)$/i.exec(String(introducedBy || '').trim());

    return match ? Number(match[1]) : null;
  }

  function matchesNameQuery(monster, query) {
    if (query === '') {
      return true;
    }

    return [monster.zhCNName, monster.zhTWName, monster.enName].some((value) => normalizeSearchText(value).includes(query));
  }

  function matchesLocationQuery(monster, query) {
    if (query === '') {
      return true;
    }

    return (monster.locations || []).some((location) => normalizeSearchText(location).includes(query));
  }

  function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase();
  }
})();
