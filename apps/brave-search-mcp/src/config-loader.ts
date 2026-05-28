import { readFileSync } from 'node:fs';
import { parse, TomlError } from 'smol-toml';

export interface AuthConfig {
  httpApiKey?: string;
  requireAuth?: boolean;
  callerId?: string;
  jwt?: {
    jwksUri: string;
    audience?: string;
    clockSkewSeconds?: number;
  };
  oauth?: {
    issuer: string;
    audience?: string;
    clientId?: string;
    clientSecret?: string;
    verifyStrategy?: 'jwks' | 'introspect';
  };
}

export interface AuditConfig {
  enabled: boolean;
  logRaw: boolean;
  hmacSecret?: string;
}

export interface PolicyConfig {
  file?: string;
  redact: boolean;
}

export interface GuardrailConfigResolved {
  requestLimit?: number;
  windowSeconds: number;
  cooldownSeconds: number;
  requireJustification: boolean;
}

export interface ServerFeatureConfig {
  allowedHosts?: string[];
}

export interface FeatureConfig {
  auth: AuthConfig;
  audit: AuditConfig;
  policy: PolicyConfig;
  guardrail: GuardrailConfigResolved;
  server: ServerFeatureConfig;
}

export type ConfigSourceMode = 'env' | 'file';

export interface ResolvedRuntimeConfig {
  mode: ConfigSourceMode;
  featureConfig: FeatureConfig;
  configPath?: string;
  ignoredEnvVars: string[];
  unknownKeys: string[];
  maskedForDisplay: unknown;
}

interface ResolveRuntimeConfigArgs {
  env: NodeJS.ProcessEnv;
  explicitConfigPath?: string;
  warn: (message: string) => void;
}

type ConfigTable = Record<string, unknown>;
interface KnownKeySchema {
  [key: string]: true | KnownKeySchema;
}

const CONFIG_ENV_VAR = 'BRAVE_MCP_CONFIG';
const IGNORED_FEATURE_ENV_VARS = [
  'ALLOWED_HOSTS',
  'BRAVE_MCP_HTTP_API_KEY',
  'BRAVE_MCP_REQUIRE_AUTH',
  'BRAVE_MCP_CALLER_ID',
  'BRAVE_MCP_JWKS_URI',
  'BRAVE_MCP_AUTH_AUDIENCE',
  'BRAVE_MCP_AUTH_CLOCK_SKEW_SECONDS',
  'BRAVE_MCP_OAUTH_ISSUER',
  'BRAVE_MCP_OAUTH_AUDIENCE',
  'BRAVE_MCP_OAUTH_CLIENT_ID',
  'BRAVE_MCP_OAUTH_CLIENT_SECRET',
  'BRAVE_MCP_OAUTH_VERIFY_STRATEGY',
  'BRAVE_MCP_POLICY_FILE',
  'BRAVE_MCP_POLICY_REDACT',
  'BRAVE_MCP_REQUEST_LIMIT',
  'BRAVE_MCP_WINDOW_SECONDS',
  'BRAVE_MCP_COOLDOWN_SECONDS',
  'BRAVE_MCP_AUDIT_LOG',
  'BRAVE_MCP_AUDIT_LOG_RAW',
  'BRAVE_MCP_AUDIT_HMAC_SECRET',
  'BRAVE_MCP_REQUIRE_JUSTIFICATION',
] as const;

const SECRET_MASK = '***';

export function createDefaultFeatureConfig(): FeatureConfig {
  return {
    auth: {},
    audit: {
      enabled: false,
      logRaw: false,
    },
    policy: {
      redact: false,
    },
    guardrail: {
      windowSeconds: 0,
      cooldownSeconds: 0,
      requireJustification: false,
    },
    server: {},
  };
}

