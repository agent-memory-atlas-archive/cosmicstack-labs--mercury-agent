import { describe, expect, it } from 'vitest';
import {
  FIRST_REFRESH_AFTER_TURNS,
  REFRESH_INTERVAL_TURNS,
  buildStatusVerbPrompt,
  parseStatusVerbs,
  shouldRefreshStatusVerbs,
} from './status-verbs.js';

/**
 * Mercury Code's dynamic status verbs: the cadence gate keeps the one-shot
 * LLM call rare (first refresh after turn 2, then ≤1 per 5 turns, one
 * failure = off for the session) and the parser rejects exactly the generic
 * filler the user complained about ("building", "crafting", "noodling" for
 * work that isn't happening).
 */
describe('status-verb cadence gate', () => {
  const base = { inFlight: false, disabled: false };

  it('never fires on turn 1 — the session has no persona yet', () => {
    expect(shouldRefreshStatusVerbs({ ...base, turnCount: 1 }).refresh).toBe(false);
    expect(shouldRefreshStatusVerbs({ ...base, turnCount: 1 }).reason).toBe('too-early');
  });

  it('fires first after turn 2, then only every 5 turns', () => {
    expect(shouldRefreshStatusVerbs({ ...base, turnCount: FIRST_REFRESH_AFTER_TURNS }).refresh).toBe(true);
    for (let t = FIRST_REFRESH_AFTER_TURNS + 1; t < FIRST_REFRESH_AFTER_TURNS + REFRESH_INTERVAL_TURNS; t++) {
      const gate = shouldRefreshStatusVerbs({ ...base, turnCount: t });
      expect(gate.refresh).toBe(false);
      expect(gate.reason).toBe('not-due');
    }
    expect(shouldRefreshStatusVerbs({ ...base, turnCount: FIRST_REFRESH_AFTER_TURNS + REFRESH_INTERVAL_TURNS }).refresh).toBe(true);
  });

  it('skips while a refresh is in flight', () => {
    expect(shouldRefreshStatusVerbs({ turnCount: 2, inFlight: true, disabled: false }).reason).toBe('in-flight');
  });

  it('a failure disables the LLM layer for the session — no retry churn', () => {
    for (const turn of [2, 5, 7, 12, 100]) {
      const gate = shouldRefreshStatusVerbs({ turnCount: turn, inFlight: false, disabled: true });
      expect(gate.refresh).toBe(false);
      expect(gate.reason).toBe('disabled');
    }
  });
});

describe('status-verb prompt', () => {
  it('carries the requests, the project name, and recent activity', () => {
    const { system, prompt } = buildStatusVerbPrompt({
      userRequests: ['Improve the UI design of the download manager', 'Fix the flaky auth test'],
      projectName: 'download-manager',
      recentActivity: ['Reading src/auth.ts', 'Running tests'],
    });
    expect(prompt).toContain('download-manager');
    expect(prompt).toContain('Improve the UI design');
    expect(prompt).toContain('Fix the flaky auth test');
    expect(prompt).toContain('Running tests');
    // The contract the model must obey — no generic filler, -ing phrases, JSON.
    expect(system).toContain('present-participle');
    expect(system).toContain('do NOT write "building"');
    expect(system).toContain('JSON array');
  });

  it('truncates long requests and omits the activity line when absent', () => {
    const { prompt } = buildStatusVerbPrompt({
      userRequests: ['x'.repeat(500)],
      projectName: 'p',
    });
    expect(prompt).not.toContain('Recent activity');
    expect(prompt.length).toBeLessThan(600);
  });
});

describe('status-verb parsing', () => {
  it('accepts a good JSON pool of -ing phrases', () => {
    const good = [
      'Extracting the parser',
      'Rerouting the auth flow',
      'Wiring the contract tests',
      'Trimming the bundle',
      'Untangling the widget state',
      'Threading the queue worker',
      'Polishing the transcript',
    ];
    expect(parseStatusVerbs(JSON.stringify(good))).toEqual(good);
    // Tolerates markdown fences around the array.
    expect(parseStatusVerbs('```json\n' + JSON.stringify(good) + '\n```')).toEqual(good);
  });

  it('rejects the generic filler words the user complained about', () => {
    const filler = ['Building the thing', 'Crafting the solution', 'Noodling around', 'Working on it', 'Cooking something up', 'Brewing ideas', 'Processing data', 'Doodling shapes'];
    expect(parseStatusVerbs(JSON.stringify(filler))).toBeNull();
  });

  it('rejects non--ing leads, over-long phrases, and wrong shapes', () => {
    expect(parseStatusVerbs('["Fix the parser", "a", "b", "c", "d", "e"]')).toBeNull();
    expect(parseStatusVerbs(JSON.stringify(['Fix the parser', 'Run the tests', 'Read the file', 'Write the docs', 'Test the flow', 'Sort the list']))).toBeNull();
    expect(parseStatusVerbs('"just a string"')).toBeNull();
    expect(parseStatusVerbs('no json here')).toBeNull();
  });

  it('dedupes case-insensitively and requires the minimum pool size', () => {
    const six = ['Extracting the parser', 'Rerouting the auth flow', 'Wiring the tests', 'Trimming the bundle', 'Untangling the state', 'Threading the queue'];
    expect(parseStatusVerbs(JSON.stringify([...six, 'extracting the parser']))).toEqual(six);
    expect(parseStatusVerbs(JSON.stringify(six.slice(0, 5)))).toBeNull(); // below minimum
  });
});