import type { ConstValue } from "./const-value";
import type { TypeModifier } from "./type-modifier-core.generated";

export type AnyDefaultValue = { default: ConstValue };

export type InputTypeKind = "scalar" | "enum" | "input";
export type OutputTypeKind = "scalar" | "enum" | "object" | "union" | "typename";

export type AnyTypeSpecifier = {
  readonly kind: string;
  readonly name: string;
  readonly modifier: TypeModifier;
  // readonly directives?: AnyConstDirectiveAttachments;
  readonly defaultValue?: AnyDefaultValue | null;
  readonly arguments?: InputTypeSpecifiers;
};

type AbstractInputTypeSpecifier<TKind extends InputTypeKind> = {
  readonly kind: TKind;
  readonly name: string;
  readonly modifier: TypeModifier;
  readonly defaultValue?: AnyDefaultValue | null;
};
export type InputTypeSpecifiers = { [key: string]: InputTypeSpecifier };
export type InputTypeSpecifier = InputScalarSpecifier | InputEnumSpecifier | InputInputObjectSpecifier;
export type InputInferrableTypeSpecifier = InputScalarSpecifier | InputEnumSpecifier;
export type InputScalarSpecifier = AbstractInputTypeSpecifier<"scalar">;
export type InputEnumSpecifier = AbstractInputTypeSpecifier<"enum">;
export type InputInputObjectSpecifier = AbstractInputTypeSpecifier<"input">;

type AbstractOutputTypeSpecifier<TKind extends OutputTypeKind, TName extends string = string> = {
  readonly kind: TKind;
  readonly name: TName;
  readonly modifier: TypeModifier;
  readonly arguments: InputTypeSpecifiers;
};
export type OutputTypeSpecifiers = { [key: string]: OutputTypeSpecifier };
export type OutputTypeSpecifier =
  | OutputScalarSpecifier
  | OutputEnumSpecifier
  | OutputObjectSpecifier
  | OutputUnionSpecifier
  | OutputTypenameSpecifier;
export type OutputInferrableTypeSpecifier = OutputScalarSpecifier | OutputEnumSpecifier | OutputTypenameSpecifier;
export type OutputScalarSpecifier = AbstractOutputTypeSpecifier<"scalar">;
export type OutputEnumSpecifier = AbstractOutputTypeSpecifier<"enum">;
export type OutputObjectSpecifier<TName extends string = string> = AbstractOutputTypeSpecifier<"object", TName>;
export type OutputUnionSpecifier<TName extends string = string> = AbstractOutputTypeSpecifier<"union", TName>;
export type OutputTypenameSpecifier<TName extends string = string> = AbstractOutputTypeSpecifier<"typename", TName>;
