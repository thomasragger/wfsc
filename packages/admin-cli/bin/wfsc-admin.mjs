#!/usr/bin/env node
// Entry shim: register the tsx ESM loader so the TypeScript CLI runs without a
// build step, then hand off to src/index.ts.
import { register } from 'tsx/esm/api';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

register();
const here = dirname(fileURLToPath(import.meta.url));
await import(join(here, '..', 'src', 'index.ts'));