export function resolveRuntimeConfig(args: ResolveRuntimeConfigArgs): ResolvedRuntimeConfig {
  const configPath = normalizeOptionalString(args.explicitConfigPath) ?? normalizeOptionalString(args.env[CONFIG_ENV_VAR]);
  if (!configPath) {
    const featureConfig = resolveFeatureConfigFromEnv(args.env);
    return {
      mode: 'env',
      featureConfig,
      ignoredEnvVars: [],
      unknownKeys: [],
      maskedForDisplay: maskFeatureConfig(featureConfig),
    };
  }

  const ignoredEnvVars = IGNORED_FEATURE_ENV_VARS.filter(key => hasConfiguredValue(args.env[key]));
  for (const key of ignoredEnvVars)
    args.warn(`Warning: ignoring ${key} because ${CONFIG_ENV_VAR} is set`);

  const parsed = readAndParseToml(configPath);
  const unknownKeys = collectUnknownKeys(parsed);
  for (const key of unknownKeys)
    args.warn(`Warning: unknown config key ${key}`);

  const featureConfig = validateFeatureConfig(parsed);

  return {
    mode: 'file',
    featureConfig,
    configPath,
    ignoredEnvVars,
    unknownKeys,
    maskedForDisplay: maskFeatureConfig(featureConfig),
  };
}

function readAndParseToml(configPath: string): ConfigTable {
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  }
  catch (error) {
    throw new Error(`Config file error: could not read "${configPath}": ${formatError(error)}`);
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  }
  catch (error) {
    if (error instanceof TomlError)
      throw new Error(`Config file error: invalid TOML in "${configPath}": ${error.message}`);
    throw error;
  }

  return expectTable(parsed, 'config');
}

function resolveFeatureConfigFromEnv(env: NodeJS.ProcessEnv): FeatureConfig {
  const featureConfig = createDefaultFeatureConfig();
  const requestLimit = parseEnvPositiveInteger(env.BRAVE_MCP_REQUEST_LIMIT);

  featureConfig.auth = validateResolvedAuthConfig(buildAuthConfigFromEnv(env));
  featureConfig.audit = {
    enabled: parseEnvBoolean(env.BRAVE_MCP_AUDIT_LOG),
    logRaw: parseEnvBoolean(env.BRAVE_MCP_AUDIT_LOG_RAW),
    hmacSecret: normalizeOptionalString(env.BRAVE_MCP_AUDIT_HMAC_SECRET),
  };
  featureConfig.policy = {
    file: normalizeOptionalString(env.BRAVE_MCP_POLICY_FILE),
    redact: parseEnvBoolean(env.BRAVE_MCP_POLICY_REDACT),
  };
  featureConfig.guardrail = {
    requestLimit,
    windowSeconds: parseEnvNonNegativeIntegerOrZero(env.BRAVE_MCP_WINDOW_SECONDS),
    cooldownSeconds: parseEnvNonNegativeIntegerOrZero(env.BRAVE_MCP_COOLDOWN_SECONDS),
    requireJustification: parseEnvBoolean(env.BRAVE_MCP_REQUIRE_JUSTIFICATION),
  };
  featureConfig.server = {
    allowedHosts: parseAllowedHostsEnv(env.ALLOWED_HOSTS),
  };

  return featureConfig;
}

function buildAuthConfigFromEnv(env: NodeJS.ProcessEnv): AuthConfig {
  const auth: AuthConfig = {};
  const httpApiKey = normalizeOptionalString(env.BRAVE_MCP_HTTP_API_KEY);
  const requireAuth = parseOptionalEnvBoolean(env.BRAVE_MCP_REQUIRE_AUTH);
  const callerId = normalizeOptionalString(env.BRAVE_MCP_CALLER_ID);
  const jwksUri = normalizeOptionalString(env.BRAVE_MCP_JWKS_URI);
  const jwtAudience = normalizeOptionalString(env.BRAVE_MCP_AUTH_AUDIENCE);
  const clockSkewSeconds = parseOptionalEnvNonNegativeInteger(env.BRAVE_MCP_AUTH_CLOCK_SKEW_SECONDS);
  const oauthIssuer = normalizeOptionalString(env.BRAVE_MCP_OAUTH_ISSUER);
  const oauthAudience = normalizeOptionalString(env.BRAVE_MCP_OAUTH_AUDIENCE);
  const oauthClientId = normalizeOptionalString(env.BRAVE_MCP_OAUTH_CLIENT_ID);
  const oauthClientSecret = normalizeOptionalString(env.BRAVE_MCP_OAUTH_CLIENT_SECRET);
  const oauthVerifyStrategy = parseOptionalVerifyStrategy(env.BRAVE_MCP_OAUTH_VERIFY_STRATEGY);

  if (httpApiKey)
    auth.httpApiKey = httpApiKey;
  if (requireAuth !== undefined)
    auth.requireAuth = requireAuth;
  if (callerId)
    auth.callerId = callerId;
  if (jwksUri || jwtAudience || clockSkewSeconds !== undefined) {
    if (!jwksUri)
      throw new Error('Config error: auth.jwt.jwksUri is required when JWT auth env vars are set');
    auth.jwt = {
      jwksUri,
      audience: jwtAudience,
      clockSkewSeconds,
    };
  }
  if (oauthIssuer || oauthAudience || oauthClientId || oauthClientSecret || oauthVerifyStrategy) {
    if (!oauthIssuer)
      throw new Error('Config error: auth.oauth.issuer is required when OAuth env vars are set');
    auth.oauth = {
      issuer: oauthIssuer,
      audience: oauthAudience,
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      verifyStrategy: oauthVerifyStrategy,
    };
  }

  return auth;
}

