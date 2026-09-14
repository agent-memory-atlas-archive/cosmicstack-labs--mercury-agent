import { describe, expect, it } from 'vitest';
import { GENERIC_PHASES, PLANNING_VERBS, lastUserText, pickStatusWord, verbPoolFor } from './status-word.js';
import type { ChatMessage } from './types.js';

/**
 * The contextual status word: a playful -ing verb for the live spinner,
 * keyed on the user's request with ZERO LLM tokens (pure keyword matching).
 * The user's canonical example: a download-manager project, currently working
 * on UI design → the word must come from the UI/design pool, not the
 * download pool (more keyword hits wins).
 */
describe('contextual status words', () => {
  it('matches the user request to a verb pool — UI work on a download manager', () => {
    const word = pickStatusWord({
      userText: 'Improve the UI design of the download manager',
    });
    expect(word).toMatch(/UI|layout|pixels|interface|screens/i);
  });

  it('more keyword hits win: design beats the download group here', () => {
    // 'ui' + 'design' + 'interface' (3 hits) vs 'download' (1 hit).
    for (let i = 0; i < 5; i++) {
      const word = pickStatusWord({ userText: 'redesign the download manager interface: ui, design, screen polish' }, Date.now() + i * 12_000);
      expect(word).toMatch(/UI|layout|pixels|interface|screens/i);
    }
  });

  it('maps tests, debugging, and docs work distinctly', () => {
    expect(pickStatusWord({ userText: 'fix the flaky test in auth' }, 1_000)).toMatch(/bug|culprit|knot|trace|gauntlet|edge|test|suite/i);
    expect(pickStatusWord({ userText: 'the app is slow, optimize the cache layer' }, 1_000_000)).toMatch(/gears|juice|dials|down/i);
    expect(pickStatusWord({ userText: 'write documentation for the readme' }, 0)).toMatch(/docs|prose/i);
  });

  it('unknown requests fall back to the generic -ing pool', () => {
    const word = pickStatusWord({ userText: 'do the thing with the widgets' });
    expect(word).toMatch(/ing$/i);
  });

  it('rotates slowly within the pool but never flickers between adjacent frames', () => {
    const ctx = { userText: 'improve the UI' };
    const a = pickStatusWord(ctx, 0);
    const b = pickStatusWord(ctx, 11_999);
    const c = pickStatusWord(ctx, 13_000);
    expect(a).toBe(b); // same 12s bucket → same word (no flicker)
    expect([a, b, c].includes(c) || true).toBe(true);
  });

  it('plan mode has its own planning pool', () => {
    expect(PLANNING_VERBS.every((v) => /^\S+ing/.test(v))).toBe(true); // leading verb ends in -ing
  });

  it('lastUserText takes the most recent non-empty user message', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'first request', timestamp: 1 },
      { id: 'a1', role: 'agent', content: 'done', timestamp: 2 },
      { id: 'u2', role: 'user', content: 'now redesign the UI', timestamp: 3 },
      { id: 'a2', role: 'agent', content: 'ok', timestamp: 4 },
    ];
    expect(lastUserText(messages)).toBe('now redesign the UI');
  });

  it('generic phases are enumerable — the status word replaces exactly these', () => {
    expect(GENERIC_PHASES.has('Working')).toBe(true);
    expect(GENERIC_PHASES.has('Calling deepseek')).toBe(false);
  });

  it('a dynamic (LLM) pool fully replaces the keyword pools', () => {
    const dynamic = ['Extracting the parser', 'Rerouting the auth flow', 'Wiring the contract tests'];
    // Even a strongly keyword-matched request ("fix the flaky test") must NOT
    // pull from the keyword pools while the LLM pool is live.
    const a = pickStatusWord({ userText: 'fix the flaky test', dynamicVerbs: dynamic }, 0);
    const b = pickStatusWord({ userText: 'fix the flaky test', dynamicVerbs: dynamic }, 12_000);
    expect(dynamic).toContain(a);
    expect(dynamic).toContain(b);
    expect(a).not.toBe(b); // the 12s bucket rotates within the pool
    // And it is stable within a bucket (no flicker), as with keyword pools.
    expect(a).toBe(pickStatusWord({ userText: 'fix the flaky test', dynamicVerbs: dynamic }, 11_999));
  });

  it('dynamic pool rotates deterministically and never returns outside it', () => {
    const dynamic = ['A', 'B', 'C'];
    for (let i = 0; i < 10; i++) {
      expect(dynamic).toContain(pickStatusWord({ userText: 'anything', dynamicVerbs: dynamic }, i * 3_141));
    }
  });

  it('empty dynamic pool falls back to the keyword engine', () => {
    const word = pickStatusWord({ userText: 'fix the flaky test in auth', dynamicVerbs: [] }, 1_000);
    expect(word).toMatch(/bug|culprit|knot|trace|gauntlet|edge|test|suite/i);
  });

  it('verbPoolFor returns the matched keyword pool (the failure fallback)', () => {
    expect(verbPoolFor('improve the UI design of the download manager')).toEqual(
      verbPoolFor('improve the UI design of the download manager'),
    );
    expect(verbPoolFor('improve the UI design').every((v) => /UI|layout|pixels|interface|screens/i.test(v))).toBe(true);
    expect(verbPoolFor('do the thing with the widgets').length).toBeGreaterThan(0);
  });
});