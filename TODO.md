# The Quest Log — To-Do

Previous backlog (round-aware checkboxes, YouTube play buttons, parenthetical
stripping) is done and committed — see git log. This file now tracks the
next big feature.

---

## Character customization — "Armory" (design locked, not yet built)

Son's idea, workshopped into a concrete plan. **Design is settled below —
next session should go straight to a build plan**, not another brainstorm.

### Core concept

A simple blocky/geometric character (SVG, built from basic shapes — matches
the "original blocky-world" motif already in `design-tokens.json`, no
imported art assets, no licensed-character risk) that visibly changes along
**two independent progression axes**:

1. **Muscle size ← Phase** (3 tiers: Recruit Training / Apprentice Trials /
   Path to Mastery). Torso/arms/legs get visibly chunkier each phase — the
   character's build mirrors the actual bodyweight → dumbbells → heavier
   loads arc of the real program. **Head stays the same size across all 3
   tiers** — keeps head-mounted accessories (hats) from needing per-tier
   repositioning; only body-worn items (capes, shirts) need to account for
   the size change.
2. **Held item ← Rank** (free, automatic, not purchasable — guarantees a
   visible change at every rank-up even if the shop is never touched):

   | Promotion into... | Free item |
   |---|---|
   | Trailblazer | Telescope |
   | Adventurer | Sword |
   | Vanguard | Battle axe |
   | Master of the Forge | Hammer (forge callback, capstone item) |

   (Recruit is the starting rank — no promotion moment, so no item there;
   4 items for the 4 real rank-ups.)

### Currency — "Shards" (economy locked)

Second resource earned alongside XP on the same trigger events — no
separate grind, no new actions to perform. **Spending is not PIN-gated** —
the PIN already gated *earning* bonus currency at the point a badge/Side
Quest was approved; re-gating spending it on cosmetics would be pure
friction with no purpose.

**Earn rates:**

| Event | Shards |
|---|---|
| Session complete | +5 |
| Weekly full-attendance bonus | +15 |
| Badge earned | +35 |
| Side Quest complete | +45 |

Ceiling at perfect attendance/badges/Side Quests: 36×5 + 12×15 + 6×35 + 3×45
= **705 Shards** over the 12 weeks.

### Slots

- **Cosmetic (Shards-purchasable, freely re-equippable, never lost once
  bought)**: Head/hat, Body color, Accessory/cape.
- **Held item (Rank-earned, automatic)**: separate from the shop entirely,
  see table above — never purchasable, never lost.

### Shop roster (15 items, 580 Shards to own everything)

Deliberately priced so 705-Shard ceiling leaves ~125 Shards of slack above
the 580 needed for the full collection — he does **not** need perfect
attendance to own everything; he can miss real sessions/weeks and still
afford it all before week 12, consistent with the app never punishing a
missed day.

**Head**
| Item | Cost |
|---|---|
| Scout Cap | 10 |
| Explorer's Goggles | 20 |
| Winged Helm | 40 |
| Star-Watcher Hood | 60 |
| Forgemaster's Crown | 100 |

**Body color**
| Item | Cost |
|---|---|
| Sky Blue | 10 |
| Ember Orange | 10 |
| Moss Green | 10 |
| Shadow Purple | 15 |
| Gold Plate (metallic finish) | 50 |

**Accessory / Cape**
| Item | Cost |
|---|---|
| Traveler's Cloak | 15 |
| Striped Scarf | 15 |
| Battle Cape | 35 |
| Star-Trail Cape (ties to the night-sky motif already in the app) | 70 |
| Champion's Mantle | 120 |

### UI placement

- New **"Armory"** tab in the bottom nav, **replacing "Moves.**" Moves
  (the Exercise Index) is being fully retired, not just hidden — now that
  every exercise on Today has its own "▶" video link (built earlier this
  project), the standalone browse-all-videos index is redundant. Same
  treatment as the old Quick Reference view: remove the view, its nav
  button, and its code, not just unlink it.

### Build progress

1. **DONE (uncommitted-to-UI, but built)** — Base body SVG, all 3 muscle
   tiers. `js/character.js` — `QuestCharacter.renderSVG(tier, {bodyColor})`,
   pure function, no DOM/state. Default color is clay/tan (`#D9A574`), not
   gold, so the "Gold Plate" shop item still reads as an upgrade. Script is
   wired into `index.html` but nothing calls it yet — no Armory screen
   exists to render into. Tier 3 uses a V-taper torso (broad shoulders,
   trim waist) rather than a uniformly wider box — an early draft that just
   scaled tier 2 up read as "fat," not "fit."
