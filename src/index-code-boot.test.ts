import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.ts'), 'utf8');

/**
 * `mercury code [dir]` contract: a dedicated CLI command that boots the TUI
 * straight into Mercury Code in the given (default: current) directory with a
 * FRESH session — the terminal equivalent of typing /code after launch.
 */
describe('mercury code launcher', () => {
  it('registers a dedicated code command with a fresh-session boot', () => {
    expect(src).toContain(".command('code')");
    // Fresh session: create + bind to the CLI current binding, and surface it.
    expect(src).toContain('sessions.create()');
    expect(src).toContain("sessions.bind(fresh.id, 'cli', 'current')");
    expect(src).toContain('bootCli.setCurrentSession(activeSession)');
    // Boots into Mercury Code with the AUTO programming flow, mirroring /code.
    expect(src).toContain('bootCli.enterMercuryCode(bootDir, pkgVersion)');
    expect(src).toContain('agent.programmingMode.setAuto()');
  });

  it('passes the boot flag only to the foreground TUI process', () => {
    // The flag is set by the command action and consumed in runAgent's
    // !isDaemon path — the daemon child must never enter Mercury Code.
    expect(src).toContain('process.env.MERCURY_BOOT_CODE');
    expect(src).toMatch(/if \(!isDaemon\) \{[\s\S]*?MERCURY_BOOT_CODE/s);
  });
});