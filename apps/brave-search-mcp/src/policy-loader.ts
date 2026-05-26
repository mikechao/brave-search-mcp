import { readFileSync } from 'node:fs';

export interface PolicyRules {
  deniedPhrases: readonly string[];
  deniedPatterns: readonly RegExp[];
}

export function loadPolicyRulesSync(filePath: string): PolicyRules {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  }
  catch (err) {
    throw new Error(
      `Policy file error: could not read "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  }
  catch (err) {
    throw new Error(
      `Policy file error: invalid JSON in "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Policy file error: expected a JSON object at the top level of "${filePath}"`);
  }

  const obj = parsed as Record<string, unknown>;
  const deniedPhrases = validateStringArray(obj.deniedPhrases, 'deniedPhrases', filePath);
  const rawPatterns = validateStringArray(obj.deniedPatterns, 'deniedPatterns', filePath);

  const deniedPatterns: RegExp[] = rawPatterns.map((pattern, i) => {
    try {
      return new RegExp(pattern, 'i');
    }
    catch {
      throw new Error(
        `Policy file error: invalid regex at deniedPatterns[${i}] in "${filePath}": ${pattern}`,
      );
    }
  });

  return { deniedPhrases, deniedPatterns };
}

function validateStringArray(value: unknown, fieldName: string, filePath: string): string[] {
  if (value === undefined || value === null)
    return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string'))
    throw new Error(`Policy file error: "${fieldName}" must be an array of strings in "${filePath}"`);
  return value as string[];
}
