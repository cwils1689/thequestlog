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
2. **Not started** — Data model (`quest-data.json` additions for shard
   rules + shop items + rank items; `state.shards`/`ownedItems`/
   `equippedItems` in storage.js).
3. **Not started** — Armory screen UI (shop + equip flow) and retiring the
   Moves/Exercise Index view.
