/**
 * "What's new" for the `/whatsnew` chat command — curated, action-grouped
 * highlights per release (Added / Updated / Fixed), never the exhaustive
 * list: the full notes live in CHANGELOG.md and on the releases page, whose
 * exact-tag URL is printed at the bottom so users can check more.
 *
 * Content discipline: only user-facing actions performed in that release,
 * stated accurately — no invented features, no marketing fluff.
 */
interface ReleaseHighlights {
  added?: string[];
  updated?: string[];
  fixed?: string[];
}

const WHATS_NEW: Record<string, ReleaseHighlights> = {
  '1.2.6': {
    added: [
      '**Progressive streaming** — Mercury Code builds the document in native scrollback while it streams; sections appear styled as they finish instead of a wall of newest lines.',
      '**End-of-task summary** — what was done, how many files changed (top 5 listed), and suggested next steps in the completion banner.',
      '**Dynamic status verbs** — Mercury Code watches the session, then makes one tiny LLM call per session for status words that describe the actual work ("Extracting the parser", "Rerouting the auth flow") — never generic filler. Chat surfaces keep plain static labels.',
      '**Chat → Mercury Code hand-off** — normal chat asks once when a task looks like coding work; your choice is remembered per session.',
      '**Provider fallback visibility** — a respectful one-line notice names the failed provider, the reason, and which route the task continues on.',
      '`mercury code [dir]` launches the coding TUI from the terminal; `mercury uninstall` removes everything cleanly.',
      '`/whatsnew` and `/update ignore` commands.',
    ],
    updated: [
      'ChatGPT Web provider now resolves the account\'s live-entitled Codex model slugs (the backend rejects everything else with HTTP 400).',
      'Ink patched: a live frame taller than the terminal is bottom-trimmed instead of erasing the entire scrollback and re-dumping the transcript.',
    ],
    fixed: [
      'Streaming progress rendered as word salad — each step\'s narration now starts its own paragraph in the live tail ("Let me investigate…\\n\\nFound the situation…").',
      'The `│` transcript rule stays on settled messages; only the in-progress live tail renders without it.',
      'Long-conversation rerender storm — the scrollbar no longer jumps to the top and native scrolling works during streams.',
      'The Mercury Code research-mode prompt no longer fires (its questions were pure friction there).',
    ],
  },
  '1.2.7': {
    added: [
      '**AI/ML API provider** — 350+ chat models on one OpenAI-compatible key (`AIMLAPI_API_KEY`), with key validation and model pick in `mercury setup` and the web Providers page.',
    ],
    fixed: [
      '`mercury uninstall` now discovers the local (project) npm install correctly, on every machine — the previous check also assumed a global install existed.',
      'The bundled ink fixes now apply without patch-package (Termux/patch-package-free installs get the full set: Yoga WASM hygiene, Static identity dedup, freeze gate, live-region guard, diff-rendered live region).',
    ],
  },
};

const REPO_RELEASES_URL = 'https://github.com/cosmicstack-labs/mercury-agent/releases';

/** Markdown text for `/whatsnew` — only the action groups that have entries. */
export function whatsNewText(currentVersion: string): string {
  const version = currentVersion.replace(/^v/, '');
  const highlights = WHATS_NEW[version];
  const lines: string[] = [];

  if (highlights) {
    lines.push(`**Mercury v${version} — what's new**`);
    lines.push('');
    const sections: Array<[string, string[] | undefined]> = [
      ['Added', highlights.added],
      ['Updated', highlights.updated],
      ['Fixed', highlights.fixed],
    ];
    for (const [title, items] of sections) {
      if (!items || items.length === 0) continue;
      lines.push(`**${title}**`);
      for (const item of items) lines.push(`• ${item}`);
      lines.push('');
    }
  } else {
    lines.push(`**Mercury v${version}**`);
    lines.push('');
    lines.push('Curated highlights for this version are not published yet.');
    lines.push('');
  }

  // Release notes: exact tag when we know it, releases page always.
  lines.push(`Release notes: ${REPO_RELEASES_URL}/tag/v${version}`);
  lines.push(`All releases:  ${REPO_RELEASES_URL}`);
  return lines.join('\n');
}