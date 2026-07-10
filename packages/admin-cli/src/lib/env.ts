import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './paths.ts';

let loaded = false;

/** Load repoRoot/.env into process.env once (does not override existing vars). */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const envPath = join(repoRoot, '.env');
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // Non-fatal: a missing or malformed .env just means vars come from the
      // real environment.
    }
  }
}

export function requireEnv(...keys: string[]): void {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env var(s): ${missing.join(', ')}`);
  }
}

export function env(key: string, fallback: string): string;
export function env(key: string): string | undefined;
export function env(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}
