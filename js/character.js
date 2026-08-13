/* character.js — renders the blocky hero avatar used in the Armory.
   Pure function, same philosophy as xp.js: no DOM, no state, just geometry
   in -> an SVG string out. Muscle tier maps 1:1 to phase.id (1-3); tier
   only changes torso/arm/leg bulk — head size and position never change,
   so head-mounted items never need per-tier repositioning. */

(function (global) {
  const INK = '#1B1F3B';
  const DEFAULT_COLOR = '#D9A574'; // clay/tan — a neutral starting material,
  // deliberately not gold, so the "Gold Plate" shop item still reads as an
  // upgrade rather than matching the default look.
  const CX = 80; // horizontal center of the 160-wide viewBox

  // Head circle is fixed across all 3 tiers (see module comment), so every
  // head-item drawer below can use these constants directly instead of
  // taking tier geometry as a parameter.
  const HEAD_CX = CX, HEAD_CY = 34, HEAD_R = 20;

  // Small fixed palette for item art. Kept separate from body/shop colors
  // (those live in quest-data.json) since these are fixed per-item looks,
  // not user-pickable.
  const PAL = {
    steel: '#5B6472', steelLight: '#D8DEE9', steelDark: '#3F4652',
    gold: '#E0A400', goldLight: '#FFC93C',
    brown: '#5C3A21', brownLight: '#8B5E3C',
    brass: '#C9A227', brassDark: '#8A6C1D',
    cream: '#FBF7EC',
    navy: '#232852',
    purple: '#6E3193',
    ember: '#E0562F',
    olive: '#6B8F4E', oliveDark: '#4F6B38',
    cyan: '#BFE6F0',
  };

  // Every number below was tuned and visually approved tier-by-tier before
  // being ported here — treat as exact, not derived, so the shipped avatar
  // never silently drifts from what was actually signed off on.
  const GEOMETRY = {
    1: { // Phase 1 — Recruit Training (lean)
      shoulderL: 56, shoulderR: 104, waistL: 60, waistR: 100,
      torsoTop: 62, torsoBottom: 126,
      armX: [46, 101], armY: 65, armW: 13, armH: 56, armRx: 6,
      bicep: null,
      legX: [62, 83], legY: 124, legW: 15, legH: 52, legRx: 7,
      footX: [59, 80], footY: 172, footW: 21, footH: 9, footRx: 4,
      shadowRx: 30,
    },
    2: { // Phase 2 — Apprentice Trials (medium)
      shoulderL: 50, shoulderR: 110, waistL: 57, waistR: 103,
      torsoTop: 62, torsoBottom: 126,
      armX: [37, 107], armY: 64, armW: 17, armH: 58, armRx: 7,
      bicep: { r: 6, cy: 83 },
      legX: [58, 83], legY: 124, legW: 19, legH: 54, legRx: 8,
      footX: [55, 80], footY: 174, footW: 25, footH: 9, footRx: 4,
      shadowRx: 36,
    },
    3: { // Phase 3 — Path to Mastery (broad shoulders, trim waist — a
         // V-taper reads athletic; a uniformly wider box read "fat" in
         // review, so tier 3 is deliberately not just "tier 2 but bigger")
      shoulderL: 46, shoulderR: 114, waistL: 56, waistR: 104,
      torsoTop: 60, torsoBottom: 126,
      armX: [30, 109], armY: 63, armW: 21, armH: 60, armRx: 8,
      bicep: { r: 8, cy: 83 },
      legX: [54, 83], legY: 122, legW: 23, legH: 56, legRx: 9,
      footX: [50, 80], footY: 174, footW: 30, footH: 10, footRx: 5,
      shadowRx: 40,
    },
  };

  /* -----------------------------------------------------------------
     Head items — sit on the fixed head circle (HEAD_CX/CY/R). Drawn on
     top of the face, in the same document position for every tier.
     ----------------------------------------------------------------- */
  const HEAD_ART = {
    scout_cap(cx, cy) {
      // Brim bottom is pinned well above the eyes (cy-2 top edge) — a cap
      // pulled down to eye level reads as "blindfold," not "hat."
      const baseY = cy - 12; // 22 — dome flat edge
      const r = 20;
      return `
  <path d="M ${cx - r} ${baseY} A ${r} ${r} 0 0 1 ${cx + r} ${baseY} Z" fill="${PAL.olive}" stroke="${INK}" stroke-width="2.5"/>
  <rect x="${cx - r - 2}" y="${baseY - 2}" width="${2 * r + 4}" height="6" rx="3" fill="${PAL.oliveDark}" stroke="${INK}" stroke-width="2"/>
  <circle cx="${cx}" cy="${baseY - r + 4}" r="2.3" fill="${PAL.oliveDark}"/>`;
    },
    explorers_goggles(cx, cy) {
      return `
  <rect x="${cx - 22}" y="${cy - 5}" width="44" height="7" rx="3.5" fill="${PAL.brown}" stroke="${INK}" stroke-width="1.5"/>
  <circle cx="${cx - 8}" cy="${cy - 2}" r="6.5" fill="${PAL.cyan}" stroke="${PAL.steel}" stroke-width="2.5"/>
  <circle cx="${cx + 8}" cy="${cy - 2}" r="6.5" fill="${PAL.cyan}" stroke="${PAL.steel}" stroke-width="2.5"/>
  <circle cx="${cx - 8}" cy="${cy - 2}" r="2" fill="#FFFFFF" opacity="0.55"/>
  <circle cx="${cx + 8}" cy="${cy - 2}" r="2" fill="#FFFFFF" opacity="0.55"/>`;
    },
    winged_helm(cx, cy) {
      const baseY = cy - 12; // 22 — brim above the eyes, not through them
      const r = 20;
      return `
  <path d="M ${cx - r} ${baseY} A ${r} ${r} 0 0 1 ${cx + r} ${baseY} Z" fill="${PAL.steel}" stroke="${INK}" stroke-width="2.5"/>
  <rect x="${cx - r - 1}" y="${baseY - 2}" width="${2 * r + 2}" height="5" rx="2" fill="${PAL.steelDark}" stroke="${INK}" stroke-width="1.5"/>
  <polygon points="${cx - r + 2},${baseY - 8} ${cx - r - 18},${baseY - 18} ${cx - r + 6},${baseY + 2}" fill="${PAL.cream}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <polygon points="${cx + r - 2},${baseY - 8} ${cx + r + 18},${baseY - 18} ${cx + r - 6},${baseY + 2}" fill="${PAL.cream}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
    },
    star_watcher_hood(cx, cy) {
      // Dome's flat bottom edge sits above the eyes — the hood's "opening"
      // is the visible forehead/face below it, not a line through the eyes.
      const baseY = cy - 8; // 26
      const r = 18;
      return `
  <polygon points="${cx - 20},${baseY - 6} ${cx - 13},${baseY - 6} ${cx - 22},${baseY + 36} ${cx - 31},${baseY + 30}" fill="${PAL.navy}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  <polygon points="${cx + 20},${baseY - 6} ${cx + 13},${baseY - 6} ${cx + 22},${baseY + 36} ${cx + 31},${baseY + 30}" fill="${PAL.navy}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M ${cx - r} ${baseY} A ${r} ${r} 0 0 1 ${cx + r} ${baseY} Z" fill="${PAL.navy}" stroke="${INK}" stroke-width="2.5"/>
  <polygon points="${cx - 7},${baseY - r + 4} ${cx + 7},${baseY - r + 4} ${cx},${baseY - r - 6}" fill="${PAL.navy}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  <polygon points="${cx},${baseY - r - 8} ${cx + 2.2},${baseY - r - 3} ${cx},${baseY - r + 2} ${cx - 2.2},${baseY - r - 3}" fill="${PAL.goldLight}"/>`;
    },
    forgemasters_crown(cx, cy) {
      const baseY = cy - 17; // 17 — band sits above the brow, spikes above that
      const w = 20;
      return `
  <rect x="${cx - w}" y="${baseY}" width="${2 * w}" height="8" rx="2" fill="${PAL.gold}" stroke="${INK}" stroke-width="2.5"/>
  <polygon points="${cx - w},${baseY} ${cx - w + 6},${baseY - 12} ${cx - w + 12},${baseY}" fill="${PAL.gold}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <polygon points="${cx - 6},${baseY} ${cx},${baseY - 17} ${cx + 6},${baseY}" fill="${PAL.goldLight}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <polygon points="${cx + w - 12},${baseY} ${cx + w - 6},${baseY - 12} ${cx + w},${baseY}" fill="${PAL.gold}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="${cx}" cy="${baseY + 4}" r="2.6" fill="#C0392B" stroke="${INK}" stroke-width="1"/>`;
    },
  };

  /* -----------------------------------------------------------------
     Accessories — back layer sits behind legs/torso/arms (cape edges
     peek out at the sides); front layer sits on top of the torso
     (scarf, clasps, collars). Both take tier geometry `g` since capes
     hang off the shoulders/waist, which do change size per tier.
     ----------------------------------------------------------------- */
  const ACCESSORY_BACK_ART = {
    travelers_cloak(g) {
      const baseY = g.torsoBottom + 28;
      const leftX = g.waistL - 15, rightX = g.waistR + 15;
      return `
  <polygon points="${g.shoulderL - 15},${g.torsoTop - 2} ${g.shoulderR + 15},${g.torsoTop - 2} ${rightX},${baseY} ${leftX},${baseY}" fill="${PAL.brownLight}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    },
    battle_cape(g) {
      const baseY = g.torsoBottom + 45;
      const leftX = g.waistL - 16, rightX = g.waistR + 16;
      const w = rightX - leftX;
      return `
  <polygon points="${g.shoulderL - 10},${g.torsoTop - 2} ${g.shoulderR + 10},${g.torsoTop - 2} ${rightX},${baseY - 10} ${leftX + w * 0.75},${baseY} ${leftX + w * 0.5},${baseY - 12} ${leftX + w * 0.25},${baseY} ${leftX},${baseY - 10}" fill="${PAL.ember}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    },
    star_trail_cape(g) {
      const baseY = g.torsoBottom + 50;
      const leftX = g.waistL - 18, rightX = g.waistR + 18;
      // Stars sit below the torso/arms, in the cape's hanging "tail" —
      // anywhere higher gets drawn over by the arms or legs on top of it.
      const stars = [
        [leftX + 6, g.torsoBottom + 10], [rightX - 6, g.torsoBottom + 20],
        [leftX + 5, g.torsoBottom + 32], [rightX - 5, g.torsoBottom + 42],
      ].map(([sx, sy]) => `<polygon points="${sx},${sy - 3} ${sx + 3},${sy} ${sx},${sy + 3} ${sx - 3},${sy}" fill="#FFFFFF" opacity="0.9"/>`).join('');
      return `
  <polygon points="${g.shoulderL - 10},${g.torsoTop - 2} ${g.shoulderR + 10},${g.torsoTop - 2} ${rightX},${baseY} ${leftX},${baseY}" fill="${PAL.navy}" stroke="${PAL.gold}" stroke-width="2.5" stroke-linejoin="round"/>${stars}`;
    },
    champions_mantle(g) {
      const baseY = g.torsoBottom + 52;
      const leftX = g.waistL - 20, rightX = g.waistR + 20;
      return `
  <polygon points="${g.shoulderL - 14},${g.torsoTop - 2} ${g.shoulderR + 14},${g.torsoTop - 2} ${rightX},${baseY} ${leftX},${baseY}" fill="${PAL.purple}" stroke="${PAL.gold}" stroke-width="3" stroke-linejoin="round"/>`;
    },
  };

  const ACCESSORY_FRONT_ART = {
    travelers_cloak(g) {
      return `
  <circle cx="${CX}" cy="${g.torsoTop - 2}" r="3" fill="${PAL.gold}" stroke="${INK}" stroke-width="1.5"/>`;
    },
    striped_scarf(g) {
      const y = g.torsoTop - 4;
      return `
  <rect x="${CX - 14}" y="${y}" width="28" height="9" rx="4" fill="${PAL.cream}" stroke="${INK}" stroke-width="2"/>
  <line x1="${CX - 10}" y1="${y + 9}" x2="${CX - 4}" y2="${y}" stroke="${PAL.ember}" stroke-width="3" stroke-linecap="round"/>
  <line x1="${CX}" y1="${y + 9}" x2="${CX + 6}" y2="${y}" stroke="${PAL.ember}" stroke-width="3" stroke-linecap="round"/>
  <line x1="${CX + 8}" y1="${y + 9}" x2="${CX + 13}" y2="${y + 1}" stroke="${PAL.ember}" stroke-width="3" stroke-linecap="round"/>
  <rect x="${CX - 9}" y="${y + 6}" width="7" height="17" rx="2" fill="${PAL.cream}" stroke="${INK}" stroke-width="1.5"/>
  <rect x="${CX + 2}" y="${y + 6}" width="7" height="17" rx="2" fill="${PAL.ember}" stroke="${INK}" stroke-width="1.5"/>`;
    },
    champions_mantle(g) {
      const y = g.torsoTop - 2;
      const n = 5;
      let bumps = '';
      for (let i = 0; i < n; i++) {
        const bx = g.shoulderL + ((g.shoulderR - g.shoulderL) * i) / (n - 1);
        bumps += `<circle cx="${bx}" cy="${y}" r="4" fill="${PAL.cream}" stroke="${INK}" stroke-width="1.5"/>`;
      }
      return `
  ${bumps}
  <circle cx="${CX}" cy="${g.torsoTop + 14}" r="5" fill="${PAL.gold}" stroke="${INK}" stroke-width="2"/>
  <circle cx="${CX}" cy="${g.torsoTop + 14}" r="2" fill="#C0392B"/>`;
    },
  };

  /* -----------------------------------------------------------------
     Held items — rank-earned, drawn last (topmost), anchored to the
     character's right hand (the wider-x arm) so they read as "held."
     Position derives from tier geometry `g` since the arm moves per tier.
     ----------------------------------------------------------------- */
  const HELD_ITEM_ART = {
    telescope() {
      return `
  <polygon points="-5,0 5,0 3,-46 -3,-46" fill="${PAL.brass}" stroke="${INK}" stroke-width="2"/>
  <rect x="-6" y="-22" width="12" height="4" fill="${PAL.brassDark}"/>
  <circle cx="0" cy="-46" r="4" fill="${PAL.brassDark}" stroke="${INK}" stroke-width="1.5"/>`;
    },
    sword() {
      return `
  <circle cx="0" cy="2" r="3" fill="${PAL.gold}" stroke="${INK}" stroke-width="1.5"/>
  <rect x="-2.5" y="-8" width="5" height="10" fill="${PAL.brown}" stroke="${INK}" stroke-width="1.5"/>
  <rect x="-10" y="-10" width="20" height="4" rx="1" fill="${PAL.gold}" stroke="${INK}" stroke-width="1.5"/>
  <polygon points="-4,-10 4,-10 3,-55 0,-62 -3,-55" fill="${PAL.steelLight}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
    },
    battle_axe() {
      return `
  <rect x="-2.5" y="-52" width="5" height="52" rx="2" fill="${PAL.brown}" stroke="${INK}" stroke-width="1.5"/>
  <path d="M 2,-56 L 27,-49 A 15 15 0 0 1 27,-25 L 2,-32 A 10 10 0 0 0 2,-56 Z" fill="${PAL.steel}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
    },
    hammer() {
      return `
  <rect x="-2.5" y="-44" width="5" height="44" rx="2" fill="${PAL.brown}" stroke="${INK}" stroke-width="1.5"/>
  <rect x="-14" y="-58" width="28" height="16" rx="2" fill="${PAL.steel}" stroke="${INK}" stroke-width="2.5"/>
  <rect x="-14" y="-52" width="28" height="4" fill="${PAL.ember}"/>`;
    },
  };

  function headItemMarkup(headKey) {
    const draw = headKey && HEAD_ART[headKey];
    return draw ? draw(HEAD_CX, HEAD_CY) : '';
  }

  function accessoryMarkup(map, accessoryKey, g) {
    const draw = accessoryKey && map[accessoryKey];
    return draw ? draw(g) : '';
  }

  function heldItemMarkup(heldKey, g) {
    const draw = heldKey && HELD_ITEM_ART[heldKey];
    if (!draw) return '';
    const handX = g.armX[1] + g.armW / 2;
    const handY = g.armY + g.armH;
    return `
  <g transform="translate(${handX} ${handY}) rotate(18)">${draw()}</g>`;
  }

  /**
   * @param {1|2|3} tier - phase id; anything else falls back to tier 1.
   * @param {{bodyColor?: string, head?: string, accessory?: string, heldItem?: string}} [options]
   *   head/accessory are equipped shop_item keys; heldItem is the rank's
   *   free_item key. Unknown or missing keys simply draw nothing.
   * @returns {string} standalone SVG markup
   */
  function renderSVG(tier, options) {
    const g = GEOMETRY[tier] || GEOMETRY[1];
    const opts = options || {};
    const color = opts.bodyColor || DEFAULT_COLOR;

    const bicep = g.bicep ? `
  <circle cx="${g.armX[0] + g.armW / 2}" cy="${g.bicep.cy}" r="${g.bicep.r}" fill="${color}" stroke="${INK}" stroke-width="2.5"/>
  <circle cx="${g.armX[1] + g.armW / 2}" cy="${g.bicep.cy}" r="${g.bicep.r}" fill="${color}" stroke="${INK}" stroke-width="2.5"/>` : '';

    const accessoryBack = accessoryMarkup(ACCESSORY_BACK_ART, opts.accessory, g);
    const accessoryFront = accessoryMarkup(ACCESSORY_FRONT_ART, opts.accessory, g);
    const headItem = headItemMarkup(opts.head);
    const heldItem = heldItemMarkup(opts.heldItem, g);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 210" width="100%" height="100%" role="img" aria-label="Your Quest Log hero">
  <ellipse cx="${CX}" cy="188" rx="${g.shadowRx}" ry="5" fill="${INK}" opacity="0.15"/>${accessoryBack}
  <rect x="${g.legX[0]}" y="${g.legY}" width="${g.legW}" height="${g.legH}" rx="${g.legRx}" fill="${color}" stroke="${INK}" stroke-width="3"/>
  <rect x="${g.legX[1]}" y="${g.legY}" width="${g.legW}" height="${g.legH}" rx="${g.legRx}" fill="${color}" stroke="${INK}" stroke-width="3"/>
  <rect x="${g.footX[0]}" y="${g.footY}" width="${g.footW}" height="${g.footH}" rx="${g.footRx}" fill="${INK}"/>
  <rect x="${g.footX[1]}" y="${g.footY}" width="${g.footW}" height="${g.footH}" rx="${g.footRx}" fill="${INK}"/>
  <rect x="${g.armX[0]}" y="${g.armY}" width="${g.armW}" height="${g.armH}" rx="${g.armRx}" fill="${color}" stroke="${INK}" stroke-width="3"/>
  <rect x="${g.armX[1]}" y="${g.armY}" width="${g.armW}" height="${g.armH}" rx="${g.armRx}" fill="${color}" stroke="${INK}" stroke-width="3"/>${bicep}
  <polygon points="${g.shoulderL},${g.torsoTop} ${g.shoulderR},${g.torsoTop} ${g.waistR},${g.torsoBottom} ${g.waistL},${g.torsoBottom}" fill="${color}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>${accessoryFront}
  <circle cx="${CX}" cy="34" r="20" fill="${color}" stroke="${INK}" stroke-width="3.5"/>
  <circle cx="${CX - 6}" cy="32" r="2.3" fill="${INK}"/>
  <circle cx="${CX + 6}" cy="32" r="2.3" fill="${INK}"/>
  <path d="M ${CX - 8} 40 Q ${CX} 45 ${CX + 8} 40" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>${headItem}${heldItem}
</svg>`;
  }

  global.QuestCharacter = { renderSVG, DEFAULT_COLOR };
})(window);
