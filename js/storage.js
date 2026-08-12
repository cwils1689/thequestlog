/* storage.js — localStorage persistence for The Quest Log
   Single-user, single-device. Everything lives under one key. */

(function (global) {
  const STORAGE_KEY = 'questlog:v1';
  const SCHEMA_VERSION = 1;

  function defaultState() {
    return {
      version: SCHEMA_VERSION,
      sessions: [],   // { id, programIndex, dateISO, loggedAt }
      badges: {},     // { [badgeKey]: { earned: bool, date: 'YYYY-MM-DD' } }
      settings: {
        badgePinHash: null, // hex SHA-256(salt + ':' + pin), or null = no parent gate yet
        badgePinSalt: null, // hex random salt
      },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaultState();
      // Basic shape guard — merge onto defaults so missing fields don't crash the app.
      const state = Object.assign(defaultState(), parsed);
      if (!Array.isArray(state.sessions)) state.sessions = [];
      if (!state.badges || typeof state.badges !== 'object') state.badges = {};
      if (!state.settings || typeof state.settings !== 'object') state.settings = defaultState().settings;
      return state;
    } catch (e) {
      console.warn('Quest Log: could not read saved progress, starting fresh.', e);
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('Quest Log: could not save progress (storage full or blocked?).', e);
      return false;
    }
  }

  function exportState(state) {
    return JSON.stringify(state, null, 2);
  }

  function importState(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sessions)) {
      throw new Error('That file doesn\'t look like a Quest Log backup.');
    }
    const state = Object.assign(defaultState(), parsed);
    if (!state.badges || typeof state.badges !== 'object') state.badges = {};
    if (!state.settings || typeof state.settings !== 'object') state.settings = defaultState().settings;
    return state;
  }

  global.QuestStorage = { load, save, exportState, importState, STORAGE_KEY, defaultState };
})(window);
