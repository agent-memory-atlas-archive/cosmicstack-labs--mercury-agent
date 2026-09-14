import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = (p: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), p), 'utf8');

/**
 * "Respect the last default change" contract. Three defects used to conspire
 * into silently overriding the provider the user chose in `mercury doctor`:
 *
 *  1. `/models use` mutated the in-memory config only — the switch was lost
 *     on restart (or half-persisted by an unrelated saveConfig).
 *  2. The fallback chain tried Mercury Cloud FIRST (registration order) and
 *     markSuccess then stuck to it for every following turn — silently.
 *  3. The doctor's Connection Mode selector always highlighted 'cloud', so
 *     pressing Enter re-paired the cloud and reset the default to mercuryCloud.
 *
 * The runtime fixes live in agent.ts / registry.ts (unit-tested there); these
 * source assertions pin the wiring so a refactor can't quietly drop them.
 */
describe('default provider is respected', () => {
  it('agent: /models use persists the switch via saveConfig', () => {
    const agent = src('agent.ts');
    // The persisted message must say so — no silent session-only mutation.
    expect(agent).toContain('Default model switched to');
    expect(agent).toContain('Saved for future sessions');
    // switchSessionProvider saves after rebuilding the registry.
    expect(agent).toMatch(/saveConfig\(this\.config\);\s*\n\s*updateCliProviderStatus\(this\.channels\.get\('cli'\), providerName, model\);/);
  });

  it('agent: fallback to a non-default provider is surfaced to the user, not silent', () => {
    const agent = src('agent.ts');
    expect(agent).toContain('lastFallbackNoticeKey');
    expect(agent).toContain('Configured default');
  });

  it('doctor: Connection Mode highlights the current mode, Enter keeps the current default', () => {
    const index = src('../index.ts');
    expect(index).toContain('const inCloudMode');
    expect(index).toContain("configured.includes(config.providers.default)");
  });
});