import { err, ok, type Result } from "neverthrow";
import type { z } from "zod";

export type AliasMap = Record<string, string>;

export const parseArgs = <T extends z.ZodType>(args: string[], schema: T, aliases?: AliasMap): Result<z.infer<T>, string> => {
  const parsed: Record<string, unknown> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (!nextArg || nextArg.startsWith("--") || nextArg.startsWith("-")) {
        parsed[key] = true;
      } else {
        parsed[key] = nextArg;
        i++;
      }
    } else if (arg.startsWith("-") && aliases) {
      const shortKey = arg.slice(1);
      const longKey = aliases[shortKey];
      if (longKey) {
        parsed[longKey] = true;
      } else {
        positional.push(arg);
      }
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    parsed._ = positional;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return err(result.error.issues.map((e) => e.message).join(", "));
  }

  return ok(result.data);
};
