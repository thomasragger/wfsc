import type { ParsedArgs } from './args.ts';

export interface Command {
  name: string;
  summary: string;
  usage?: string;
  run: (args: ParsedArgs) => Promise<void>;
}
