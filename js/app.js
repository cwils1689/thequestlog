/* app.js — main controller: rendering, event wiring, state transitions.
   Depends on QuestStorage (storage.js), QuestXP (xp.js), QuestConfetti (confetti.js). */

(function () {
  'use strict';

  let questData = null;
  let state = null;
  let derived = null;
  let selectedProgramIndex = 0; // transient UI selection on the Today screen
  let confirmCallback = null;

  const $ = (id) => document.getElementById(id);

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  async function boot() {
    try {
      const res = await fetch('quest-data.json', { cache: 'no-store' });
      questData = await res.json();
    } catch (e) {
      console.error('Quest Log: failed to load quest-data.json', e);
      document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">Couldn\'t load quest data. Try reloading.</p>';
      return;
    }

    state = QuestStorage.load();
    recompute();
    selectedProgramIndex = derived.nextProgramIndex;

    wireNav();
    wireToday();
    wireRank();
    wireBadges();
    wireHistory();
    wireSettings();
    wireModals();

    renderAll();
    registerServiceWorker();
  }

  function recompute() {
    derived = QuestXP.computeDerived(state, questData);
  }

  function persist() {
    QuestStorage.save(state);
  }

  function renderAll() {
    renderHeader();
    renderToday();
    renderRank();
    renderBadges();
    renderBoard();
    renderHistory();
  }

  /* ---------------------------------------------------------------------
     Navigation
     --------------------------------------------------------------------- */
  function wireNav() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => showView(btn.dataset.nav));
    });
  }

  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === name));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.nav === name));
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ---------------------------------------------------------------------
     Header HUD
     --------------------------------------------------------------------- */
  function renderHeader() {
    $('headerRankName').textContent = derived.currentRank.name;
    $('headerXpTotal').textContent = derived.totalXP + ' XP';
  }

  /* ---------------------------------------------------------------------
     Today
     --------------------------------------------------------------------- */
  function wireToday() {
    $('dayPrevBtn').addEventListener('click', () => {
      selectedProgramIndex = Math.max(0, selectedProgramIndex - 1);
      renderToday();
    });
    $('dayNextBtn').addEventListener('click', () => {
      selectedProgramIndex = Math.min(QuestXP.TOTAL_SESSIONS - 1, selectedProgramIndex + 1);
      renderToday();
    });
    $('jumpToNextBtn').addEventListener('click', () => {
      selectedProgramIndex = derived.nextProgramIndex;
      renderToday();
    });
    $('completeSessionBtn').addEventListener('click', completeSession);
    $('focusViewBtn').addEventListener('click', openFocusView);

    document.querySelector('.today-picker-label').addEventListener('click', openDaySelectModal);
    $('daySelectCancel').addEventListener('click', closeModal);
    $('daySelectConfirm').addEventListener('click', () => {
      const week = Number($('selectWeek').value);
      const day = $('selectDay').value;
      selectedProgramIndex = (week - 1) * 3 + QuestXP.DAY_LETTERS.indexOf(day);
      closeModal();
      renderToday();
    });
  }

  function openDaySelectModal() {
    populateWeekSelect($('selectWeek'));
    const slot = QuestXP.slotForIndex(selectedProgramIndex);
    $('selectWeek').value = String(slot.week);
    $('selectDay').value = slot.day;
    openModal('modalDaySelect');
  }

  function renderToday() {
    const slot = QuestXP.slotForIndex(selectedProgramIndex);
    const { phase, exercises } = QuestXP.exercisesFor(questData, slot.week, slot.day);
    const meta = questData.days_meta[slot.day];

    $('pickerPhase').textContent = phase ? `Phase ${phase.id} · ${phase.name}` : '';
    $('pickerWeekDay').textContent = `Week ${slot.week} — ${meta.label}`;
    $('dayPrevBtn').disabled = selectedProgramIndex === 0;
    $('dayNextBtn').disabled = selectedProgramIndex === QuestXP.TOTAL_SESSIONS - 1;

    const focusCard = $('todayFocusCard');
    focusCard.dataset.day = slot.day;
    $('dayFocusChip').textContent = `${meta.label} · ${meta.focus}`;
    $('dayRoundsNote').textContent = roundsText(phase, slot.week);

    renderExerciseList($('warmupList'), questData.warmup, false);
    renderExerciseList($('exerciseList'), exercises, true);
    renderExerciseList($('cooldownList'), questData.cooldown, false);

    const alreadyDone = derived.completedIndexes.has(selectedProgramIndex);
    const label = alreadyDone ? 'Log another go at this quest!' : 'Session complete!';
    $('completeSessionBtn').querySelector('.btn-huge-label').textContent = label;
    const willGetWeeklyBonus = wouldTriggerWeeklyBonus();
    $('completeSessionSub').textContent = willGetWeeklyBonus
      ? `+${questData.xp_rules.xp_per_completed_session} XP + ${questData.xp_rules.weekly_full_attendance_bonus} XP weekly bonus!`
      : `+${questData.xp_rules.xp_per_completed_session} XP`;
  }

  function roundsText(phase, week) {
    if (!phase || !phase.rounds_note) return '';
    if (phase.id === 1) {
      return week <= 2 ? '2 rounds through the list today' : '3 rounds through the list today';
    }
    return phase.rounds_note;
  }

  function renderExerciseList(ul, items, showSlot) {
    ul.innerHTML = '';
    items.forEach((it) => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      if (showSlot && it.slot) {
        const slotEl = document.createElement('span');
        slotEl.className = 'exercise-slot';
        slotEl.textContent = it.slot;
        left.appendChild(slotEl);
      }
      const nameEl = document.createElement('span');
      nameEl.className = 'exercise-name';
      nameEl.textContent = it.exercise || it.name;
      if (it.is_new) {
        const badge = document.createElement('span');
        badge.className = 'new-badge';
        badge.textContent = 'NEW';
        nameEl.appendChild(badge);
      }
      left.appendChild(nameEl);
      const reps = document.createElement('span');
      reps.className = 'exercise-reps';
      reps.textContent = it.reps || it.dose || '';
      li.appendChild(left);
      li.appendChild(reps);
      ul.appendChild(li);
    });
  }

  function wouldTriggerWeeklyBonus() {
    const todayISO = new Date().toISOString();
    const key = QuestXP.calendarWeekKey(todayISO);
    const countThisWeek = state.sessions.filter((s) => QuestXP.calendarWeekKey(s.dateISO) === key).length;
    return countThisWeek === 2; // this session would be the 3rd
  }

  function completeSession() {
    const session = {
      id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      programIndex: selectedProgramIndex,
      dateISO: new Date().toISOString(),
      loggedAt: Date.now(),
    };
    const prevRank = derived.currentRank.name;
    state.sessions.push(session);
    persist();
    recompute();

    const justLogged = derived.sessionsWithXP.find((s) => s.id === session.id);
    const gained = justLogged.baseXP + justLogged.weeklyBonusXP;
    showToast(justLogged.weeklyBonusXP > 0
      ? `+${gained} XP — session + weekly bonus! 🎉`
      : `+${gained} XP — nice work! 🎉`);
    QuestConfetti.burst({ count: 90 });

    selectedProgramIndex = derived.nextProgramIndex;
    renderAll();

    if (derived.currentRank.name !== prevRank) {
      setTimeout(() => showRankUp(derived.currentRank.name), 700);
    }
    if (derived.programComplete) {
      setTimeout(() => showToast('🏆 All 36 quests complete — Master run finished!'), derived.currentRank.name !== prevRank ? 1600 : 700);
    }
  }

  function openFocusView() {
    const slot = QuestXP.slotForIndex(selectedProgramIndex);
    const { exercises } = QuestXP.exercisesFor(questData, slot.week, slot.day);
    const meta = questData.days_meta[slot.day];
    $('focusTitle').textContent = `${meta.label} — Week ${slot.week}`;
    renderExerciseList($('focusExerciseList'), exercises, true);
    openModal('modalFocus');
  }

  /* ---------------------------------------------------------------------
     XP & Rank
     --------------------------------------------------------------------- */
  function wireRank() {}

  function renderRank() {
    $('rankHeroName').textContent = derived.currentRank.name;
    $('rankHeroXp').textContent = derived.totalXP;

    const pct = Math.round(derived.progressFraction * 100);
    $('meterFill').style.width = pct + '%';
    $('meterTrack').setAttribute('aria-valuenow', String(pct));
    $('meterCurrentLabel').textContent = derived.currentRank.name;
    if (derived.nextRank) {
      $('meterNextLabel').textContent = `${derived.nextRank.name} · ${derived.nextRank.xp_required} XP`;
      const remaining = derived.nextRank.xp_required - derived.totalXP;
      $('meterCaption').textContent = `${remaining} XP to go — keep climbing!`;
    } else {
      $('meterNextLabel').textContent = 'Max rank!';
      $('meterCaption').textContent = 'You reached the top of the ladder. Legendary. 🏔️';
    }

    const ladder = $('rankLadder');
    ladder.innerHTML = '';
    questData.ranks.forEach((r) => {
      const li = document.createElement('li');
      const achieved = derived.totalXP >= r.xp_required;
      const isCurrent = r.name === derived.currentRank.name;
      li.className = isCurrent ? 'current' : (achieved ? 'achieved' : '');
      const name = document.createElement('span');
      name.className = 'rank-ladder-name';
      name.textContent = (achieved ? '⭐ ' : '') + r.name;
      const xp = document.createElement('span');
      xp.className = 'rank-ladder-xp';
      xp.textContent = r.xp_required + ' XP';
      li.appendChild(name);
      li.appendChild(xp);
      ladder.appendChild(li);
    });
  }

  function showRankUp(name) {
    $('rankupName').textContent = name;
    $('rankupBanner').hidden = false;
    QuestConfetti.burst({ count: 140, spread: 1.3 });
  }

  /* ---------------------------------------------------------------------
     Badges
     --------------------------------------------------------------------- */
  let activeBadgeKey = null;

  function wireBadges() {
    $('modalBadgeClose').addEventListener('click', closeModal);
    $('modalBadgeEarn').addEventListener('click', earnActiveBadge);
  }

  function renderBadges() {
    const grid = $('badgeGrid');
    grid.innerHTML = '';
    questData.badges.forEach((b) => {
      const earned = !!(state.badges[b.key] && state.badges[b.key].earned);
      const tile = document.createElement('button');
      tile.className = 'badge-tile' + (earned ? '' : ' locked');
      tile.innerHTML = `
        <img src="${b.icon}" alt="${earned ? b.name : 'Locked badge'}" />
        <div class="badge-name">${b.name}</div>
        ${earned ? '<div class="badge-status">Earned!</div>' : ''}
      `;
      tile.addEventListener('click', () => openBadgeModal(b.key));
      grid.appendChild(tile);
    });
  }

  function openBadgeModal(key) {
    activeBadgeKey = key;
    const b = questData.badges.find((x) => x.key === key);
    const earned = state.badges[key] && state.badges[key].earned;
    $('modalBadgeImg').src = b.icon;
    $('modalBadgeImg').alt = b.name;
    $('modalBadgeName').textContent = b.name;
    $('modalBadgeCriteria').textContent = b.criteria;
    if (earned) {
      $('modalBadgeStatus').textContent = `Earned ${state.badges[key].date}`;
      $('modalBadgeEarn').hidden = true;
    } else {
      $('modalBadgeStatus').textContent = `Worth +${questData.xp_rules.badge_bonus_xp} XP`;
      $('modalBadgeEarn').hidden = false;
    }
    openModal('modalBadge');
  }

  function earnActiveBadge() {
    if (!activeBadgeKey) return;
    const prevRank = derived.currentRank.name;
    const today = new Date().toISOString().slice(0, 10);
    state.badges[activeBadgeKey] = { earned: true, date: today };
    persist();
    recompute();
    closeModal();
    showToast(`Badge earned! +${questData.xp_rules.badge_bonus_xp} XP 🎖️`);
    QuestConfetti.burst({ count: 110 });
    renderAll();
    if (derived.currentRank.name !== prevRank) {
      setTimeout(() => showRankUp(derived.currentRank.name), 700);
    }
  }

  /* ---------------------------------------------------------------------
     Quest Board
     --------------------------------------------------------------------- */
  function renderBoard() {
    $('boardCompletedCount').textContent = derived.completedCount;
    const trail = $('questTrail');
    trail.innerHTML = '';
    for (let i = 0; i < QuestXP.TOTAL_SESSIONS; i++) {
      const slot = QuestXP.slotForIndex(i);
      const done = derived.completedIndexes.has(i);
      const isNext = i === derived.nextProgramIndex && !derived.programComplete;
      const isWeeklyMarker = (i + 1) % 3 === 0;
      const isFinish = i === QuestXP.TOTAL_SESSIONS - 1;

      const stop = document.createElement('div');
      stop.className = `quest-stop day-${slot.day}` + (done ? ' done' : '') + (isNext ? ' next' : '') + (isFinish ? ' finish' : '');
      stop.title = `Week ${slot.week} · Day ${slot.day}${done ? ' — done' : ''}`;
      stop.innerHTML = `<span>${i + 1}</span>${isWeeklyMarker ? '<span class="stop-star">★</span>' : ''}`;
      trail.appendChild(stop);
    }
  }

  /* ---------------------------------------------------------------------
     History
     --------------------------------------------------------------------- */
  let activeEditId = null;

  function wireHistory() {
    $('undoLastBtn').addEventListener('click', () => {
      if (!state.sessions.length) return;
      openConfirm('Undo last session?', 'This removes the most recently logged session and its XP.', undoLast);
    });
    $('editDeleteBtn').addEventListener('click', () => {
      openConfirm('Delete this session?', 'This removes it and its XP for good.', () => {
        state.sessions = state.sessions.filter((s) => s.id !== activeEditId);
        persist();
        recompute();
        closeModal();
        renderAll();
      });
    });
    $('editCancelBtn').addEventListener('click', closeModal);
    $('editSaveBtn').addEventListener('click', saveEditedSession);
  }

  function undoLast() {
    let last = null;
    state.sessions.forEach((s) => { if (!last || s.loggedAt > last.loggedAt) last = s; });
    if (!last) return;
    state.sessions = state.sessions.filter((s) => s.id !== last.id);
    persist();
    recompute();
    closeModal();
    renderAll();
    showToast('Session undone.');
  }

  function renderHistory() {
    const list = $('historyList');
    list.innerHTML = '';
    const sorted = derived.sessionsWithXP.slice().sort((a, b) => b.loggedAt - a.loggedAt);
    $('historyEmpty').hidden = sorted.length > 0;
    sorted.forEach((s) => {
      const slot = QuestXP.slotForIndex(s.programIndex);
      const meta = questData.days_meta[slot.day];
      const item = document.createElement('div');
      item.className = 'history-item';
      const dateStr = new Date(s.dateISO).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const xpTotal = s.baseXP + s.weeklyBonusXP;
      item.innerHTML = `
        <div class="history-item-main">
          <span class="history-item-day">Week ${slot.week} · ${meta.label}</span>
          <span class="history-item-date">${dateStr}</span>
        </div>
        <span class="history-item-xp">+${xpTotal} XP${s.weeklyBonusXP ? ' ⭐' : ''}</span>
      `;
      item.addEventListener('click', () => openEditModal(s));
      list.appendChild(item);
    });
  }

  function openEditModal(session) {
    activeEditId = session.id;
    populateWeekSelect($('editWeek'));
    const slot = QuestXP.slotForIndex(session.programIndex);
    $('editWeek').value = String(slot.week);
    $('editDay').value = slot.day;
    $('editDate').value = session.dateISO.slice(0, 10);
    openModal('modalHistoryEdit');
  }

  function saveEditedSession() {
    const week = Number($('editWeek').value);
    const day = $('editDay').value;
    const dateVal = $('editDate').value; // YYYY-MM-DD
    const session = state.sessions.find((s) => s.id === activeEditId);
    if (!session) { closeModal(); return; }
    const programIndex = (week - 1) * 3 + QuestXP.DAY_LETTERS.indexOf(day);
    session.programIndex = programIndex;
    // Preserve time-of-day if we have it, otherwise default to noon local.
    const prevTime = session.dateISO.slice(11);
    session.dateISO = dateVal ? `${dateVal}T${prevTime || '12:00:00.000Z'}` : session.dateISO;
    persist();
    recompute();
    closeModal();
    renderAll();
  }

  function populateWeekSelect(select) {
    select.innerHTML = '';
    for (let w = 1; w <= 12; w++) {
      const opt = document.createElement('option');
      opt.value = String(w);
      opt.textContent = `Week ${w}`;
      select.appendChild(opt);
    }
  }

  /* ---------------------------------------------------------------------
     Settings
     --------------------------------------------------------------------- */
  function wireSettings() {
    $('exportBtn').addEventListener('click', exportProgress);
    $('importInput').addEventListener('change', importProgress);
    $('resetBtn').addEventListener('click', () => {
      openConfirm('Reset all progress?', 'This wipes every session, badge, and XP point on this device. Export a backup first if you want to keep it.', doReset);
    });
  }

  function exportProgress() {
    const json = QuestStorage.exportState(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `quest-log-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup downloaded.');
  }

  function importProgress(evt) {
    const file = evt.target.files && evt.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = QuestStorage.importState(String(reader.result));
        openConfirm('Import this backup?', 'This replaces all current progress on this device with the imported file.', () => {
          state = imported;
          persist();
          recompute();
          selectedProgramIndex = derived.nextProgramIndex;
          renderAll();
          showToast('Progress imported.');
        });
      } catch (e) {
        alert('Couldn\'t import that file: ' + e.message);
      } finally {
        evt.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function doReset() {
    state = QuestStorage.defaultState();
    persist();
    recompute();
    selectedProgramIndex = derived.nextProgramIndex;
    closeModal();
    renderAll();
    showToast('Progress reset. Fresh start!');
  }

  /* ---------------------------------------------------------------------
     Modals / overlay
     --------------------------------------------------------------------- */
  function wireModals() {
    $('overlay').addEventListener('click', (e) => {
      if (e.target.id === 'overlay') closeModal();
    });
    $('modalConfirmCancel').addEventListener('click', closeModal);
    $('modalConfirmOk').addEventListener('click', () => {
      const cb = confirmCallback;
      confirmCallback = null;
      if (cb) cb();
    });
    $('focusCloseBtn').addEventListener('click', closeModal);
    $('rankupCloseBtn').addEventListener('click', () => { $('rankupBanner').hidden = true; });
  }

  function openModal(id) {
    document.querySelectorAll('.modal').forEach((m) => { m.hidden = m.id !== id; });
    $('overlay').hidden = false;
  }

  function closeModal() {
    $('overlay').hidden = true;
    document.querySelectorAll('.modal').forEach((m) => { m.hidden = true; });
    confirmCallback = null;
  }

  function openConfirm(title, body, onConfirm) {
    $('modalConfirmTitle').textContent = title;
    $('modalConfirmBody').textContent = body;
    confirmCallback = onConfirm;
    openModal('modalConfirm');
  }

  /* ---------------------------------------------------------------------
     Toast
     --------------------------------------------------------------------- */
  let toastTimer = null;
  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ---------------------------------------------------------------------
     Service worker (optional offline support)
     --------------------------------------------------------------------- */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
