import "./type-modifier.generated";

export declare namespace TypeModifierNS {
  export interface TypeProfile {
    readonly kind: "scalar" | "enum" | "input";
    readonly name: string;
    readonly value: any;
  }

  export type SpecialValueType = keyof SpecialValueFactory<any, any, any>;
  // biome-ignore lint/suspicious/noEmptyInterface: This is placeholder
  // biome-ignore lint/correctness/noUnusedVariables: This is placeholder
  interface SpecialValueFactory<TType extends TypeProfile, TModifier extends TypeModifier, TWithDefault extends boolean> {}

  type Special<
    TType extends TypeProfile,
    TModifier extends TypeModifier,
    TWithDefault extends boolean,
    TSpecialValueType extends SpecialValueType,
  > = SpecialValueFactory<TType, TModifier, TWithDefault>[TSpecialValueType];

  export type TypeModifier = string;

  export type ApplyTypeModifier<T, TModifier extends TypeModifier> = string extends TModifier ? any : Modified__<T, TModifier>;
  export type GetModifiedType<T extends TypeProfile, TModifier extends TypeModifier> = ApplyTypeModifier<T["value"], TModifier>;
  export type GetAssignableType<
    TType extends TypeProfile,
    TModifier extends TypeModifier,
    TWithDefault extends boolean,
    TSpecialValueType extends SpecialValueType,
  > = string extends TModifier ? any : Assignable__<TType, TWithDefault, TSpecialValueType, TModifier>;
}

export type TypeModifier = TypeModifierNS.TypeModifier;
export type TypeProfile = TypeModifierNS.TypeProfile;
export type SpecialValueType = TypeModifierNS.SpecialValueType;
export type ApplyTypeModifier<T, TModifier extends TypeModifier> = TypeModifierNS.ApplyTypeModifier<T, TModifier>;
export type GetModifiedType<T extends TypeProfile, TModifier extends TypeModifier> = TypeModifierNS.GetModifiedType<T, TModifier>;
export type GetAssignableType<
  TType extends TypeProfile,
  TModifier extends TypeModifier,
  TWithDefault extends boolean,
  TSpecialValueType extends SpecialValueType,
> = TypeModifierNS.GetAssignableType<TType, TModifier, TWithDefault, TSpecialValueType>;

export type ModifiedTypeName<
  // Wrapping by array to avoid type distribution
  TNameCandidate extends [string],
  TName extends TNameCandidate[0],
  TModifier extends TypeModifier,
> = // For abstract implementation
[string] extends TNameCandidate
  ? `${TName}:${TModifier}`
  : TNameCandidate extends [TName]
    ? // First, user inputs TName based on TNameCandidate
      NoInfer<`${TNameCandidate[0]}`> | (TName & NoInfer<TypeModifier extends TModifier ? never : string>)
    : // With valid TName, user can input TModifier based on TypeModifierNS.ValidTypeModifier
        | `${TName}:${TModifier & TypeModifierNS.ValidTypeModifier}`
        | `${TName}:${Extract<TypeModifierNS.ValidTypeModifier, `${TModifier}${string}`>}`;

export function parseModifiedTypeName<TNameCandidate extends [string], TName extends string, TModifier extends TypeModifier>(
  nameAndModifier: ModifiedTypeName<TNameCandidate, TName, TModifier>,
) {
  if (typeof nameAndModifier !== "string") {
    throw new Error(`Invalid modified type name: ${nameAndModifier}`);
  }

  const [name, modifier] = nameAndModifier.split(":") as [TName, TModifier];
  return { name, modifier };
}
