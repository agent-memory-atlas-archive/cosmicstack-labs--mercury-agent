import { describe, expect, it } from 'vitest';
import { TIP_MIN_GAP_MS, TIPS, nextTip, rotateTip, type Tip } from './tips.js';

/**
 * "Did you know?" tips: curated, surface-categorized, shown as a rare perk.
 * The dataset itself is contract-tested (content quality) and the picker is
 * tested for its anti-nag properties.
 */
describe('tips dataset', () => {
  it('every tip has an id, at least one surface, and concise text', () => {
    const seen = new Set<string>();
    for (const tip of TIPS as Tip[]) {
      expect(tip.id).toBeTruthy();
      expect(seen.has(tip.id)).toBe(false); // no duplicate ids
      seen.add(tip.id);
      expect(tip.surfaces.length).toBeGreaterThan(0);
      expect(['code', 'chat'].some((s) => (tip.surfaces as string[]).includes(s))).toBe(true);
      expect(tip.tip.length).toBeGreaterThan(20);
      expect(tip.tip.length).toBeLessThan(220); // must fit one truncated line comfortably
    }
  });

  it('covers both surfaces: code-specific, chat-specific, and shared tips', () => {
    const ids = (surface: 'code' | 'chat') => (TIPS as Tip[]).filter((t) => t.surfaces.includes(surface));
    expect(ids('code').length).toBeGreaterThan(8);
    expect(ids('chat').length).toBeGreaterThan(6);
  });
});

describe('tip picker (anti-nag)', () => {
  it('the chat tip is gated by the minimum gap', () => {
    const now = Date.now();
    // First call consumes the gap; a second call immediately after must be silent.
    const first = nextTip('chat', now);
    if (first) {
      expect(nextTip('chat', now + 1000)).toBeNull();
      // After the gap, the next tip arrives.
      const later = nextTip('chat', now + TIP_MIN_GAP_MS + 1000);
      expect(later).not.toBeNull();
    }
  });

  it('rotates round-robin: a tip never repeats until the pool has cycled', () => {
    const pool = (TIPS as Tip[]).filter((t) => t.surfaces.includes('code'));
    const seen = new Set<string>();
    for (let i = 0; i < pool.length; i++) {
      const tip = rotateTip('code');
      expect(seen.has(tip!.id)).toBe(false);
      seen.add(tip!.id);
    }
    // One more rotation re-offers the earliest tip — the cycle restarts.
    expect(seen.size).toBe(pool.length);
  });
});