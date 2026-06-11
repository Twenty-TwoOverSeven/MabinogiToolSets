(function () {
  const app = (window.MabinogiCP = window.MabinogiCP || {});

  app.createDefaultProfile = function createDefaultProfile(name = '新角色') {
    return {
      id: crypto.randomUUID(),
      name,
      race: '人类',
      title: '',
      stats: {
        life: 0,
        mana: 0,
        stamina: 0,
        strength: 0,
        intelligence: 0,
        dexterity: 0,
        will: 0,
        luck: 0,
      },
      skills: [],
    };
  };
})();
