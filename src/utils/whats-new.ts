/**
 * Curated "what's new" highlights per release, shown by the `/whatsnew`
 * chat command. Keep entries to a handful of user-facing bullets — this is
 * read by humans, not changelog archivists; the exhaustive list lives in
 * CHANGELOG.md and on the releases page.
 */
const WHATS_NEW: Record<string, string[]> = {
  '1.2.9': [
    '**Progressive streaming** — Mercury Code now builds the document in native scrollback while it streams; you watch sections appear styled as they finish, instead of a wall of newest lines.',
    '**End-of-task summary** — what was done, how many files changed (top 5 listed), and suggested next steps in the completion banner.',
    '**Contextual status words** — the spinner says "Painting the UI" or "Hunting the bug" based on your request. Zero LLM tokens.',
    '**Chat → Mercury Code hand-off** — normal chat asks once when a task looks like coding work; your choice is remembered per session.',
    '**Provider fallback visibility** — expired token? You now see a respectful one-line notice naming the provider, the reason, and which route the task continues on.',
    '`mercury code` launches the coding TUI straight from the terminal; `mercury uninstall` removes everything cleanly.',
  ],
};

const RELEASES_URL = 'https://github.com/cosmicstack-labs/mercury-agent/releases';

/** Markdown text for `/whatsnew` — falls back to the releases link for unknown versions. */
export function whatsNewText(currentVersion: string): string {
  const version = currentVersion.replace(/^v/, '');
  const highlights = WHATS_NEW[version];

  const lines: string[] = [];
  if (highlights && highlights.length > 0) {
    lines.push(`**What's new in v${version}**`);
    lines.push('');
    for (const item of highlights) lines.push(`• ${item}`);
    lines.push('');
    lines.push('Exhaustive notes: `CHANGELOG.md` in the install directory.');
  } else {
    lines.push(`**Mercury v${version}**`);
    lines.push('');
    lines.push('Curated highlights for this version are not published yet — the full release notes live here:');
  }
  lines.push('');
  lines.push(`All releases: https://github.com/cosmicstack-labs/mercury-agent/releases`);
  return lines.join('\n');
}