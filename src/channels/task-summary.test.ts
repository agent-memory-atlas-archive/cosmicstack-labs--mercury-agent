import { describe, expect, it } from 'vitest';
import { buildTaskSummary } from './cli.js';
import { buildMercuryMessageLines } from '../ui/mercury-transcript.js';
import { TASK_SUMMARY_FILE_LIMIT, type ChatMessage } from '../ui/types.js';

const files = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ path: `src/file-${i}.ts`, added: 10 + i, removed: i }));

/**
 * End-of-task summary in Mercury Code: files first (the developer's top
 * question is "what changed?"), then what was done, then the next steps.
 * A general chat turn that mutated no files carries no Changes section at all.
 */
describe('Mercury Code end-of-task summary', () => {
  it('lists Changes at the top with inline paths, then what was done, then next steps', () => {
    const summary = buildTaskSummary({
      fileChanges: [
        { path: 'src/a.ts', added: 45, removed: 12 },
        { path: 'src/b.ts', added: 3, removed: 1 },
      ],
      doneSteps: ['Read auth module', 'Refactor login flow'],
      verified: false,
      uncommitted: true,
    });

    // Changes renders FIRST — before "What was done".
    expect(summary.indexOf('**Changes**')).toBeLessThan(summary.indexOf('**What was done**'));
    expect(summary).toContain('**Changes** · 2 files');
    expect(summary).toContain('  ↳ src/a.ts · +45 −12'); // inline path attribution
    expect(summary).toContain('• Read auth module');
    expect(summary).toContain('**Next steps**');
    expect(summary).toContain('not verified yet');
    expect(summary).toContain('git diff');
  });

  it('a general chat turn (no file tools) produces NO Changes section', () => {
    const summary = buildTaskSummary({
      fileChanges: [],
      doneSteps: ['Read auth module', 'Refactor login flow'],
      verified: false,
      uncommitted: true,
    });
    expect(summary).not.toContain('**Changes**');
    expect(summary).not.toContain('**Next steps**');
    expect(summary).toContain('**What was done**');
  });

  it('shows at most 5 what-was-done bullets', () => {
    const summary = buildTaskSummary({
      fileChanges: [{ path: 'a.ts', added: 1, removed: 0 }],
      doneSteps: Array.from({ length: 12 }, (_, i) => `Step ${i}`),
      verified: true,
      uncommitted: false,
    });
    expect(summary.match(/• Step \d/g)).toHaveLength(5);
    // Verified tasks don't get the "run tests" nudge.
    expect(summary).not.toContain('not verified yet');
    // Nothing to commit → no commit suggestion.
    expect(summary).not.toContain('**Next steps**');
  });

  it('the Changes line shows the full count but caps the "showing" note at the limit', () => {
    const many = buildTaskSummary({
      fileChanges: Array.from({ length: 9 }, (_, i) => ({ path: `f${i}.ts`, added: 1, removed: 1 })),
      doneSteps: [],
      verified: true,
      uncommitted: true,
    });
    expect(many).toContain('**Changes** · 9 files (showing 5)');
    expect(many).toContain('Review the diff (`git diff`)');

    const few = buildTaskSummary({
      fileChanges: Array.from({ length: 3 }, (_, i) => ({ path: `f${i}.ts`, added: 1, removed: 1 })),
      doneSteps: [],
      verified: true,
      uncommitted: true,
    });
    expect(few).toContain('**Changes** · 3 files');
    expect(few).not.toContain('showing');
  });

  it('transcript file rows cap at the same limit with a "more" pointer', () => {
    const msg: ChatMessage = {
      id: 'done-1',
      role: 'system',
      content: '━━━ Task complete',
      timestamp: 1,
      fileChanges: Array.from({ length: 9 }, (_, i) => ({ path: `f${i}.ts`, added: 2, removed: 1 })),
    };
    const lines = buildMercuryMessageLines(msg, 76);
    const fileRows = lines.filter((l) => l.kind === 'file');
    expect(fileRows).toHaveLength(TASK_SUMMARY_FILE_LIMIT + 1); // paths + "… N more"
    expect(fileRows[fileRows.length - 1].text).toContain('4 more');
  });

  it('small change lists stay under the limit with no "more" row', () => {
    const msg: ChatMessage = {
      id: 'done-2',
      role: 'system',
      content: '━━━ Task complete',
      timestamp: 1,
      fileChanges: [{ path: 'one.ts', added: 1, removed: 0 }],
    };
    const lines = buildMercuryMessageLines(msg, 76);
    expect(lines.filter((l) => l.kind === 'file')).toHaveLength(1);
  });
});