function validateFeatureConfig(parsed: ConfigTable): FeatureConfig {
  return {
    auth: validateResolvedAuthConfig(validateAuthConfig(readOptionalTable(parsed, 'auth'), 'auth')),
    audit: validateAuditConfig(readOptionalTable(parsed, 'audit'), 'audit'),
    policy: validatePolicyConfig(readOptionalTable(parsed, 'policy'), 'policy'),
    guardrail: validateGuardrailConfig(readOptionalTable(parsed, 'guardrail'), 'guardrail'),
    server: validateServerFeatureConfig(readOptionalTable(parsed, 'server'), 'server'),
  };
}

function validateAuthConfig(table: ConfigTable | undefined, path: string): AuthConfig {
  if (!table)
    return {};

  const jwtTable = readOptionalTable(table, 'jwt', path);
  const oauthTable = readOptionalTable(table, 'oauth', path);

  return {
    httpApiKey: validateOptionalString(table.httpApiKey, `${path}.httpApiKey`),
    requireAuth: validateOptionalBoolean(table.requireAuth, `${path}.requireAuth`),
    callerId: validateOptionalString(table.callerId, `${path}.callerId`),
    jwt: jwtTable
      ? {
          jwksUri: validateRequiredString(jwtTable.jwksUri, `${path}.jwt.jwksUri`),
          audience: validateOptionalString(jwtTable.audience, `${path}.jwt.audience`),
          clockSkewSeconds: validateOptionalNonNegativeInteger(jwtTable.clockSkewSeconds, `${path}.jwt.clockSkewSeconds`),
        }
      : undefined,
    oauth: oauthTable
      ? {
          issuer: validateRequiredString(oauthTable.issuer, `${path}.oauth.issuer`),
          audience: validateOptionalString(oauthTable.audience, `${path}.oauth.audience`),
          clientId: validateOptionalString(oauthTable.clientId, `${path}.oauth.clientId`),
          clientSecret: validateOptionalString(oauthTable.clientSecret, `${path}.oauth.clientSecret`),
          verifyStrategy: validateOptionalVerifyStrategy(oauthTable.verifyStrategy, `${path}.oauth.verifyStrategy`),
        }
      : undefined,
  };
}

function validateResolvedAuthConfig(auth: AuthConfig): AuthConfig {
  if (!auth.oauth)
    return auth;

  const verifyStrategy = auth.oauth.verifyStrategy ?? 'jwks';
  if (auth.oauth.clientSecret && !auth.oauth.clientId) {
    throw new Error('Config error: auth.oauth.clientId is required when auth.oauth.clientSecret is set');
  }

  if (verifyStrategy === 'introspect') {
    if (!auth.oauth.clientId) {
      throw new Error(
        'Config error: auth.oauth.clientId is required when auth.oauth.verifyStrategy is "introspect"',
      );
    }
    if (!auth.oauth.clientSecret) {
      throw new Error(
        'Config error: auth.oauth.clientSecret is required when auth.oauth.verifyStrategy is "introspect"',
      );
    }
  }

  return auth;
}

