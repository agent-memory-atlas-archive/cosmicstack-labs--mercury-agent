import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// This test lives in src/, so dirname is already the src directory.
const root = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(root, 'ui', 'App.tsx'), 'utf8');
const manualSrc = readFileSync(join(root, 'utils', 'manual.ts'), 'utf8');

/**
 * Slash-command sync contract: every real chat command must appear in the
 * TUI's autocomplete list (ui/App.tsx `slashCommands`) and in the manual.
 * New commands are easy to ship and forget to suggest — this test fails
 * until they are added everywhere.
 */
describe('slash autocomplete & help stay in sync', () => {
  it('the TUI autocomplete covers the recently added commands', () => {
    for (const cmd of [
      '/whatsnew',
      '/update ignore',
      '/log',
      '/code chat',
      '/code back',
    ]) {
      expect(appSrc).toContain(`'${cmd}'`);
    }
  });

  it('the manual documents the background-task, model, and budget commands', () => {
    for (const entry of [
      "['/bg current',",
      "['/bg list',",
      "['/bg cancel <id>',",
      "['/bg clear',",
      "['/bg killall',",
      "['/budget',",
      "['/models',",
      "['/models use <provider>',",
      "['/cloud models',",
      "['/cloud use <model-id>',",
      "['/log',",
    ]) {
      expect(manualSrc).toContain(entry);
    }
  });

  it('dead commands are not documented (no dispatcher → no manual entry)', () => {
    // /tasks was documented but never dispatched — removed.
    expect(manualSrc).not.toContain("['/tasks',");
  });

  it('the channel help texts mention the new commands', () => {
    // Telegram + Discord share the same list layout; Slack uses /mercury prefix.
    for (const marker of ['whatsnew', 'update ignore', '/bg current']) {
      expect(manualSrc).toContain(marker);
    }
    expect(manualSrc).toContain('/mercury whatsnew');
  });
});