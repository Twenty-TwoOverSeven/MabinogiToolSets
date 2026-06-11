(function () {
  const app = (window.MabinogiCP = window.MabinogiCP || {});
  const STORAGE_KEY = 'mabinogi-combat-power-state';

  app.createAppState = function createAppState(profiles = [app.createDefaultProfile()]) {
    return {
      profiles,
      activeProfileId: profiles[0].id,
    };
  };

  app.activeProfile = function activeProfile(state) {
    const profile = state.profiles.find((item) => item.id === state.activeProfileId);

    if (!profile) {
      throw new Error('当前角色档案不存在');
    }

    return profile;
  };

  app.updateActiveProfile = function updateActiveProfile(state, update) {
    return {
      ...state,
      profiles: state.profiles.map((profile) => (profile.id === state.activeProfileId ? update(profile) : profile)),
    };
  };

  app.addProfile = function addProfile(state, profile) {
    return {
      profiles: [...state.profiles, profile],
      activeProfileId: profile.id,
    };
  };

  app.selectProfile = function selectProfile(state, profileId) {
    if (!state.profiles.some((profile) => profile.id === profileId)) {
      return state;
    }

    return {
      ...state,
      activeProfileId: profileId,
    };
  };

  app.deleteProfile = function deleteProfile(state, profileId) {
    if (state.profiles.length === 1) {
      return state;
    }

    const profiles = state.profiles.filter((profile) => profile.id !== profileId);

    return {
      profiles,
      activeProfileId: state.activeProfileId === profileId ? profiles[0].id : state.activeProfileId,
    };
  };

  app.saveState = function saveState(storage, state) {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  app.loadState = function loadState(storage) {
    const value = storage.getItem(STORAGE_KEY);

    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value);

      if (!Array.isArray(parsed.profiles) || typeof parsed.activeProfileId !== 'string' || parsed.profiles.length === 0) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  };
})();