function validateAuditConfig(table: ConfigTable | undefined, path: string): AuditConfig {
  if (!table) {
    return {
      enabled: false,
      logRaw: false,
    };
  }

  return {
    enabled: validateBooleanWithDefault(table.enabled, `${path}.enabled`, false),
    logRaw: validateBooleanWithDefault(table.logRaw, `${path}.logRaw`, false),
    hmacSecret: validateOptionalString(table.hmacSecret, `${path}.hmacSecret`),
  };
}

function validatePolicyConfig(table: ConfigTable | undefined, path: string): PolicyConfig {
  if (!table)
    return { redact: false };

  return {
    file: validateOptionalString(table.file, `${path}.file`),
    redact: validateBooleanWithDefault(table.redact, `${path}.redact`, false),
  };
}

function validateGuardrailConfig(table: ConfigTable | undefined, path: string): GuardrailConfigResolved {
  if (!table) {
    return {
      windowSeconds: 0,
      cooldownSeconds: 0,
      requireJustification: false,
    };
  }

  return {
    requestLimit: validateOptionalPositiveInteger(table.requestLimit, `${path}.requestLimit`),
    windowSeconds: validateNonNegativeIntegerWithDefault(table.windowSeconds, `${path}.windowSeconds`, 0),
    cooldownSeconds: validateNonNegativeIntegerWithDefault(table.cooldownSeconds, `${path}.cooldownSeconds`, 0),
    requireJustification: validateBooleanWithDefault(table.requireJustification, `${path}.requireJustification`, false),
  };
}

function validateServerFeatureConfig(table: ConfigTable | undefined, path: string): ServerFeatureConfig {
  if (!table)
    return {};

  return {
    allowedHosts: validateOptionalStringArray(table.allowedHosts, `${path}.allowedHosts`),
  };
}

function collectUnknownKeys(parsed: ConfigTable): string[] {
  const warnings: string[] = [];
  collectUnknownKeysFromTable(parsed, [], {
    auth: {
      httpApiKey: true,
      requireAuth: true,
      callerId: true,
      jwt: {
        jwksUri: true,
        audience: true,
        clockSkewSeconds: true,
      },
      oauth: {
        issuer: true,
        audience: true,
        clientId: true,
        clientSecret: true,
        verifyStrategy: true,
      },
    },
    audit: {
      enabled: true,
      logRaw: true,
      hmacSecret: true,
    },
    policy: {
      file: true,
      redact: true,
    },
    guardrail: {
      requestLimit: true,
      windowSeconds: true,
      cooldownSeconds: true,
      requireJustification: true,
    },
    server: {
      allowedHosts: true,
    },
  }, warnings);
  return warnings.sort();
}

function collectUnknownKeysFromTable(
  table: ConfigTable,
  parentPath: string[],
  schema: KnownKeySchema,
  warnings: string[],
): void {
  for (const [key, value] of Object.entries(table)) {
    const rule = schema[key];
    const path = [...parentPath, key];
    if (!rule) {
      warnings.push(path.join('.'));
      continue;
    }
    if (rule !== true && isPlainObject(value))
      collectUnknownKeysFromTable(value, path, rule, warnings);
  }
}

function readOptionalTable(table: ConfigTable, key: string, parentPath?: string): ConfigTable | undefined {
  const value = table[key];
  if (value === undefined)
    return undefined;
  return expectTable(value, parentPath ? `${parentPath}.${key}` : key);
}

function expectTable(value: unknown, path: string): ConfigTable {
  if (!isPlainObject(value))
    throw new Error(`Config error: ${path} must be a table/object`);
  return value;
}

function isPlainObject(value: unknown): value is ConfigTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAllowedHostsEnv(value: string | undefined): string[] | undefined {
  const hosts = value
    ?.split(',')
    .map(host => host.trim())
    .filter(Boolean);
  return hosts?.length ? hosts : undefined;
}

function hasConfiguredValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.length > 0;
}

function parseEnvBoolean(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true';
}

function parseOptionalEnvBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined)
    return undefined;
  return parseEnvBoolean(value);
}

