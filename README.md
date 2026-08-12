# The Quest Log

A tablet-friendly, gamified companion app for a 12-week strength & mobility
program. Digital sibling to the printed workout cards / XP tracker / badge
sheet / rank meter / streak trail posters.

- **No backend, no login, no analytics, no external data calls.** Everything
  runs client-side; progress lives in `localStorage` on one device.
- **No build step.** Plain HTML/CSS/JS — open `index.html` (via a local
  server, see below) or deploy the folder as-is to GitHub Pages.

## Run it locally

Any static file server works, since the app `fetch()`es `quest-data.json`
(which needs `http://`, not `file://`). For example, with Node:

```bash
npx serve .
```

or with Python:

```bash
python -m http.server 8080
```

Then open the printed URL.

## Deploy to GitHub Pages

1. Create a new GitHub repo (this app is self-contained and doesn't need to
   share a repo with anything else).
2. Push the contents of this folder to the repo's default branch.
3. In the repo's **Settings → Pages**, set the source to that branch (root).
4. All asset references in this app use **relative paths**, so it works
   whether it ends up at the root of a domain or under a project subpath
   (`username.github.io/repo-name/`) — no configuration needed.

## What's in here

| Path | Purpose |
|---|---|
| `index.html` | App shell — all views live in one page, toggled by JS. |
| `css/style.css` | Theme, layout, and components — driven by `design-tokens.json`'s palette. |
| `js/storage.js` | `localStorage` read/write + export/import. |
| `js/xp.js` | Pure program-mapping, XP, and rank math (no DOM). |
| `js/confetti.js` | Small dependency-free celebration burst. |
| `js/app.js` | Rendering + event wiring for every screen. |
| `quest-data.json` | Source of truth for exercises, ranks, badges, XP rules — loaded at runtime. |
| `assets/badges/*.png` | The six finished badge medallions. |
| `assets/icons/*.svg` | App icon (original star-in-ring mark, no licensed imagery). |
| `manifest.webmanifest`, `service-worker.js` | Installable / basic offline support. |

## How progress is modeled

- Each of the 36 program sessions (12 weeks × A/B/C) has a `programIndex`
  0–35. Logging a session records `{ programIndex, dateISO }`.
- **XP and weekly bonuses are recomputed from scratch** from the full
  session list every time (not tracked incrementally), so editing or
  deleting a past session in History always leaves totals consistent —
  no drift, no stale bonus flags.
- Weekly attendance bonus is based on the **calendar week** (Mon–Sun) a
  session's date falls in, matching "3 sessions in a week," not the
  program's week number — so redoing or backdating a session still works
  sensibly.
- Badges are self-reported (tap "I did it!"); there's no sensor validating
  form, by design.

## Known trade-offs (flagged, not blocking)

- The Google Fonts `<link>` (Poppins/Nunito Sans, per `design-tokens.json`)
  is loaded non-blocking and the app fully degrades to a system-ui font
  stack if offline — so "no external calls" holds for all *functionality*,
  fonts are a progressive nicety only.
- `apple-touch-icon` points at an SVG; iOS may not use it for the home
  screen icon on older versions (Android/Chrome handles SVG manifest icons
  fine). Swap in PNG icons later if that matters for the target device.
