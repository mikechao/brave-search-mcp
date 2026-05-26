import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadPolicyRulesSync } from '../../src/policy-loader.js';

function writeTempPolicy(content: string): string {
  const p = join(tmpdir(), `policy-test-${Date.now()}.json`);
  writeFileSync(p, content, 'utf-8');
  return p;
}

describe('policyLoader', () => {
  let tmpFile: string | undefined;

  afterEach(() => {
    if (tmpFile !== undefined) {
      try {
        unlinkSync(tmpFile);
      }
      catch { /* ignore if already cleaned up */ }
      tmpFile = undefined;
    }
  });

  it('parses a valid policy file with both deniedPhrases and deniedPatterns', () => {
    tmpFile = writeTempPolicy(JSON.stringify({
      deniedPhrases: ['forbidden', 'secret'],
      deniedPatterns: ['\\b[0-9]{3}-[0-9]{2}-[0-9]{4}\\b'],
    }));
    const rules = loadPolicyRulesSync(tmpFile);
    expect(rules.deniedPhrases).toEqual(['forbidden', 'secret']);
    expect(rules.deniedPatterns).toHaveLength(1);
    expect(rules.deniedPatterns[0]).toBeInstanceOf(RegExp);
    expect(rules.deniedPatterns[0].source).toBe('\\b[0-9]{3}-[0-9]{2}-[0-9]{4}\\b');
  });

  it('returns empty arrays for both fields when they are omitted from the file', () => {
    tmpFile = writeTempPolicy('{}');
    const rules = loadPolicyRulesSync(tmpFile);
    expect(rules.deniedPhrases).toEqual([]);
    expect(rules.deniedPatterns).toEqual([]);
  });

  it('throws a message containing "could not read" when the file does not exist', () => {
    expect(() => loadPolicyRulesSync('/nonexistent/path/policy.json'))
      .toThrow('could not read');
  });

  it('throws a message containing "invalid JSON" when the file contains malformed JSON', () => {
    tmpFile = writeTempPolicy('{ not valid json }');
    expect(() => loadPolicyRulesSync(tmpFile!))
      .toThrow('invalid JSON');
  });

  it('throws a message containing "deniedPhrases" when deniedPhrases is not an array of strings', () => {
    tmpFile = writeTempPolicy(JSON.stringify({ deniedPhrases: 42 }));
    expect(() => loadPolicyRulesSync(tmpFile!))
      .toThrow('deniedPhrases');
  });

  it('throws a message containing "invalid regex" when a pattern string is invalid', () => {
    tmpFile = writeTempPolicy(JSON.stringify({ deniedPatterns: ['[invalid('] }));
    expect(() => loadPolicyRulesSync(tmpFile!))
      .toThrow('invalid regex');
  });

  it('compiled patterns carry the i flag', () => {
    tmpFile = writeTempPolicy(JSON.stringify({ deniedPatterns: ['hello'] }));
    const rules = loadPolicyRulesSync(tmpFile);
    expect(rules.deniedPatterns[0].flags.includes('i')).toBe(true);
  });
});
