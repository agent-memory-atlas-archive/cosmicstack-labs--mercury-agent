import type { ChatMessage } from './types.js';

/**
 * Contextual status words for the live spinner rows ("Processing" →
 * "Painting the UI"). Pure string matching against the user's request text —
 * ZERO LLM tokens, zero latency, deterministic per task with slow rotation
 * so the word feels alive without flickering.
 *
 * One-shot LLM generation could layer on top later (one tiny call per task,
 * overriding the keyword pick); the keyword engine stays the fallback.
 */

interface VerbGroup {
  keywords: string[];
  verbs: string[];
}

const VERB_GROUPS: VerbGroup[] = [
  {
    keywords: ['ui', 'ux', 'design', 'layout', 'style', 'css', 'theme', 'button', 'screen', 'interface', 'pixel', 'logo', 'frontend', 'mockup'],
    verbs: ['Painting the UI', 'Sketching the layout', 'Polishing pixels', 'Composing the interface', 'Styling the screens'],
  },
  {
    keywords: ['test', 'spec', 'coverage', 'vitest', 'jest', 'pytest', 'tdd', 'unit test'],
    verbs: ['Stress-testing', 'Poking the edge cases', 'Running the gauntlet', 'Grinding the test suite'],
  },
  {
    keywords: ['refactor', 'restructure', 'cleanup', 'clean up', 'reorganize', 'rename', 'tidy'],
    verbs: ['Reshaping the code', 'Untangling the spaghetti', 'Tidying up', 'Rebuilding the scaffolding'],
  },
  {
    keywords: ['fix', 'bug', 'error', 'debug', 'crash', 'broken', 'failing', 'issue', 'regression'],
    verbs: ['Hunting the bug', 'Catching the culprit', 'Untangling the knot', 'Sleuthing the stack trace'],
  },
  {
    keywords: ['doc', 'readme', 'guide', 'documentation', 'changelog', 'manual'],
    verbs: ['Word-smithing the docs', 'Drafting the docs', 'Polishing the prose'],
  },
  {
    keywords: ['implement', 'add', 'create', 'build', 'feature', 'write', 'make', 'generate'],
    verbs: ['Building it out', 'Wiring it up', 'Scaffolding the feature', 'Laying the bricks'],
  },
  {
    keywords: ['research', 'analyze', 'investigate', 'explore', 'understand', 'compare', 'evaluate', 'audit'],
    verbs: ['Digging through the code', 'Following the trail', 'X-raying the codebase', 'Connecting the dots'],
  },
  {
    keywords: ['deploy', 'release', 'publish', 'ship', 'ci', 'pipeline', 'docker'],
    verbs: ['Fueling the rocket', 'Staging the launch', 'Polishing for liftoff'],
  },
  {
    keywords: ['optimize', 'performance', 'slow', 'faster', 'speed', 'cache', 'memory', 'benchmark'],
    verbs: ['Greasing the gears', 'Squeezing the juice', 'Turning the dials', 'Slimming things down'],
  },
  {
    keywords: ['download', 'upload', 'scrape', 'fetch', 'crawl', 'import', 'export', 'sync', 'queue'],
    verbs: ['Reeling it in', 'Hauling the data', 'Harvesting', 'Running the conveyor'],
  },
  {
    keywords: ['auth', 'security', 'token', 'encrypt', 'permission', 'login', 'session'],
    verbs: ['Fortifying the gates', 'Bolting the hatches', 'Setting the guards'],
  },
  {
    keywords: ['database', 'schema', 'migration', 'sql', 'table', 'query', 'model', 'redis'],
    verbs: ['Sculpting the schema', 'Tending the tables', 'Mapping the data'],
  },
];

const GENERIC_VERBS = ['Brewing', 'Cooking', 'Conjuring', 'Forging', 'Weaving', 'Crafting', 'Assembling', 'Noodling'];

/** Plan-mode word: mapping the approach, not executing it yet. */
export const PLANNING_VERBS = ['Charting the plan', 'Mapping the approach', 'Sketching the blueprint'];

/** How long one verb stays on screen before rotating to the next in its pool. */
const ROTATE_MS = 12_000;

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export interface StatusWordContext {
  /** The user's request for the current task (keyword-matching source). */
  userText?: string;
}

/**
 * Pick a playful -ing status word for the current work. Deterministic per
 * (task text, rotation bucket): different tasks start on different verbs, and
 * the verb rotates slowly within its pool so the status feels alive. Never
 * throws, never empty, always suitable as a spinner label.
 */
export function pickStatusWord(ctx: StatusWordContext = {}, tick = Date.now()): string {
  const text = (ctx.userText ?? '').toLowerCase();
  let best: VerbGroup | null = null;
  let bestHits = 0;
  for (const group of VERB_GROUPS) {
    let hits = 0;
    for (const keyword of group.keywords) {
      if (text.includes(keyword)) hits++;
    }
    if (hits > bestHits) {
      best = group;
      bestHits = hits;
    }
  }
  const pool = best?.verbs ?? GENERIC_VERBS;
  return pool[(hash(text) + Math.floor(tick / ROTATE_MS)) % pool.length];
}

/** Most recent user message — the task description the verbs are keyed on. */
export function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'user' && message.content.trim()) return message.content;
  }
  return '';
}

/** Generic agent phases that carry no information — the status word replaces them. */
export const GENERIC_PHASES = new Set(['Starting task', 'Working', 'Analyzing', 'Composing response', 'Analyzing code']);