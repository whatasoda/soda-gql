import type { TypeCategory, TypeFilterConfig, TypeFilterRule } from "@soda-gql/config";
import picomatch from "picomatch";

export type FilterContext = {
  readonly name: string;
  readonly category: TypeCategory;
};

type CompiledFilter = (context: FilterContext) => boolean;

const compileRule = (rule: TypeFilterRule): CompiledFilter => {
  const matcher = picomatch(rule.pattern);
  const categories = rule.category ? (Array.isArray(rule.category) ? rule.category : [rule.category]) : null;

  return (context) => {
    if (categories && !categories.includes(context.category)) {
      return true; // not excluded (category doesn't match)
    }
    return !matcher(context.name); // true = include (pattern doesn't match)
  };
};

export const compileTypeFilter = (config: TypeFilterConfig | undefined): CompiledFilter => {
  if (!config) {
    return () => true; // include all
  }

  if (typeof config === "function") {
    return config;
  }

  const rules = config.exclude.map(compileRule);
  return (context) => rules.every((rule) => rule(context));
};

export const buildExclusionSet = (filter: CompiledFilter, typeNames: Map<TypeCategory, readonly string[]>): Set<string> => {
  const excluded = new Set<string>();

  for (const [category, names] of typeNames) {
    for (const name of names) {
      if (!filter({ name, category })) {
        excluded.add(name);
      }
    }
  }

  return excluded;
};
