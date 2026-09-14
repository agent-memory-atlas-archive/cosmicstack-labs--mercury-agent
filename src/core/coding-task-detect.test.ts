import { describe, expect, it } from 'vitest';
import { MERCURY_CODE_HANDOFF_TIMEOUT_MS, looksLikeCodingTask } from './agent.js';

/**
 * The chat → Mercury Code hand-off prompt keys on this detector. It must be
 * conservative: coding-shaped build/repair work prompts, concept chat and
 * short chatter never do.
 */
describe('looksLikeCodingTask', () => {
  it('matches build/repair work on a codebase', () => {
    expect(looksLikeCodingTask('fix the bug in the auth module')).toBe(true);
    expect(looksLikeCodingTask('build a download manager app')).toBe(true);
    expect(looksLikeCodingTask('add a login feature to the app')).toBe(true);
    expect(looksLikeCodingTask('refactor the database layer and clean up the schema')).toBe(true);
    expect(looksLikeCodingTask('implement the /health endpoint')).toBe(true);
  });

  it('matches source-file paths and package commands', () => {
    expect(looksLikeCodingTask('please look at src/core/agent.ts and clean it up')).toBe(true);
    expect(looksLikeCodingTask('npm install is failing in my repo')).toBe(true);
    expect(looksLikeCodingTask('git status shows broken tests in tests/app.py')).toBe(true);
  });

  it('never prompts for concept chat or greetings', () => {
    expect(looksLikeCodingTask('what is a pointer in C')).toBe(false);
    expect(looksLikeCodingTask('explain how recursion works')).toBe(false);
    expect(looksLikeCodingTask('who is the creator of javascript')).toBe(false);
    expect(looksLikeCodingTask('hello!')).toBe(false);
    expect(looksLikeCodingTask('how do I?')).toBe(false);
    expect(looksLikeCodingTask('/code')).toBe(false);
  });

  it('is time-weighted: the hand-off prompt has a bounded timeout', () => {
    expect(MERCURY_CODE_HANDOFF_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
    expect(MERCURY_CODE_HANDOFF_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });
});