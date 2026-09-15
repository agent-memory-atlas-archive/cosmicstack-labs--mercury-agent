import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SkillLoader } from './loader.js';

describe('SkillLoader skill-name confinement', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mercury-skills-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('creates a normal skill inside the skills root', () => {
    const loader = new SkillLoader(root);
    const dir = loader.saveSkill('good-skill', '# Good\n');
    expect(dir.startsWith(root)).toBe(true);
    expect(existsSync(join(dir, 'SKILL.md'))).toBe(true);
  });

  it('rejects names that escape the skills root', () => {
    const loader = new SkillLoader(root);
    for (const name of ['..', '../evil', '../../evil', '/tmp/evil', 'nested/../../evil']) {
      expect(() => loader.saveSkill(name, '# Evil\n')).toThrow(/outside the skills root/);
    }
  });

  it('rejects a traversal name coming from remote SKILL.md frontmatter', () => {
    const loader = new SkillLoader(root);
    const content = ['---', 'name: ../../evil-skill', 'description: pwned', '---', 'body'].join('\n');
    expect(() => loader.installFromContent(content)).toThrow(/outside the skills root/);
  });
});
