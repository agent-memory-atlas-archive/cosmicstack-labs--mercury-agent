import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isNewerVersion,
  latestSeenUpdate,
  markWhatsNewHintShown,
  maybeCheckForUpdate,
  shouldShowWhatsNewHint,
  ignoreUpdateVersion,
} from './update-notice.js';
import { whatsNewText } from '../utils/whats-new.js';

// The helpers persist to ~/.mercury — point MERCURY_HOME at a temp dir so
// tests never touch the real state file. The dir must exist (saveUpdateState
// refuses to recreate a torn-down home by design).
const tempHome = join(tmpdir(), `mercury-update-notice-test-${process.pid}`);

beforeEach(() => {
  mkdirSync(tempHome, { recursive: true });
  process.env.MERCURY_HOME = tempHome;
});

afterEach(() => {
  delete process.env.MERCURY_HOME;
  rmSync(tempHome, { recursive: true, force: true });
});

/**
 * Anti-nag contract: the /whatsnew hint fires ONCE per version (first launch
 * or update), the update check is throttled and silent about ignored
 * versions, and nothing ever blocks or repeats.
 */
describe('update-notice (graceful, once-per-version)', () => {
  it('shows the hint on first launch ever, then never again for the same version', () => {
    expect(shouldShowHelper('1.2.9')).toBe(true); // first launch ever
    markWhatsNewHintShown('1.2.9');
    expect(shouldShowHelper('1.2.9')).toBe(false); // same version → silent
    expect(shouldShowHelper('1.3.0')).toBe(true); // update → one new hint
    markWhatsNewHintShown('1.3.0');
    expect(shouldShowHelper('1.3.0')).toBe(false);
  });

  it('never shows the hint after a DOWNGRADE (rollbacks are not "new")', () => {
    markWhatsNewHintShown('1.3.0');
    expect(shouldShowHelper('1.2.3')).toBe(false);
  });

  it('compares versions numerically (not lexically)', () => {
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true);
    expect(isNewerVersion('1.9.0', '1.10.0')).toBe(false);
    expect(isNewerVersion('1.2.9', '1.2.9')).toBe(false);
    expect(isNewerVersion('v1.3.0', '1.2.9')).toBe(true);
  });

  it('update check is throttled and respects the ignored version (no network)', async () => {
    // Pre-seed a throttled state (checked just now) with a newer version —
    // maybeCheckForUpdate must reuse it without touching npm.
    const { saveUpdateState } = await import('./update-notice.js');
    saveUpdateState({ checkedAt: Date.now(), latestSeen: '2.0.0' });
    expect(await maybeCheckForUpdate('1.2.9')).toBe('2.0.0');

    // Ignoring the offered version silences it.
    ignoreUpdateVersion('2.0.0');
    expect(await maybeCheckForUpdate('1.2.9')).toBeNull();

    // A DIFFERENT newer version is still offered.
    saveUpdateState({ checkedAt: Date.now(), latestSeen: '2.1.0', ignoredUpdate: '2.0.0' });
    expect(await maybeCheckForUpdate('1.2.9')).toBe('2.1.0');
  });

  it('latestSeenUpdate only reports versions newer than the running one', async () => {
    const { saveUpdateState } = await import('./update-notice.js');
    saveUpdateState({ checkedAt: Date.now(), latestSeen: '2.1.0' });
    expect(latestSeenUpdate('1.2.9')).toBe('2.1.0');
    saveUpdateState({ checkedAt: Date.now(), latestSeen: '1.2.9' });
    expect(latestSeenUpdate('1.2.9')).toBeNull();
  });
});

describe('/whatsnew content', () => {
  it('renders action-grouped sections (Added / Updated / Fixed) for a published version', () => {
    const text = whatsNewText('1.2.6');
    expect(text).toContain("**Mercury v1.2.6 — what's new**");
    expect(text).toContain('**Added**');
    expect(text).toContain('• **Progressive streaming**');
    expect(text).toContain('**Updated**');
    expect(text).toContain('**Fixed**');
  });

  it('prints the release-notes URL at the bottom (exact tag + all releases)', () => {
    const text = whatsNewText('1.2.6');
    const lines = text.split('\n');
    expect(lines[lines.length - 2]).toBe('Release notes: https://github.com/cosmicstack-labs/mercury-agent/releases/tag/v1.2.6');
    expect(lines[lines.length - 1]).toBe('All releases:  https://github.com/cosmicstack-labs/mercury-agent/releases');
  });

  it('falls back to the release-notes links for unknown versions', () => {
    const text = whatsNewText('9.9.9');
    expect(text).toContain('not published yet');
    expect(text).toContain('releases/tag/v9.9.9');
  });
});

function shouldShowHelper(v: string): boolean {
  return shouldShowWhatsNewHint(v);
}