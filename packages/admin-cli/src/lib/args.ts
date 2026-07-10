export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Minimal flag parser. Supports `--flag value`, `--flag=value` and boolean
 * `--flag`. Everything else is a positional.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[a.slice(2)] = next;
          i++;
        } else {
          flags[a.slice(2)] = true;
        }
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

export function flagStr(args: ParsedArgs, key: string): string | undefined;
export function flagStr(args: ParsedArgs, key: string, fallback: string): string;
export function flagStr(args: ParsedArgs, key: string, fallback?: string): string | undefined {
  const v = args.flags[key];
  return typeof v === 'string' ? v : fallback;
}

export function flagBool(args: ParsedArgs, key: string): boolean {
  return args.flags[key] === true || args.flags[key] === 'true';
}
