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
