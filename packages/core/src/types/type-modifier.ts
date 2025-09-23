export type TypeModifier = "" | `!${string}` | `[]${string}`;

export type ListTypeModifierSuffix = "[]" | "[]!";
export type StripTailingListFromTypeModifier<TModifier extends TypeModifier> =
  TModifier extends `${infer TInner extends TypeModifier}${ListTypeModifierSuffix}` ? TInner : TModifier;

export type TypeModifierBuilder<TModifier extends string> =
  | (TModifier & NoInfer<TypeModifierValidation<TModifier>>)
  | NoInfer<TypeModifierSuggestion<TModifier>>;
type TypeModifierSuggestion<TModifier extends string> = TModifier extends ""
  ? "" | "!" | "[]"
  : TModifier extends `${string}!`
    ? `${TModifier}[]`
    : TModifier extends `${string}[]`
      ? `${TModifier}[]` | `${TModifier}!`
      : never;
type TypeModifierValidation<TModifier extends string> = TModifier extends "!" | ""
  ? string
  : TModifier extends `${"!" | ""}[]${infer TNext extends TypeModifier | ""}`
    ? TypeModifierValidation<TNext>
    : { _: "If you see this message on type error, modifier format is wrong." };

export type ApplyTypeModifier<TModifier extends TypeModifier, TInner> = TModifier extends "!"
  ? TInner
  : TModifier extends ""
    ? TInner | null | undefined
    : TModifier extends `![]${infer TNext extends TypeModifier}`
      ? ApplyTypeModifier<TNext, TInner[]>
      : TModifier extends `[]${infer TNext extends TypeModifier}`
        ? ApplyTypeModifier<TNext, (TInner | null | undefined)[]>
        : never;

export type ApplyTypeModifierToKeys<T extends { [key: string]: { modifier: TypeModifier } }> = {
  [K in keyof T as T[K]["modifier"] extends `${string}!` ? K : never]-?: T[K];
} & {
  [K in keyof T as T[K]["modifier"] extends `${string}!` ? never : K]+?: T[K];
};

// declare const builder: <T extends TypeModifier>(modifier: TypeModifierBuilder<T>) => T;
// builder("!");