2. **DONE** — Data model.
   - `quest-data.json`: `shard_rules` (5/15/35/45 per event, 705 ceiling),
     `shop_items` (15 items, 580 total — exact roster/costs from the
     brainstorm), `free_item` added to the 4 promoted ranks.
   - `storage.js`: `ownedItems` (array of purchased shop_item keys) and
     `equippedItems` ({head, body_color, accessory} -> key or null) added
     to `defaultState()`, with the same load()/importState() migration
     guards as every other field — an old backup missing these fields
     loads clean, verified directly.
   - `xp.js`: `computeDerived()` now also returns `shardsEarned`,
     `shardsSpent`, `shardsBalance`, and `heldItem`. Shards follow the same
     event-sourced philosophy as XP — total earned is always recomputed
     from session/badge/Side Quest history, never an incremental counter,
     so `shardsBalance = shardsEarned - shardsSpent` can never desync from
     the ledger it's paid out of. `heldItem` is derived purely from
     `currentRank` (looked up in `ranks[].free_item`) — no state at all,
     since it's never purchasable or lost.
   - Verified with direct unit tests (Node, real quest-data.json): a
     3-week/1-badge/1-Side-Quest/2-owned-items scenario produced exactly
     the expected 170 earned / 20 spent / 150 balance and the correct
     Trailblazer+Telescope; a Recruit-only scenario correctly showed
     `heldItem: null`; a max-everything scenario reached Master of the
     Forge + Hammer with all 15 items ownable (580 spent) and balance
     still positive. Live smoke test: fresh load, full nav sweep, and a
     session log all still work with zero console errors.
3. **DONE (core flow) — Armory screen UI.**
   - Moves/Exercise Index fully retired — view, nav button, and its
     rendering functions removed. `youtubeSearchUrl`/`openExerciseVideo`/
     `watchButton` kept (Today's per-exercise play buttons still use them).
   - New Armory tab (🛡️): character preview (muscle tier + equipped body
     color, live SVG render via `character.js`), Shards balance, and 3 shop
     grids (Head/Body Color/Accessory) built straight from
     `quest-data.json`'s `shop_items`.
   - Tap an unowned+affordable item -> buys it (adds to `ownedItems`) and
     auto-equips it. Unowned+unaffordable -> toast with the exact Shard
     shortfall, not just disabled. Owned+unequipped -> equips. Equipped ->
     unequips. No PIN, no confirm modal on spending, per the locked design.
   - **Scope boundary, deliberately not done tonight**: head/accessory
     items and the held item are fully trackable/equippable but have no
     actual artwork yet — they show as a name + generic icon in the shop,
     not visually drawn onto the character. Body color *is* fully visual
     (already worked, since `character.js` already took a `bodyColor` param)
     — confirmed the character's actual fill color changes live on
     purchase/equip. Drawing real hat/cape/weapon art onto the character is
     follow-up work, not scoped into "the Armory screen UI."
   - Verified live: fresh Armory renders correctly (0 Shards, 5 tiles per
     slot, correct costs); buying an unaffordable item shows the exact
     shortfall and does not charge anything; buying an affordable item
     charges correctly, auto-equips, and the character SVG's fill visibly
     changes color; the full equip -> unequip -> re-equip toggle cycle
     works; everything persists across reload; Today's video play buttons
     still work unaffected; zero console errors throughout.
4. **DONE — Item graphics.** All 14 previously-generic items now draw real
   art onto the character SVG, closing the scope boundary from step 3.
   `js/character.js`:
   - `HEAD_ART` (5): scout_cap (olive beanie + brim), explorers_goggles
     (strap + tinted lenses), winged_helm (steel dome + cream wings),
     star_watcher_hood (navy hood, side drapes, gold star fleck on the
     peak), forgemasters_crown (gold band, 3 spikes, red gem). All anchor
     to the fixed head circle (`HEAD_CX/CY/R`), so — as designed in step
     1 — they need zero per-tier repositioning.
   - `ACCESSORY_BACK_ART`/`ACCESSORY_FRONT_ART` (5): capes/cloak drawn
     *behind* legs/arms/torso so they read as fabric hanging off the
     shoulders, peeking out at the sides and below rather than being
     fully hidden by the body silhouette (travelers_cloak needed a second
     pass — its first draft was narrower than the arms and nearly
     invisible). star_trail_cape's white star accents likewise needed
     repositioning into the flanking strip below the torso/arms, since
     anywhere closer to center gets drawn over. champions_mantle adds a
     front-layer fur collar + gold medallion.
   - `HELD_ITEM_ART` (4): telescope, sword, battle_axe, hammer — anchored
     to the character's right-hand point (derived from tier geometry, so
     it tracks arm position across all 3 tiers) and drawn topmost/frontmost
     with a slight outward rotation to read as "held." battle_axe's blade
     needed a second pass (path-based crescent) after the first polygon
     attempt read as a flag, not an axe head.
   - `renderSVG(tier, options)` options grew `head`/`accessory`/`heldItem`
     (equipped shop_item keys / rank free_item key); unknown or absent
     keys draw nothing, so this is backward compatible with the body-color
     -only call from step 3.
   - `js/app.js`'s `renderCharacterPreview()` now passes
     `state.equippedItems.head`, `.accessory`, and `derived.heldItem.key`
     through, replacing the step-3 `bodyColor`-only call.
   - Verified: every item rendered standalone and in tier 1/2/3 combos via
     direct `QuestCharacter.renderSVG()` calls, rasterized to PNG and
     visually inspected (not just "didn't throw") — caught and fixed the
     invisible cloak and flag-shaped axe this way before they'd have
     shipped. Also verified through the real app: seeded `localStorage`
     with a fabricated 12-week/6-badge/1-side-quest history reaching
     Master of the Forge, loaded the actual Armory screen, and confirmed
     `characterHeldItem` read "Holding: Hammer" — i.e. the real
     `state.equippedItems`/`derived.heldItem` wiring, not just the
     isolated renderer, works end to end.
   - **Follow-up fix, same session**: the first pass on the 4 non-goggle
     head items (scout_cap, winged_helm, star_watcher_hood,
     forgemasters_crown) sat too low — brim/band bottom edges landed at
     y≈29-34 against eyes fixed at cy=32, so they visually blindfolded the
     character. Pulled every hat's baseline up (brim/band bottom now
     ≤y=26, ~4-6px clear of the eyes) so forehead shows between hat and
     eyes on all 4. Left explorers_goggles untouched — goggles are
     *supposed* to sit over the eyes. Re-verified at full render size
     (rasterized PNG, not the small thumbnail grid — a small composite
     thumbnail earlier made winged_helm's wings look broken/off-canvas;
     that was a canvas-scaling artifact in the test harness, not the SVG,
     confirmed by re-rendering that one item alone at full size).
