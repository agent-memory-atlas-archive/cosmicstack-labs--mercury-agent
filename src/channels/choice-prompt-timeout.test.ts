import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CLIChannel } from './cli.js';

const agentSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'core', 'agent.ts'), 'utf8');

/**
 * Time-weighted prompts: an unanswered question must be answered FOR the user
 * (default = No) and the visible prompt box must disappear — the request flow
 * is never left blocked on input nobody will give.
 */
describe('choice prompt timeout / dismissal', () => {
  it('resolveChoicePromptWithDefault resolves a pending choice prompt and clears it', async () => {
    const channel = new CLIChannel();
    const pending = channel.presentChoicePrompt('Proceed?', [
      { value: '0', label: 'Yes' },
      { value: '1', label: 'No' },
    ]);
    // The prompt is visible while pending.
    expect(channel.getTuiState().permissionPrompt).not.toBeNull();

    channel.resolveChoicePromptWithDefault('1');

    expect(await pending).toBe('1');
    expect(channel.getTuiState().permissionPrompt).toBeNull();
  });

  it('is a no-op when no prompt is pending', () => {
    const channel = new CLIChannel();
    expect(() => channel.resolveChoicePromptWithDefault('0')).not.toThrow();
    expect(channel.getTuiState().permissionPrompt).toBeNull();
  });

  it('agent: the hand-off prompt continues the work on BOTH answers (non-blocking)', () => {
    // The timeout default index must be the "No" choice.
    expect(agentSrc).toMatch(/MERCURY_CODE_HANDOFF_TIMEOUT_MS,\s*\n\s*1, \/\/ time-weighted default: No/);
    // Yes → Mercury Code + continue; No → normal chat. Either way the
    // original message is queued and processed (never dropped, never blocked).
    expect(agentSrc).toContain('promptMercuryCodeHandoff');
    expect(agentSrc).toMatch(/promptMercuryCodeHandoff\(channel: CLIChannel[\s\S]*?this\.queueMessage\(msg, workKey\);\s*\n\s*this\.processQueue\(\);/s);
  });

  it('agent: the choice is remembered PER SESSION and every auto-switch explains itself', () => {
    // Preference keyed by the canonical session id → a new session asks again.
    expect(agentSrc).toMatch(/getOrCreateBound\(msg\.channelType, 'current'[\s\S]*?\.id;\s*\n\s*const remembered = /s);
    expect(agentSrc).toContain('mercuryCodeHandoffPreferences');
    // Remembered "No" → never asks this session.
    expect(agentSrc).toMatch(/remembered === 'chat'[\s\S]*?this\.queueMessage\(msg, workKey\);\s*\n\s*this\.processQueue\(\);/s);
    // Remembered "Yes" → auto-switch WITH the reason.
    expect(agentSrc).toMatch(/remembered === 'code'[\s\S]*?you chose it for coding tasks earlier this session/s);
    // Timeout is NOT a choice — nothing remembered when nobody answers.
    expect(agentSrc).toContain('not remembered — nobody answered');
  });
});