(function () {
  const app = (window.MabinogiCP = window.MabinogiCP || {});

  app.SKILL_RANKS = ['练习', 'F', 'E', 'D', 'C', 'B', 'A', '9', '8', '7', '6', '5', '4', '3', '2', '1'];

  app.isSkillRank = function isSkillRank(value) {
    return app.SKILL_RANKS.includes(value);
  };
})();
