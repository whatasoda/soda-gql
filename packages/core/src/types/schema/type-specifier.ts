import type { AnyConstDirectiveAttachments } from "./const-directives";
import type { ConstValue } from "./const-value";
import type { TypeModifier } from "./type-modifier";

export type AnyDefaultValue = { default: ConstValue };

export type InputTypeKind = "scalar" | "enum" | "input";
export type OutputTypeKind = "scalar" | "enum" | "object" | "union" | "typename";

export type AnyTypeSpecifier = {
  readonly kind: string;
  readonly name: string;
  readonly modifier: TypeModifier;
  readonly directives?: AnyConstDirectiveAttachments;
  readonly defaultValue?: AnyDefaultValue | null;
  readonly arguments?: InputTypeSpecifiers;
};

type AbstractInputTypeSpecifier<TKind extends InputTypeKind> = {
  readonly kind: TKind;
  readonly name: string;
  readonly modifier: TypeModifier;
  readonly directives: AnyConstDirectiveAttachments;
  readonly defaultValue: AnyDefaultValue | null;
};
export type InputTypeSpecifiers = { [key: string]: InputTypeSpecifier };
export type InputTypeSpecifier = InputScalarSpecifier | InputEnumSpecifier | InputInputObjectSpecifier;
export type InputScalarSpecifier = AbstractInputTypeSpecifier<"scalar">;
export type InputEnumSpecifier = AbstractInputTypeSpecifier<"enum">;
export type InputInputObjectSpecifier = AbstractInputTypeSpecifier<"input">;

type AbstractOutputTypeSpecifier<TKind extends OutputTypeKind> = {
  readonly kind: TKind;
  readonly name: string;
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
export type OutputObjectSpecifier = AbstractOutputTypeSpecifier<"object">;
export type OutputUnionSpecifier = AbstractOutputTypeSpecifier<"union">;
export type OutputTypenameSpecifier = AbstractOutputTypeSpecifier<"typename">;
