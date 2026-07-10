import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdirSync } from 'node:fs';

// src/lib/paths.ts -> up four levels lands on the monorepo root (wfsc/).
const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, '..', '..', '..', '..');

/**
 * Machine-local asset bundle (mockup reference photos, mascot art, example
 * books). Not committed to the repo; defaults to a sibling `archive/` dir next
 * to the repo, overridable with WFSC_ASSETS_DIR.
 */
export const assetsDir = process.env.WFSC_ASSETS_DIR ?? resolve(repoRoot, '..', 'archive');

/** Progress / state files (gitignored). Replaces the old /tmp usage. */
export const stateDir = process.env.WFSC_ADMIN_STATE_DIR ?? join(repoRoot, '.wfsc-admin');

/** Scratch dir for image conversion intermediates. */
export const tmpDir = join(stateDir, 'tmp');

export function ensureStateDirs(): void {
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });
}

export const sampleConfigsDir = join(repoRoot, 'packages', 'pipeline', 'sample-configs');
