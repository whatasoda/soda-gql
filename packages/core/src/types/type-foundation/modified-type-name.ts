import type { TypeModifier, ValidTypeModifier } from "./type-modifier-core.generated";

export type ModifiedTypeName<
  // Wrapping by array to avoid type distribution
  TNameCandidate extends [string],
  TName extends TNameCandidate[0],
  TModifier extends TypeModifier,
> = [string] extends TNameCandidate // For abstract implementation
  ? `${TName}:${TModifier}`
  : TNameCandidate extends [TName]
    ? // First, user inputs TName based on TNameCandidate
      NoInfer<`${TNameCandidate[0]}`> | (TName & NoInfer<TypeModifier extends TModifier ? never : string>)
    : // With valid TName, user can input TModifier based on TypeModifierNS.ValidTypeModifier
      `${TName}:${TModifier & ValidTypeModifier}`;

export function parseModifiedTypeName<TNameCandidate extends [string], TName extends string, TModifier extends TypeModifier>(
  nameAndModifier: ModifiedTypeName<TNameCandidate, TName, TModifier>,
) {
  if (typeof nameAndModifier !== "string") {
    throw new Error(`Invalid modified type name: ${nameAndModifier}`);
  }

  const [name, modifier] = nameAndModifier.split(":") as [TName, TModifier];
  return { name, modifier };
}
