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

  // Display-only cleanup: quest-data.json stays verbatim (source of truth),
  // this just trims extra load/detail off a name for on-screen display —
  // early phases put it in parens ("Foo (bar)"), later phases after a
  // comma ("Foo, bar") — either way, keep only what's before the first one.
  const displayName = (name) => name.split('(')[0].split(',')[0].trim();

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
    wireSideQuests();
    wireHistory();
    wireSettings();
    wireModals();
    wirePin();

    renderAll();
    showView('today');
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
    renderExerciseIndex();
    renderBoard();
    renderHistory();
    renderSettings();
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

  let lastRenderedIndex = null;
  let todayChecks = {}; // key: `${section}_${itemIndex}` -> bool, reset when the selected slot changes

  function renderToday() {
    const slot = QuestXP.slotForIndex(selectedProgramIndex);
    const { phase, exercises } = QuestXP.exercisesFor(questData, slot.week, slot.day);
    const meta = questData.days_meta[slot.day];

    if (selectedProgramIndex !== lastRenderedIndex) {
      todayChecks = {};
      lastRenderedIndex = selectedProgramIndex;
    }

    $('pickerPhase').textContent = phase ? `Phase ${phase.id} · ${phase.name}` : '';
    $('pickerWeekDay').textContent = `Week ${slot.week} — ${meta.label}`;
    $('dayPrevBtn').disabled = selectedProgramIndex === 0;
    $('dayNextBtn').disabled = selectedProgramIndex === QuestXP.TOTAL_SESSIONS - 1;

    const focusCard = $('todayFocusCard');
    focusCard.dataset.day = slot.day;
    $('dayFocusChip').textContent = `${meta.label} · ${meta.focus}`;
    $('dayRoundsNote').textContent = roundsText(phase, slot.week);

    renderExerciseList($('warmupList'), questData.warmup, false, 'warmup', 1);
    renderExerciseList($('exerciseList'), exercises, true, 'main', roundsCount(phase, slot.week));
    renderExerciseList($('cooldownList'), questData.cooldown, false, 'cooldown', 1);

    const alreadyDone = derived.completedIndexes.has(selectedProgramIndex);
    const completeBtn = $('completeSessionBtn');
    if (derived.loggedToday) {
      completeBtn.disabled = true;
      completeBtn.querySelector('.btn-huge-label').textContent = 'Already logged today! 🎉';
      $('completeSessionSub').textContent = 'One session a day — see you next time!';
    } else {
      completeBtn.disabled = false;
      const label = alreadyDone ? 'Log another go at this quest!' : 'Session complete!';
      completeBtn.querySelector('.btn-huge-label').textContent = label;
      const willGetWeeklyBonus = wouldTriggerWeeklyBonus();
      $('completeSessionSub').textContent = willGetWeeklyBonus
        ? `+${questData.xp_rules.xp_per_completed_session} XP + ${questData.xp_rules.weekly_full_attendance_bonus} XP weekly bonus!`
        : `+${questData.xp_rules.xp_per_completed_session} XP`;
    }
  }

  // Every phase follows the same escalation: 2 rounds through the first
  // half of its weeks, 3 rounds through the second half — derived from the
  // phase's own "weeks" range (e.g. "5-8"), not hardcoded to any one phase.
  function roundsCount(phase, week) {
    if (!phase) return 1;
    const [lo, hi] = phase.weeks.split('-').map(Number);
    const half = Math.floor((hi - lo + 1) / 2);
    return (week - lo) < half ? 2 : 3;
  }

  function roundsText(phase, week) {
    if (!phase) return '';
    return `${roundsCount(phase, week)} rounds through the list today`;
  }

  function renderExerciseList(ul, items, showSlot, checkSection, maxRounds) {
    maxRounds = maxRounds || 1;
    ul.innerHTML = '';
    items.forEach((it, idx) => {
      const li = document.createElement('li');
      const checkKey = checkSection ? `${checkSection}_${idx}` : null;
      const count = checkKey ? (todayChecks[checkKey] || 0) : 0;
      const done = count >= maxRounds;
      const partial = count > 0 && !done;

      if (checkSection) {
        li.className = 'checkable' + (done ? ' checked' : '') + (partial ? ' partial' : '');
        const box = document.createElement('span');
        box.className = 'exercise-check';
        box.setAttribute('aria-hidden', 'true');
        box.textContent = done ? '✓' : (partial ? `${count}/${maxRounds}` : '');
        li.appendChild(box);
        li.setAttribute('role', 'checkbox');
        li.setAttribute('aria-checked', String(done));
        li.tabIndex = 0;
        const toggle = () => {
          todayChecks[checkKey] = (count + 1) % (maxRounds + 1);
          renderExerciseList(ul, items, showSlot, checkSection, maxRounds);
        };
        li.addEventListener('click', toggle);
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
      }

      const left = document.createElement('span');
      left.className = 'exercise-text';
      if (showSlot && it.slot) {
        const slotEl = document.createElement('span');
        slotEl.className = 'exercise-slot';
        slotEl.textContent = it.slot;
        left.appendChild(slotEl);
      }
      const nameEl = document.createElement('span');
      nameEl.className = 'exercise-name';
      nameEl.textContent = displayName(it.exercise || it.name);
      if (it.is_new) {
        const badge = document.createElement('span');
        badge.className = 'new-badge';
        badge.textContent = 'NEW';
        nameEl.appendChild(badge);
      }
      left.appendChild(nameEl);

      const right = document.createElement('span');
      right.className = 'exercise-right';
      const reps = document.createElement('span');
      reps.className = 'exercise-reps';
      reps.textContent = it.reps || it.dose || '';
      right.appendChild(reps);
      right.appendChild(watchButton(it.exercise || it.name, true));

      li.appendChild(left);
      li.appendChild(right);
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
    if (derived.loggedToday) return; // belt-and-suspenders — button should already be disabled
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
    $('modalBadgeEarn').addEventListener('click', attemptEarnBadge);
    $('modalBadgeUnearn').addEventListener('click', attemptUnearnBadge);
  }

  let activeSideQuestKey = null;

  function wireSideQuests() {
    $('sqCloseBtn').addEventListener('click', closeModal);
    $('sqEarnBtn').addEventListener('click', attemptEarnSideQuest);
    $('sqUnearnBtn').addEventListener('click', attemptUnearnSideQuest);
  }

  function openSideQuestModal(key) {
    activeSideQuestKey = key;
    const sq = (questData.side_quests || []).find((x) => x.key === key);
    if (!sq) return;
    const earned = state.sideQuests[key] && state.sideQuests[key].earned;
    $('sqName').textContent = `Side Quest: ${sq.name}`;
    $('sqTagline').textContent = sq.tagline || '';
    const list = $('sqSteps');
    list.innerHTML = '';
    (sq.steps || []).forEach((step) => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.className = 'exercise-text';
      const labelEl = document.createElement('span');
      labelEl.className = 'exercise-slot';
      labelEl.textContent = step.label;
      const detailEl = document.createElement('span');
      detailEl.className = 'exercise-name';
      detailEl.textContent = step.detail;
      left.appendChild(labelEl);
      left.appendChild(detailEl);
      li.appendChild(left);
      list.appendChild(li);
    });
    if (earned) {
      $('sqStatus').textContent = `Earned ${state.sideQuests[key].date}`;
      $('sqEarnBtn').hidden = true;
      $('sqUnearnBtn').hidden = false;
    } else {
      $('sqStatus').textContent = `Worth +${sq.xp_reward} XP`;
      $('sqEarnBtn').hidden = false;
      $('sqUnearnBtn').hidden = true;
    }
    openModal('modalSideQuest');
  }

  function attemptEarnSideQuest() {
    if (!activeSideQuestKey) return;
    if (!state.settings.badgePinHash) {
      openPinCreate(
        'Set a parent PIN to approve Side Quests and badges — one only a grown-up knows. This will be granted once it\'s set.',
        grantSideQuest
      );
    } else {
      openPinVerify('Enter the parent PIN to approve this Side Quest.', grantSideQuest);
    }
  }

  function grantSideQuest() {
    if (!activeSideQuestKey) return;
    const sq = (questData.side_quests || []).find((x) => x.key === activeSideQuestKey);
    if (!sq) return;
    const prevRank = derived.currentRank.name;
    const today = new Date().toISOString().slice(0, 10);
    state.sideQuests[activeSideQuestKey] = { earned: true, date: today };
    persist();
    recompute();
    closeModal();
    showToast(`Side Quest complete! +${sq.xp_reward} XP ⚔️`);
    QuestConfetti.burst({ count: 130, spread: 1.2 });
    renderAll();
    if (derived.currentRank.name !== prevRank) {
      setTimeout(() => showRankUp(derived.currentRank.name), 700);
    }
  }

  function attemptUnearnSideQuest() {
    if (!activeSideQuestKey) return;
    openPinVerify('Enter the parent PIN to undo this Side Quest.', unearnActiveSideQuest);
  }

  function unearnActiveSideQuest() {
    if (!activeSideQuestKey) return;
    delete state.sideQuests[activeSideQuestKey];
    persist();
    recompute();
    closeModal();
    showToast('Side Quest un-marked.');
    renderAll();
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
      $('modalBadgeUnearn').hidden = false;
    } else {
      $('modalBadgeStatus').textContent = `Worth +${questData.xp_rules.badge_bonus_xp} XP`;
      $('modalBadgeEarn').hidden = false;
      $('modalBadgeUnearn').hidden = true;
    }
    openModal('modalBadge');
  }

  function attemptEarnBadge() {
    if (!activeBadgeKey) return;
    if (!state.settings.badgePinHash) {
      openPinCreate(
        'Set a parent PIN to approve badges — one only a grown-up knows. This badge will be granted once it\'s set.',
        grantActiveBadge
      );
    } else {
      openPinVerify('Enter the parent PIN to approve this badge.', grantActiveBadge);
    }
  }

  function grantActiveBadge() {
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

  function attemptUnearnBadge() {
    if (!activeBadgeKey) return;
    openPinVerify('Enter the parent PIN to undo this badge.', unearnActiveBadge);
  }

  function unearnActiveBadge() {
    if (!activeBadgeKey) return;
    delete state.badges[activeBadgeKey];
    persist();
    recompute();
    closeModal();
    showToast('Badge un-marked.');
    renderAll();
  }

  /* ---------------------------------------------------------------------
     Exercise Index — quick video reference for every move in the program
     --------------------------------------------------------------------- */
  function youtubeSearchUrl(name) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(displayName(name) + ' exercise tutorial')}`;
  }

  function openExerciseVideo(name) {
    window.open(youtubeSearchUrl(name), '_blank', 'noopener,noreferrer');
  }

  function watchButton(name, iconOnly) {
    const link = document.createElement('a');
    link.className = 'watch-link' + (iconOnly ? ' watch-link-icon' : '');
    link.href = youtubeSearchUrl(name);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = iconOnly ? '▶' : '▶ Watch';
    link.setAttribute('aria-label', 'Watch a demo of ' + displayName(name));
    link.addEventListener('click', (e) => {
      // Stop this from bubbling into a parent checkable <li>'s toggle
      // handler, and drive navigation explicitly so it reliably opens in a
      // new window even where a plain target="_blank" can be unreliable
      // (e.g. an installed/standalone PWA).
      e.preventDefault();
      e.stopPropagation();
      openExerciseVideo(name);
    });
    return link;
  }

  function exerciseIndexRow(it) {
    const name = it.exercise || it.name;
    const dose = it.reps || it.dose || '';
    const li = document.createElement('li');
    li.className = 'index-row';
    const left = document.createElement('span');
    left.className = 'exercise-text';
    if (it.slot) {
      const slotEl = document.createElement('span');
      slotEl.className = 'exercise-slot';
      slotEl.textContent = it.slot;
      left.appendChild(slotEl);
    }
    const nameEl = document.createElement('span');
    nameEl.className = 'exercise-name';
    nameEl.textContent = displayName(name);
    left.appendChild(nameEl);
    const reps = document.createElement('span');
    reps.className = 'exercise-reps';
    reps.textContent = dose;
    li.appendChild(left);
    li.appendChild(reps);
    li.appendChild(watchButton(name, false));
    return li;
  }

  function indexSection(title, items) {
    const details = document.createElement('details');
    details.className = 'card collapsible index-section';
    const summary = document.createElement('summary');
    summary.textContent = title;
    const ul = document.createElement('ul');
    ul.className = 'exercise-list index-list';
    items.forEach((it) => ul.appendChild(exerciseIndexRow(it)));
    details.appendChild(summary);
    details.appendChild(ul);
    return details;
  }

  function renderExerciseIndex() {
    const root = $('exerciseIndexList');
    if (!root) return;
    root.innerHTML = '';
    root.appendChild(indexSection('🔥 Warm-up', questData.warmup));
    root.appendChild(indexSection('🧊 Cooldown', questData.cooldown));
    questData.phases.forEach((phase) => {
      const details = document.createElement('details');
      details.className = 'card collapsible index-section';
      const summary = document.createElement('summary');
      summary.textContent = `Phase ${phase.id} · ${phase.name} (Weeks ${phase.weeks})`;
      details.appendChild(summary);
      QuestXP.DAY_LETTERS.forEach((day) => {
        const meta = questData.days_meta[day];
        const heading = document.createElement('h4');
        heading.className = 'index-subheading';
        heading.textContent = `${meta.label} · ${meta.focus}`;
        const ul = document.createElement('ul');
        ul.className = 'exercise-list index-list';
        (phase.days[day] || []).forEach((it) => ul.appendChild(exerciseIndexRow(it)));
        details.appendChild(heading);
        details.appendChild(ul);
      });
      root.appendChild(details);
    });
  }

  /* ---------------------------------------------------------------------
     Parent PIN — gates badge approval behind a PIN only a parent knows.
     Not a real security boundary (everything here is client-side and
     inspectable), just a "stop and ask a grown-up" speed bump.
     --------------------------------------------------------------------- */
  let pinMode = 'create'; // 'create' | 'verify'
  let pinResolveCallback = null;

  function randomHex(byteLen) {
    const arr = new Uint8Array(byteLen);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(arr);
    else for (let i = 0; i < byteLen; i++) arr[i] = Math.floor(Math.random() * 256);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function hashPin(pin, salt) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      const data = new TextEncoder().encode(salt + ':' + pin);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback for browsers without SubtleCrypto — fine here since this is a
    // speed bump, not a security boundary.
    let h = 0;
    const str = salt + ':' + pin;
    for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i) | 0;
    return 'fb_' + (h >>> 0).toString(16);
  }

  function wirePin() {
    $('pinCancelBtn').addEventListener('click', () => {
      pinResolveCallback = null;
      closeModal();
    });
    $('pinSubmitBtn').addEventListener('click', submitPinModal);
    $('pinForgotBtn').addEventListener('click', () => {
      pinResolveCallback = null;
      closeModal();
      openConfirm(
        'Forgot your PIN?',
        'There\'s no way to recover a forgotten PIN — the only fix is a full reset, which wipes every session, badge, and Side Quest on this device (and clears the PIN too). There\'s no partial recovery. Export a backup first if you have one you want to keep.',
        doFullResetIncludingPin
      );
    });
  }

  function openPinCreate(subtitle, onSuccess) {
    pinMode = 'create';
    pinResolveCallback = onSuccess;
    $('pinTitle').textContent = 'Set Parent PIN';
    $('pinSubtitle').textContent = subtitle || 'Choose a PIN only a parent knows — you\'ll enter it to approve badges.';
    $('pinConfirmRow').hidden = false;
    $('pinHintRow').hidden = false;
    $('pinHintInput').value = state.settings.badgePinHint || '';
    $('pinHintDisplay').hidden = true;
    $('pinForgotBtn').hidden = true;
    $('pinInput').value = '';
    $('pinConfirmInput').value = '';
    $('pinError').textContent = '';
    openModal('modalPin');
  }

  function openPinVerify(subtitle, onSuccess) {
    pinMode = 'verify';
    pinResolveCallback = onSuccess;
    $('pinTitle').textContent = 'Enter Parent PIN';
    $('pinSubtitle').textContent = subtitle || 'Enter the parent PIN to continue.';
    $('pinConfirmRow').hidden = true;
    $('pinHintRow').hidden = true;
    if (state.settings.badgePinHint) {
      $('pinHintDisplay').textContent = `Hint: ${state.settings.badgePinHint}`;
      $('pinHintDisplay').hidden = false;
    } else {
      $('pinHintDisplay').hidden = true;
    }
    $('pinForgotBtn').hidden = false;
    $('pinInput').value = '';
    $('pinConfirmInput').value = '';
    $('pinError').textContent = '';
    openModal('modalPin');
  }

  async function submitPinModal() {
    const pin = $('pinInput').value.trim();
    if (pin.length < 4) {
      $('pinError').textContent = 'PIN needs to be at least 4 characters.';
      return;
    }
    if (pinMode === 'create') {
      const confirmVal = $('pinConfirmInput').value.trim();
      if (pin !== confirmVal) {
        $('pinError').textContent = 'PINs don\'t match — try again.';
        return;
      }
      const salt = randomHex(16);
      const hash = await hashPin(pin, salt);
      state.settings.badgePinHash = hash;
      state.settings.badgePinSalt = salt;
      state.settings.badgePinHint = $('pinHintInput').value.trim() || null;
      persist();
      const cb = pinResolveCallback;
      pinResolveCallback = null;
      closeModal();
      renderSettings();
      if (cb) cb();
    } else {
      const hash = await hashPin(pin, state.settings.badgePinSalt || '');
      if (hash !== state.settings.badgePinHash) {
        $('pinError').textContent = 'That\'s not the right PIN.';
        $('pinInput').value = '';
        $('pinInput').focus();
        return;
      }
      const cb = pinResolveCallback;
      pinResolveCallback = null;
      closeModal();
      if (cb) cb();
    }
  }

  function renderSettings() {
    const hasPin = !!(state.settings && state.settings.badgePinHash);
    $('setPinBtn').hidden = hasPin;
    $('changePinBtn').hidden = !hasPin;
    $('removePinBtn').hidden = !hasPin;
    $('pinStatusHint').textContent = hasPin
      ? 'A parent PIN is set — badges require approval to grant.'
      : 'No parent PIN set yet — badges can be granted freely until you set one.';
  }

  /* ---------------------------------------------------------------------
     Quest Board
     --------------------------------------------------------------------- */
  function renderBoard() {
    $('boardCompletedCount').textContent = derived.completedCount;
    const trail = $('questTrail');
    trail.innerHTML = '';
    const sideQuestDefs = questData.side_quests || [];
    for (let i = 0; i < QuestXP.TOTAL_SESSIONS; i++) {
      const slot = QuestXP.slotForIndex(i);
      const phase = QuestXP.phaseForWeek(questData, slot.week);
      const done = derived.completedIndexes.has(i);
      const isNext = i === derived.nextProgramIndex && !derived.programComplete;
      const isWeeklyMarker = (i + 1) % 3 === 0;
      const isFinish = i === QuestXP.TOTAL_SESSIONS - 1;

      const stop = document.createElement('div');
      stop.className = `quest-stop day-${slot.day}` + (done ? ' done' : '') + (isNext ? ' next' : '') + (isFinish ? ' finish' : '');
      stop.title = `Week ${slot.week} · Day ${slot.day}${done ? ' — done' : ''}`;
      stop.innerHTML = `<span>${i + 1}</span>${isWeeklyMarker ? '<span class="stop-star">★</span>' : ''}`;
      trail.appendChild(stop);

      // A Side Quest node rides along right after the last stop of its phase.
      if (phase) {
        const [, hi] = phase.weeks.split('-').map(Number);
        if (slot.week === hi && slot.day === 'C') {
          const def = sideQuestDefs.find((sq) => sq.phase_id === phase.id);
          if (def) trail.appendChild(sideQuestNode(def, phase));
        }
      }
    }
  }

  function sideQuestNode(def, phase) {
    const [lo] = phase.weeks.split('-').map(Number);
    const phaseStartIndex = (lo - 1) * 3;
    const entered = derived.nextProgramIndex >= phaseStartIndex;
    const earned = !!(state.sideQuests[def.key] && state.sideQuests[def.key].earned);

    const node = document.createElement('button');
    node.className = 'side-quest-node' + (earned ? ' earned' : entered ? ' available' : ' locked');
    node.style.setProperty('--sq-color', phase.color);
    node.innerHTML = `<span class="sq-node-icon">${earned ? '🏆' : '⚔️'}</span><span class="sq-node-label">Side Quest: ${def.name}</span>`;
    node.title = entered ? def.name : `Unlocks in Phase ${phase.id}`;
    node.addEventListener('click', () => {
      if (!entered) {
        showToast(`Unlocks once you reach Phase ${phase.id}.`);
        return;
      }
      openSideQuestModal(def.key);
    });
    return node;
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
    $('setPinBtn').addEventListener('click', () => {
      openPinCreate(
        'Choose a PIN only a parent knows. You\'ll enter it each time a badge is granted.',
        () => showToast('Parent PIN set.')
      );
    });
    $('changePinBtn').addEventListener('click', () => {
      openPinVerify('Enter the current PIN to change it.', () => {
        openPinCreate('Choose a new parent PIN.', () => showToast('Parent PIN updated.'));
      });
    });
    $('removePinBtn').addEventListener('click', () => {
      openPinVerify('Enter the PIN to remove parent approval.', () => {
        state.settings.badgePinHash = null;
        state.settings.badgePinSalt = null;
        persist();
        renderSettings();
        showToast('Parent PIN removed — badges no longer require approval.');
      });
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
    // Preserve the parent PIN across a reset — otherwise "Reset all progress"
    // would double as a way to clear the badge-approval gate.
    const keepSettings = state.settings;
    state = QuestStorage.defaultState();
    state.settings = keepSettings;
    persist();
    recompute();
    selectedProgramIndex = derived.nextProgramIndex;
    closeModal();
    renderAll();
    showToast('Progress reset. Fresh start!');
  }

  // Distinct from doReset(): this is the "forgot PIN" recovery path, so it
  // deliberately does NOT preserve settings — the whole point is to clear
  // a forgotten PIN, which doReset() intentionally never does.
  function doFullResetIncludingPin() {
    state = QuestStorage.defaultState();
    persist();
    recompute();
    selectedProgramIndex = derived.nextProgramIndex;
    closeModal();
    renderAll();
    showToast('Everything reset, including the PIN.');
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
