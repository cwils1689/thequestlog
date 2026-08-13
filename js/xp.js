/* xp.js — program mapping, XP, and rank math.
   Pure functions only — no DOM, no storage. Keeps quest-data.json as the
   single source of truth for exercises, ranks, and XP rule numbers. */

(function (global) {
  const TOTAL_SESSIONS = 36; // 12 weeks x 3 sessions
  const DAY_LETTERS = ['A', 'B', 'C'];

  /** 0-based program index -> { week (1-12), day ('A'|'B'|'C') } */
  function slotForIndex(index) {
    const clamped = Math.max(0, Math.min(TOTAL_SESSIONS - 1, index));
    const week = Math.floor(clamped / 3) + 1;
    const day = DAY_LETTERS[clamped % 3];
    return { week, day };
  }

  /** week (1-12) -> phase object from questData.phases */
  function phaseForWeek(questData, week) {
    return questData.phases.find((p) => {
      const [lo, hi] = p.weeks.split('-').map(Number);
      return week >= lo && week <= hi;
    });
  }

  function exercisesFor(questData, week, day) {
    const phase = phaseForWeek(questData, week);
    if (!phase) return { phase: null, exercises: [] };
    return { phase, exercises: phase.days[day] || [] };
  }

  /** Monday (00:00 local) of the week containing the given ISO date, as YYYY-MM-DD key. */
  function calendarWeekKey(dateISO) {
    const d = new Date(dateISO);
    const day = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  }

  /** Local calendar date (not UTC — toISOString() can shift near midnight) as a YYYY-MM-DD key. */
  function calendarDayKey(dateISO) {
    const d = new Date(dateISO);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Current and best "full attendance" streaks, in consecutive calendar
   * weeks — a week counts if it earned the weekly bonus (all 3 sessions).
   * Always returns both: "current" alone would read as a failure state the
   * moment a week is missed, which this app deliberately never does — best
   * stays as a permanent high-water mark next to whatever current is.
   */
  function computeStreaks(weeklyBonusWeekKeys) {
    if (weeklyBonusWeekKeys.size === 0) return { current: 0, best: 0 };

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const sortedKeys = Array.from(weeklyBonusWeekKeys).sort();

    let best = 0;
    let run = 0;
    let prevTime = null;
    sortedKeys.forEach((key) => {
      const t = new Date(key).getTime();
      run = prevTime !== null && t - prevTime === WEEK_MS ? run + 1 : 1;
      best = Math.max(best, run);
      prevTime = t;
    });

    // Walk backward from this calendar week. If this week hasn't earned the
    // bonus yet (the common case — it's still in progress), start from last
    // week instead, so an in-progress week never looks like a broken streak.
    const thisWeekKey = calendarWeekKey(new Date().toISOString());
    let cursor = new Date(thisWeekKey);
    if (!weeklyBonusWeekKeys.has(thisWeekKey)) cursor = new Date(cursor.getTime() - WEEK_MS);

    let current = 0;
    while (weeklyBonusWeekKeys.has(cursor.toISOString().slice(0, 10))) {
      current += 1;
      cursor = new Date(cursor.getTime() - WEEK_MS);
    }

    return { current, best };
  }

  /**
   * Recompute all derived XP/rank state from scratch every time — this keeps
   * edits/deletes in History always consistent instead of tracking bonus
   * state incrementally.
   */
  function computeDerived(state, questData) {
    const xpPerSession = questData.xp_rules.xp_per_completed_session;
    const weeklyBonus = questData.xp_rules.weekly_full_attendance_bonus;
    const badgeBonus = questData.xp_rules.badge_bonus_xp;

    const sessions = state.sessions
      .slice()
      .sort((a, b) => (a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : a.loggedAt - b.loggedAt));

    // Group by calendar week to find the 3rd chronological session in each week.
    const byWeek = new Map();
    sessions.forEach((s) => {
      const key = calendarWeekKey(s.dateISO);
      if (!byWeek.has(key)) byWeek.set(key, []);
      byWeek.get(key).push(s);
    });

    const weeklyBonusSessionIds = new Set();
    const weeklyBonusWeekKeys = new Set();
    byWeek.forEach((group, key) => {
      if (group.length >= 3) {
        weeklyBonusSessionIds.add(group[2].id); // 3rd session that calendar week
        weeklyBonusWeekKeys.add(key);
      }
    });

    let sessionXP = 0;
    const sessionsWithXP = sessions.map((s) => {
      const bonus = weeklyBonusSessionIds.has(s.id) ? weeklyBonus : 0;
      sessionXP += xpPerSession + bonus;
      return Object.assign({}, s, { baseXP: xpPerSession, weeklyBonusXP: bonus });
    });

    const earnedBadges = Object.keys(state.badges).filter((k) => state.badges[k] && state.badges[k].earned);
    const badgeXP = earnedBadges.length * badgeBonus;

    const sideQuests = state.sideQuests || {};
    const sideQuestDefs = questData.side_quests || [];
    const earnedSideQuests = Object.keys(sideQuests).filter((k) => sideQuests[k] && sideQuests[k].earned);
    const sideQuestXP = earnedSideQuests.reduce((sum, key) => {
      const def = sideQuestDefs.find((sq) => sq.key === key);
      return sum + (def ? def.xp_reward : 0);
    }, 0);

    const totalXP = sessionXP + badgeXP + sideQuestXP;

    const ranks = questData.ranks.slice().sort((a, b) => a.xp_required - b.xp_required);
    let currentRank = ranks[0];
    let nextRank = null;
    for (let i = 0; i < ranks.length; i++) {
      if (totalXP >= ranks[i].xp_required) {
        currentRank = ranks[i];
        nextRank = ranks[i + 1] || null;
      }
    }
    let progressFraction = 1;
    if (nextRank) {
      const span = nextRank.xp_required - currentRank.xp_required;
      progressFraction = span > 0 ? (totalXP - currentRank.xp_required) / span : 1;
    }

    const completedIndexes = new Map(); // programIndex -> count of times logged
    sessions.forEach((s) => {
      completedIndexes.set(s.programIndex, (completedIndexes.get(s.programIndex) || 0) + 1);
    });

    let maxIndex = -1;
    sessions.forEach((s) => { if (s.programIndex > maxIndex) maxIndex = s.programIndex; });
    const nextProgramIndex = Math.min(TOTAL_SESSIONS - 1, maxIndex + 1);
    const programComplete = maxIndex >= TOTAL_SESSIONS - 1;

    const todayKey = calendarDayKey(new Date().toISOString());
    const loggedToday = sessions.some((s) => calendarDayKey(s.dateISO) === todayKey);

    const streaks = computeStreaks(weeklyBonusWeekKeys);

    return {
      loggedToday,
      currentStreak: streaks.current,
      bestStreak: streaks.best,
      sessionsWithXP,
      totalXP,
      sessionXP,
      badgeXP,
      earnedBadges,
      sideQuestXP,
      earnedSideQuests,
      currentRank,
      nextRank,
      progressFraction: Math.max(0, Math.min(1, progressFraction)),
      completedIndexes,
      completedCount: completedIndexes.size,
      weeklyBonusWeekKeys,
      nextProgramIndex,
      programComplete,
    };
  }

  global.QuestXP = {
    TOTAL_SESSIONS,
    DAY_LETTERS,
    slotForIndex,
    phaseForWeek,
    exercisesFor,
    calendarWeekKey,
    calendarDayKey,
    computeDerived,
  };
})(window);
