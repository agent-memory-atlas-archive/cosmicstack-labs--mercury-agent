import { describe, expect, it } from 'vitest';
import { REPO_ISSUES_URL, FEEDBACK_EMAIL, findNpmInstalls, npmGlobalRoots, shellRcFiles, stripInstallerPathLines } from './uninstall.js';
import { existsSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * `mercury uninstall` contract: channel- and platform-aware full teardown.
 * The destructive steps are exercised manually (they delete real files); the
 * pure detection/cleanup pieces are unit-tested here.
 */
describe('mercury uninstall', () => {
  it('strips the installer PATH line and marker from an rc file, leaving the rest intact', () => {
    const rc = [
      '# ~/.zshrc',
      'export EDITOR=vim',
      '',
      '# added by mercury installer',
      'export PATH="/Users/me/.mercury/bin:$PATH"',
      'alias ll="ls -la"',
    ].join('\n');

    const stripped = stripInstallerPathLines(rc, '/Users/me/.mercury/bin');

    expect(stripped).toBe(['# ~/.zshrc', 'export EDITOR=vim', '', 'alias ll="ls -la"'].join('\n'));
  });

  it('returns null when the rc file has nothing to strip (no rewrite)', () => {
    expect(stripInstallerPathLines('export PATH=/usr/bin:/bin\n', '/Users/me/.mercury/bin')).toBeNull();
  });

  it('strips the fish-shell PATH form too', () => {
    const rc = ['set -gx PATH /Users/me/.mercury/bin $PATH', '# added by mercury installer'].join('\n');
    const stripped = stripInstallerPathLines(rc, '/Users/me/.mercury/bin');
    expect(stripped).toBe('');
  });

  it('discovers a real global npm install under nvm-managed node versions', () => {
    // The dev machine has a stale global install (see the running npm daemon) —
    // the scan must find it so the uninstaller can remove it.
    const installs = findNpmInstalls();
    const found = [...installs.global, ...installs.local];
    expect(found.length).toBeGreaterThan(0);
    for (const path of found) expect(existsSync(path)).toBe(true);
  });

  it('npmGlobalRoots includes the active npm root', () => {
    const roots = npmGlobalRoots();
    expect(roots.length).toBeGreaterThan(0);
  });

  it('exposes the support links shown at the end of the uninstaller', () => {
    expect(REPO_ISSUES_URL).toContain('cosmicstack-labs/mercury-agent/issues');
    expect(FEEDBACK_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
  });

  it('shellRcFiles returns an array (rc files may or may not exist)', () => {
    expect(Array.isArray(shellRcFiles())).toBe(true);
  });
});

describe('stripInstallerPathLines edge cases', () => {
  const binDir = '/tmp/mercury-uninstall-test/bin';
  const rcPath = join(tmpdir(), `mercury-uninstall-test-${process.pid}.rc`);

  it('round-trips a real file rewrite', () => {
    writeFileSync(rcPath, ['# rc', '# added by mercury installer', `export PATH="${binDir}:$PATH"`, 'true'].join('\n'));
    const stripped = stripInstallerPathLines(readFileSync(rcPath, 'utf-8'), binDir);
    expect(stripped).not.toBeNull();
    writeFileSync(rcPath, stripped!, 'utf-8');
    expect(readFileSync(rcPath, 'utf-8')).toBe(['# rc', 'true'].join('\n'));
    rmSync(rcPath, { force: true });
  });

  it('keeps unrelated PATH lines that merely share a prefix with the bin dir', () => {
    const rc = [`export PATH="${binDir}-backup:$PATH"`, `export PATH="${binDir}:$PATH"`].join('\n');
    const stripped = stripInstallerPathLines(rc, binDir);
    expect(stripped).toBe(`export PATH="${binDir}-backup:$PATH"`);
  });
});