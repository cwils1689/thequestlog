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

  /**
   * @param {1|2|3} tier - phase id; anything else falls back to tier 1.
   * @param {{bodyColor?: string}} [options]
   * @returns {string} standalone SVG markup
   */
  function renderSVG(tier, options) {
    const g = GEOMETRY[tier] || GEOMETRY[1];
    const color = (options && options.bodyColor) || DEFAULT_COLOR;

    const bicep = g.bicep ? `
  <circle cx="${g.armX[0] + g.armW / 2}" cy="${g.bicep.cy}" r="${g.bicep.r}" fill="${color}" stroke="${INK}" stroke-width="2.5"/>
  <circle cx="${g.armX[1] + g.armW / 2}" cy="${g.bicep.cy}" r="${g.bicep.r}" fill="${color}" stroke="${INK}" stroke-width="2.5"/>` : '';

    return `<svg viewBox="0 0 160 210" width="100%" height="100%" role="img" aria-label="Your Quest Log hero">
  <ellipse cx="${CX}" cy="188" rx="${g.shadowRx}" ry="5" fill="${INK}" opacity="0.15"/>
  <rect x="${g.legX[0]}" y="${g.legY}" width="${g.legW}" height="${g.legH}" rx="${g.legRx}" fill="${color}" stroke="${INK}" stroke-width="3"/>
  <rect x="${g.legX[1]}" y="${g.legY}" width="${g.legW}" height="${g.legH}" rx="${g.legRx}" fill="${color}" stroke="${INK}" stroke-width="3"/>
  <rect x="${g.footX[0]}" y="${g.footY}" width="${g.footW}" height="${g.footH}" rx="${g.footRx}" fill="${INK}"/>
  <rect x="${g.footX[1]}" y="${g.footY}" width="${g.footW}" height="${g.footH}" rx="${g.footRx}" fill="${INK}"/>
  <rect x="${g.armX[0]}" y="${g.armY}" width="${g.armW}" height="${g.armH}" rx="${g.armRx}" fill="${color}" stroke="${INK}" stroke-width="3"/>
  <rect x="${g.armX[1]}" y="${g.armY}" width="${g.armW}" height="${g.armH}" rx="${g.armRx}" fill="${color}" stroke="${INK}" stroke-width="3"/>${bicep}
  <polygon points="${g.shoulderL},${g.torsoTop} ${g.shoulderR},${g.torsoTop} ${g.waistR},${g.torsoBottom} ${g.waistL},${g.torsoBottom}" fill="${color}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <circle cx="${CX}" cy="34" r="20" fill="${color}" stroke="${INK}" stroke-width="3.5"/>
  <circle cx="${CX - 6}" cy="32" r="2.3" fill="${INK}"/>
  <circle cx="${CX + 6}" cy="32" r="2.3" fill="${INK}"/>
  <path d="M ${CX - 8} 40 Q ${CX} 45 ${CX + 8} 40" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`;
  }

  global.QuestCharacter = { renderSVG, DEFAULT_COLOR };
})(window);
