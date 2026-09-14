import rawTips from './tips.json';

/**
 * "Did you know?" tips — a curated, surface-categorized perk shown SPARINGLY
 * in the system's own voice (never as an LLM message).
 *
 * Anti-nag rules: round-robin rotation with a random start (no tip repeats
 * until the pool has cycled), a hard minimum gap between tips per surface,
 * and at most a couple of tips per running task in Mercury Code.
 */

export interface Tip {
  id: string;
  surfaces: Array<'code' | 'chat'>;
  tip: string;
}

export const TIPS = rawTips as Tip[];

/** Minimum wall-clock gap between tips on the same surface. */
export const TIP_MIN_GAP_MS = 5 * 60 * 1000;

const tipsFor = (surface: 'code' | 'chat'): Tip[] => TIPS.filter((tip) => tip.surfaces.includes(surface));

// Round-robin cursors: one per surface, random start per runtime so different
// sessions start on different tips; every tip shows before any repeats.
const cursors: Record<string, number> = { code: Math.floor(Math.random() * 6), chat: Math.floor(Math.random() * 7) };
const lastShownAt: Record<string, number> = { code: 0, chat: 0 };
const lastShownId: Record<string, string | null> = { code: null, chat: null };

/**
 * Next tip for a surface: round-robin through the pool (never repeating until
 * every tip has shown), with a hard minimum gap — null when the gap has not
 * elapsed (callers stay silent).
 */
export function nextTip(surface: 'code' | 'chat', now = Date.now()): Tip | null {
  const pool = tipsFor(surface);
  if (pool.length === 0) return null;
  if (now - (lastShownAt[surface] ?? 0) < TIP_MIN_GAP_MS) return null;
  const index = cursors[surface]! % pool.length;
  const tip = pool[index]!;
  cursors[surface] = (index + 1) % pool.length;
  lastShownAt[surface] = now;
  lastShownId[surface] = tip.id;
  return tip;
}

/** The id of the tip most recently shown on a surface (for the rotating row). */
export function lastTipId(surface: 'code' | 'chat'): string | null {
  return lastShownId[surface];
}

/**
 * Rotate the CONTENT of an already-visible tip row (the row's height must
 * not churn): moves to the next tip in the pool, skipping the one currently
 * shown. Unlike nextTip, no time gate — the row is already on screen.
 */
export function rotateTip(surface: 'code' | 'chat'): Tip | null {
  const pool = tipsFor(surface);
  if (pool.length === 0) return null;
  const index = cursors[surface]! % pool.length;
  const tip = pool[index]!;
  cursors[surface] = (index + 1) % pool.length;
  lastShownId[surface] = tip.id;
  return tip;
}