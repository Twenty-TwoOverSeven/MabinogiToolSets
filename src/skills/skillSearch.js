(function () {
  const app = (window.MabinogiCP = window.MabinogiCP || {});

  app.searchSkills = function searchSkills(query, skills, learnedSkills) {
    const normalizedQuery = normalize(query);
    const learnedIds = new Set(learnedSkills.map((skill) => skill.skillId));

    if (!normalizedQuery) {
      return [];
    }

    return skills.filter((skill) => {
      if (learnedIds.has(skill.id)) {
        return false;
      }

      return normalize(skill.zhCNName).includes(normalizedQuery) || normalize(skill.twName).includes(normalizedQuery);
    });
  };

  app.knownSkillIds = function knownSkillIds(skills) {
    return new Set(skills.map((skill) => skill.id));
  };

  function normalize(value) {
    return String(value).trim().toLocaleLowerCase('zh-CN');
  }
})();
