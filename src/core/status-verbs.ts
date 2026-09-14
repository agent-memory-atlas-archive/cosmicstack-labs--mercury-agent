/**
 * Mercury Code's dynamic status verbs — the LLM layer over the keyword
 * engine (consumers live in core/agent.ts, channels/cli.ts + ui/App.tsx).
 * One tiny generateText call per session: after the session has progressed
 * enough to see the project's persona, the agent asks the model for a pool
 * of short -ing phrases describing the ACTUAL work ("Extracting the
 * parser", "Rerouting the auth flow") — never generic filler like
 * "building" or "noodling" for work that isn't happening.
 *
 * Cadence is deliberately rare (the user's explicit concern): first refresh
 * after the 2nd completed turn, then at most one per 5 turns. One failure
 * disables the LLM layer for the session (the keyword fallback is pushed
 * once) — no retry churn. The keyword engine remains the fallback and never
 * gets replaced by anything less specific.
 */

/** Completed turns before the first refresh (turn 1 is too thin a signal). */
export const FIRST_REFRESH_AFTER_TURNS = 2;

/** Minimum turns between two refreshes — the pool must not churn. */
export const REFRESH_INTERVAL_TURNS = 5;

const MIN_VERBS = 6;
const MAX_VERBS = 10;

export interface StatusVerbGateInput {
  /** Completed Mercury Code turns so far (1-based count, incremented before the call). */
  turnCount: number;
  /** A refresh is currently in flight. */
  inFlight: boolean;
  /** A previous refresh failed — the LLM layer is off for the session. */
  disabled: boolean;
}

export interface StatusVerbGate {
  refresh: boolean;
  reason: 'disabled' | 'too-early' | 'in-flight' | 'not-due' | 'due';
}

/**
 * Decide whether this turn's end should fire the one-shot LLM verb refresh.
 * Pure — the agent owns the counters; this only encodes the cadence.
 */
export function shouldRefreshStatusVerbs(input: StatusVerbGateInput): StatusVerbGate {
  if (input.disabled) return { refresh: false, reason: 'disabled' };
  if (input.inFlight) return { refresh: false, reason: 'in-flight' };
  if (input.turnCount < FIRST_REFRESH_AFTER_TURNS) return { refresh: false, reason: 'too-early' };
  // First refresh at exactly FIRST_REFRESH_AFTER_TURNS, then every REFRESH_INTERVAL_TURNS.
  const sinceAnchor = (input.turnCount - FIRST_REFRESH_AFTER_TURNS) % REFRESH_INTERVAL_TURNS;
  if (sinceAnchor !== 0) return { refresh: false, reason: 'not-due' };
  return { refresh: true, reason: 'due' };
}

export interface StatusVerbPromptInput {
  /** The last few user requests — the project's persona lives here. */
  userRequests: string[];
  /** Project directory name (e.g. "download-manager"). */
  projectName: string;
  /** Labels of recent tool steps, if any (what the agent has been doing). */
  recentActivity?: string[];
}

/**
 * Build the one-shot verb-generation prompt. The system prompt hard-codes the
 * contract; the user prompt carries only the session evidence (≤ a few
 * hundred tokens).
 */
export function buildStatusVerbPrompt(input: StatusVerbPromptInput): { system: string; prompt: string } {
  const system = [
    'You write the live status labels for an AI coding agent working in a project.',
    'Given the recent requests in the session, produce a pool of short status phrases describing what the agent is ACTUALLY doing in this session.',
    'Rules:',
    '- Each phrase: a present-participle verb (+ short object), 2-6 words, e.g. "Extracting the parser", "Rerouting the auth flow".',
    '- Only work that is actually happening in these requests. If nothing is being built, do NOT write "building" or "crafting" or "noodling".',
    '- Specific to this project and these requests — no generic filler, no metaphors, no emoji.',
    `- Exactly ${MIN_VERBS}-${MAX_VERBS} distinct phrases.`,
    '- Output ONLY a JSON array of strings, nothing else.',
  ].join('\n');
  const requests = input.userRequests.map((r, i) => `${i + 1}. ${r.slice(0, 240)}`).join('\n');
  const activity = input.recentActivity && input.recentActivity.length > 0
    ? `\nRecent activity: ${input.recentActivity.slice(-5).join('; ').slice(0, 300)}`
    : '';
  const prompt = `Project: ${input.projectName}\nRecent requests:\n${requests}${activity}`;
  return { system, prompt };
}

/**
 * Parse and validate the model output. Returns the verb pool, or null when
 * unusable (wrong shape, too few usable phrases, or generic/off-work words).
 * The pool is small (a few hundred bytes), so the caller pushes it verbatim.
 */
export function parseStatusVerbs(raw: string): string[] | null {
  const text = (raw ?? '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const verbs = parsed
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().replace(/\.$/, ''))
    .filter((v) => {
      if (v.length < 4 || v.length > 48) return false;
      if (v.split(/\s+/).length > 6) return false; // ≤ 6 words per phrase
      return true;
    })
    .filter((v) => {
      const first = v.split(/\s+/)[0].toLowerCase();
      return first.endsWith('ing') && !GENERIC_FORBIDDEN.has(first);
    })
    // Case-insensitive dedupe, keep the first occurrence.
    .filter((v, i, all) => all.findIndex((o) => o.toLowerCase() === v.toLowerCase()) === i)
    .slice(0, MAX_VERBS);
  return verbs.length >= MIN_VERBS ? verbs : null;
}

/** Leading verbs that are exactly the generic filler the prompt forbids. */
const GENERIC_FORBIDDEN = new Set(['building', 'crafting', 'noodling', 'doodling', 'cooking', 'brewing', 'working', 'processing']);