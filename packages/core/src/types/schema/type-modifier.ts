export type AnyTypeModifier = string;

export type TypeModifier = "?" | `!${string}` | `[]${string}`;

export type ListTypeModifierSuffix = "[]" | "[]!";
export type StripTailingListFromTypeModifier<TModifier extends TypeModifier> =
  TModifier extends `${infer TInner extends TypeModifier}${ListTypeModifierSuffix}` ? TInner : TModifier;

export type ApplyTypeModifier<TModifier extends TypeModifier, TInner> = TModifier extends "!"
  ? TInner
  : TModifier extends "?" | ""
    ? TInner | null | undefined
    : TModifier extends `![]${infer TNext extends TypeModifier}`
      ? ApplyTypeModifier<TNext, TInner[]>
      : TModifier extends `[]${infer TNext extends TypeModifier}`
        ? ApplyTypeModifier<TNext, (TInner | null | undefined)[]>
        : never;

export type ApplyTypeModifierToKeys<T extends { [key: string]: { modifier: TypeModifier } }> = {
  readonly [K in keyof T as T[K]["modifier"] extends `${string}!` ? K : never]-?: T[K];
} & {
  readonly [K in keyof T as T[K]["modifier"] extends `${string}!` ? never : K]+?: T[K];
};

export type ModifiedTypeName<TNameCandidate extends string, TName extends TNameCandidate, TModifier extends AnyTypeModifier> =
  | (`${TName}:${TModifier}` & NoInfer<TypeModifierValidation<TModifier>>)
  | NoInfer<`${TName}:${TypeModifierSuggestion<TModifier>}`>;

type TypeModifierSuggestion<TModifier extends AnyTypeModifier> = [TModifier, TypeModifier] extends [TypeModifier, TModifier]
  ? "?" | "!" | "[]"
  : TModifier extends "?"
    ? "?"
    : TModifier extends `${string}!`
      ? `${TModifier}[]`
      : TModifier extends `${string}[]`
        ? `${TModifier}[]` | `${TModifier}!`
        : never;

type TypeModifierValidation<TModifier extends AnyTypeModifier> = TModifier extends "?" | "!"
  ? string
  : TModifier extends `${"!" | ""}[]${infer TNext extends TypeModifier | ""}`
    ? TNext extends ""
      ? string
      : TypeModifierValidation<TNext>
    : { _: "If you see this message on type error, modifier format is wrong." };

export const parseModifiedTypeName = <TName extends string, TModifier extends AnyTypeModifier>(
  nameAndModifier: ModifiedTypeName<string, TName, TModifier>,
) => {
  if (typeof nameAndModifier !== "string") {
    throw new Error(`Invalid modified type name: ${nameAndModifier}`);
  }

  const [name, modifier] = nameAndModifier.split(":") as [TName, TModifier];
  return { name, modifier };
};
