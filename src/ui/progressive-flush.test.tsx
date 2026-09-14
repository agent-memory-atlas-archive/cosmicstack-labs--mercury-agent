import { describe, expect, it, vi } from 'vitest';

// Ink skips ALL frame writes when it detects CI (`is-in-ci` → process.env.CI).
// Setting CI to '0' (the one value is-in-ci treats as false) BEFORE the ink
// module loads restores normal rendering.
vi.hoisted(() => {
  process.env.CI = '0';
});

import React from 'react';
import { render, Box, Text } from 'ink';
import { EventEmitter } from 'node:events';
import { MercuryCodeView } from './App.js';
import type { TuiState } from '../channels/cli.js';
import type { ChatMessage } from './types.js';

class FakeStdout extends EventEmitter {
  chunks: string[] = [];
  columns = 80;
  rows = 24;
  isTTY = true;
  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }
  get output(): string {
    return this.chunks.join('');
  }
}

class FakeStdin extends EventEmitter {
  setEncoding(): void {}
  setRawMode(): void {}
  resume(): void {}
  pause(): void {}
  ref(): void {}
  unref(): void {}
  isTTY = true;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/**
 * Progressive streaming flush, against the REAL patched ink.
 *
 * Settled markdown blocks (blank-line-terminated paragraphs, closed code
 * fences) must join <Static> DURING the stream so the document builds
 * top-to-bottom in native scrollback — instead of appearing only when the
 * message finalizes. <Static> prints each item exactly once, so every block
 * must appear in the byte stream EXACTLY ONCE across growth and finalization:
 * the item keys produced while streaming are the same keys the finalized
 * message re-derives, and only the tail chunk is new.
 */
describe('Mercury Code progressive streaming flush', () => {
  const BLOCK1 = '# Design Notes\n\nThe gateway now owns token refresh.\n\n';
  const BLOCK2 = '## Rollout\n\nShip behind a feature flag this week.\n\n';
  const TAIL = 'The dashboard reads the flag on boot.';

  const stateFor = (content: string, streaming: boolean): TuiState => ({
    mode: 'mercury-code',
    version: '1.2.5',
    agentName: 'Mercury',
    programmingMode: 'execute',
    projectContext: '/tmp/proj',
    permissionMode: 'allow-all',
    chatMessages: [
      { id: 'u1', role: 'user', content: 'write the design notes', timestamp: 1 },
      { id: 'a1', role: 'agent', content, timestamp: 2, streaming },
    ] as ChatMessage[],
    toolSteps: [],
    subAgents: [],
    planProgress: [],
    backgroundTasks: [],
    skills: [],
    sidebarSections: [],
    mercuryCode: {
      cwd: '/tmp/proj', dirName: 'proj', git: { branch: 'main', ahead: 0, behind: 0, dirty: 0 },
      scrollOffset: 0, exitConfirm: false,
    },
    tuiFrozen: false,
    isThinking: !streaming,
  } as unknown as TuiState);

  it('prints settled blocks once during streaming and exactly once more item at finalization', async () => {
    const stdout = new FakeStdout() as any;
    const { rerender, unmount } = render(
      React.createElement(
        Box,
        { flexDirection: 'column' },
        React.createElement(MercuryCodeView, { state: stateFor(BLOCK1 + 'Ship behind', true), cols: 100, rows: 24 }),
      ),
      { stdout, exitOnCtrlC: false, patchConsole: false },
    );
    await sleep(400);

    // Block 1 is settled (blank-line-terminated, content continues after) —
    // it has joined <Static>, exactly once.
    expect(count(stdout.output, 'owns token refresh')).toBe(1);
    // The in-progress remainder is in the live tail.
    expect(count(stdout.output, 'Ship behind')).toBe(1);

    // Growth: block 2 settles and prints; block 1 must NOT re-print.
    rerender(
      React.createElement(
        Box,
        { flexDirection: 'column' },
        React.createElement(MercuryCodeView, { state: stateFor(BLOCK1 + BLOCK2 + 'The dashboard reads', true), cols: 100, rows: 24 }),
      ),
    );
    await sleep(400);
    expect(count(stdout.output, 'owns token refresh')).toBe(1);
    expect(count(stdout.output, 'feature flag this week')).toBe(1);
    // The old in-progress text was part of block 2's <Static> print now; the
    // new remainder is the tail sentence.
    expect(stdout.output).not.toContain('\x1b[3J');

    // Finalization: the tail chunk prints exactly once; nothing re-prints.
    rerender(
      React.createElement(
        Box,
        { flexDirection: 'column' },
        React.createElement(MercuryCodeView, { state: stateFor(BLOCK1 + BLOCK2 + TAIL, false), cols: 100, rows: 24 }),
      ),
    );
    await sleep(400);
    expect(count(stdout.output, 'owns token refresh')).toBe(1);
    expect(count(stdout.output, 'feature flag this week')).toBe(1);
    expect(count(stdout.output, 'dashboard reads the flag on boot')).toBe(1);
    expect(stdout.output).not.toContain('\x1b[3J');

    unmount();
  }, 15_000);

  it('a message with no settled blocks streams entirely in the live region (unchanged behavior)', async () => {
    const stdout = new FakeStdout() as any;
    const content = Array.from({ length: 40 }, (_, i) => `unbroken line ${i}`).join('\n'); // no blank lines, no fences
    const { rerender, unmount } = render(
      React.createElement(
        Box,
        { flexDirection: 'column' },
        React.createElement(MercuryCodeView, { state: stateFor(content, true), cols: 100, rows: 24 }),
      ),
      { stdout, exitOnCtrlC: false, patchConsole: false },
    );
    await sleep(400);
    // Everything stays in the live tail (capped): newest rows visible.
    expect(stdout.output).toContain('unbroken line 39');
    expect(stdout.output).not.toContain('\x1b[3J');
    void rerender;
    unmount();
  }, 15_000);
});