4. **DONE — Shop-tile item icons.** The Armory shop cards showed a
   generic 🪖/🧣 emoji for every head/accessory item (only body_color had
   a real preview, via its color swatch) — he could see what an item
   *did to the character* but not what it looked like before buying it.
   `js/character.js`:
   - New `HEAD_ICON`/`ACCESSORY_ICON` maps (5 each) + `renderItemIcon(slot,
     key)`, exported on `QuestCharacter`. Deliberately separate shapes
     from `HEAD_ART`/`ACCESSORY_*_ART` rather than reused at a different
     scale — those are tuned to sit correctly on the character (e.g.
     winged_helm's wings are arm-width, capes are torso-width), which
     doesn't fit a small square badge; a first attempt reusing them for
     winged_helm clipped the wings off the icon. Each icon is a
     self-contained shape in its own 64x64 box, no character/body.
   - `js/app.js`'s `renderShopGrid()` now calls `QuestCharacter
     .renderItemIcon(slot, item.key)` for the `shop-tile-icon` span
     instead of the old flat `SLOT_ICON` emoji lookup (which is now
     removed — no more per-slot-only icon, every item has its own).
   - Verified: all 10 icons rendered standalone and at the actual 36px
     shop-tile display size (not just the zoomed-in preview) — every item
     stays legible and distinguishable from its category-mates at real
     size (e.g. the 3 capes read as browns/orange/navy/purple, not just
     "a trapezoid"). Live-app check: seeded owned/equipped state, loaded
     the real Armory shop grid, confirmed all 10 tiles render an actual
     `<svg>` (not the old emoji span) with the correct per-item shape.
5. **DONE — Dropped the "Holding: X" text line.** Now that held items
   (telescope/sword/battle_axe/hammer) are drawn directly on the
   character, the text label under the character preview was redundant
   — removed the `<p id="characterHeldItem">` element from `index.html`,
   the code in `js/app.js` that filled it in, and the now-unused
   `.character-held-item` rule from `css/style.css`. Verified live: at
   Trailblazer rank the character correctly shows the telescope drawn in
   its hand, with no leftover text element in the DOM at all.