function parseEnvPositiveInteger(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value))
    return undefined;
  const parsed = Number(value);
  return parsed > 0 ? parsed : undefined;
}

function parseEnvNonNegativeIntegerOrZero(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value))
    return 0;
  return Number(value);
}

function parseOptionalEnvNonNegativeInteger(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value))
    return undefined;
  return Number(value);
}

function parseOptionalVerifyStrategy(value: string | undefined): 'jwks' | 'introspect' | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized)
    return undefined;
  if (normalized !== 'jwks' && normalized !== 'introspect')
    throw new Error(`Config error: auth.oauth.verifyStrategy must be "jwks" or "introspect", got ${JSON.stringify(normalized)}`);
  return normalized;
}

function validateRequiredString(value: unknown, path: string): string {
  const normalized = validateOptionalString(value, path);
  if (!normalized)
    throw new Error(`Config error: ${path} is required`);
  return normalized;
}

function validateOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined)
    return undefined;
  if (typeof value !== 'string')
    throw new Error(`Config error: ${path} must be a string, got ${describeValue(value)}`);
  const normalized = normalizeOptionalString(value);
  if (!normalized)
    throw new Error(`Config error: ${path} must not be empty`);
  return normalized;
}

function validateOptionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined)
    return undefined;
  if (typeof value !== 'boolean')
    throw new Error(`Config error: ${path} must be a boolean, got ${describeValue(value)}`);
  return value;
}

function validateBooleanWithDefault(value: unknown, path: string, defaultValue: boolean): boolean {
  return value === undefined ? defaultValue : validateBoolean(value, path);
}

function validateBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean')
    throw new Error(`Config error: ${path} must be a boolean, got ${describeValue(value)}`);
  return value;
}

function validateOptionalPositiveInteger(value: unknown, path: string): number | undefined {
  if (value === undefined)
    return undefined;
  return validatePositiveInteger(value, path);
}

function validatePositiveInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0)
    throw new Error(`Config error: ${path} must be a positive integer, got ${describeValue(value)}`);
  return value as number;
}

function validateOptionalNonNegativeInteger(value: unknown, path: string): number | undefined {
  if (value === undefined)
    return undefined;
  return validateNonNegativeInteger(value, path);
}

function validateNonNegativeIntegerWithDefault(value: unknown, path: string, defaultValue: number): number {
  return value === undefined ? defaultValue : validateNonNegativeInteger(value, path);
}

function validateNonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0)
    throw new Error(`Config error: ${path} must be a non-negative integer, got ${describeValue(value)}`);
  return value as number;
}

function validateOptionalVerifyStrategy(value: unknown, path: string): 'jwks' | 'introspect' | undefined {
  if (value === undefined)
    return undefined;
  if (value !== 'jwks' && value !== 'introspect')
    throw new Error(`Config error: ${path} must be "jwks" or "introspect", got ${describeValue(value)}`);
  return value;
}

function validateOptionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined)
    return undefined;
  if (!Array.isArray(value))
    throw new Error(`Config error: ${path} must be an array of strings, got ${describeValue(value)}`);

  return value.map((item, index) => {
    if (typeof item !== 'string')
      throw new Error(`Config error: ${path}[${index}] must be a string, got ${describeValue(item)}`);
    const normalized = normalizeOptionalString(item);
    if (!normalized)
      throw new Error(`Config error: ${path}[${index}] must not be empty`);
    return normalized;
  });
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function maskFeatureConfig(featureConfig: FeatureConfig): unknown {
  return {
    auth: {
      ...featureConfig.auth,
      httpApiKey: featureConfig.auth.httpApiKey ? SECRET_MASK : undefined,
      oauth: featureConfig.auth.oauth
        ? {
            ...featureConfig.auth.oauth,
            clientSecret: featureConfig.auth.oauth.clientSecret ? SECRET_MASK : undefined,
          }
        : undefined,
    },
    audit: {
      ...featureConfig.audit,
      hmacSecret: featureConfig.audit.hmacSecret ? SECRET_MASK : undefined,
    },
    policy: { ...featureConfig.policy },
    guardrail: { ...featureConfig.guardrail },
    server: { ...featureConfig.server },
  };
}

function describeValue(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
