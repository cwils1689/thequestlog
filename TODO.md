# The Quest Log — To-Do

Backlog of requested changes, not yet implemented.

---

## 1. Account for rounds per day (exercise checkboxes) — DECIDED: Option A

**Problem**: the program has the kid do multiple full passes ("rounds")
through the exercise list per session, but each exercise's checkbox on Today
is a single on/off toggle — checking it off once currently reads as "done for
the day," with no way to represent "done round 1, still have round 2 (or 3)."

**Terminology note**: "cycle" = the app's existing `rounds_note` field in
`quest-data.json`. That field currently only specifies a round count for
Phase 1 (2 rounds weeks 1–2, 3 rounds weeks 3–4; `null`/unspecified for
Phases 2–3, i.e. 1 round). **The checkbox state count must read the round
count from that data per phase/week, not assume a hardcoded 2** — Phase 1
weeks 3–4 needs 3 states, and Phases 2–3 arguably just need the existing
plain on/off (1 round).

**Chosen approach — Option A, two-state tap cycle**: each checkbox cycles
through N+1 visual states on tap (N = rounds for that phase/week: 1, 2, or
3) — e.g. for a 2-round day: empty → half-filled ("1/2", round 1 done) →
fully filled (round 2 done) → back to empty. Same single tap target per
exercise as today, `todayChecks[key]` becomes an integer `0..N` instead of a
boolean.

- Keep this **session-scoped only**, same as today (resets when switching
  session slots) — it's a mid-workout aid, not saved progress, and shouldn't
  gate "Session complete!" (showing up still earns XP regardless of checkbox
  state, per the program's no-performance-gating rule).

## 2. YouTube links + quick-access Play buttons on Today — DONE (uncommitted)

- Exercise Index's "▶ Watch" links already set `target="_blank"` — confirm
  whether the reported same-window behavior is a PWA/installed-app quirk
  (standalone-display apps can hijack `target="_blank"` into the same webview
  on some platforms) and consider swapping to an explicit
  `window.open(url, '_blank', 'noopener')` call as a more reliable
  cross-platform fix if so.
- Add a "▶" play/link button next to each exercise **on the Today screen
  itself** (warm-up, main, cooldown), not just in the separate Exercise Index
  tab — so a demo video is one tap away mid-workout without leaving Today.
  Reuse the existing `youtubeSearchUrl()` helper in `js/app.js`.

## 3. Strip parentheticals from displayed exercise names — DONE (uncommitted)

- Exercise names from `quest-data.json` sometimes carry extra detail in
  parens, e.g. "Bodyweight squat to bench (sit-to-stand, bench as depth
  target)". Strip the `(...)` portion for on-screen display only.
- Do this as a **display-layer helper**, not by editing `quest-data.json` —
  the original build brief requires exercise content to match the data file
  verbatim, so the source of truth should stay untouched; only the rendered
  text gets cleaned up. (`youtubeSearchUrl()` already does something similar
  for search-query cleanliness — a shared helper could serve both.)
