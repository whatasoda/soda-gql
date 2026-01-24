import type { ConstValue } from "./const-value";
import type { TypeModifier } from "./type-modifier-core.generated";

export type AnyDefaultValue = { default: ConstValue };

export type InputTypeKind = "scalar" | "enum" | "input" | "excluded";
export type OutputTypeKind = "scalar" | "enum" | "object" | "union" | "typename" | "excluded";

// Creatable type kinds exclude "excluded" which is only used in generated code for filtered types
export type CreatableInputTypeKind = Exclude<InputTypeKind, "excluded">;
export type CreatableOutputTypeKind = Exclude<OutputTypeKind, "excluded">;

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
// Record types use deferred string format for performance
export type InputTypeSpecifiers = { [key: string]: DeferredInputSpecifier };

/**
 * VarSpecifier is the structured format for operation variable definitions.
 * Created by $var() at runtime, NOT from codegen.
 */
export type VarSpecifier = {
  readonly kind: CreatableInputTypeKind;
  readonly name: string;
  readonly modifier: TypeModifier;
  readonly defaultValue: AnyDefaultValue | null;
  readonly directives: Record<string, unknown>;
};

/**
 * VariableDefinitions is a record of VarSpecifier for operation variables.
 * Used in operation/compat/extend composers.
 */
export type VariableDefinitions = { [key: string]: VarSpecifier };

// Structured types are used internally (parsed representation)
export type InputTypeSpecifier = InputScalarSpecifier | InputEnumSpecifier | InputInputObjectSpecifier | InputExcludedSpecifier;
export type InputInferrableTypeSpecifier = InputScalarSpecifier | InputEnumSpecifier;
export type InputScalarSpecifier = AbstractInputTypeSpecifier<"scalar">;
export type InputEnumSpecifier = AbstractInputTypeSpecifier<"enum">;
export type InputInputObjectSpecifier = AbstractInputTypeSpecifier<"input">;
export type InputExcludedSpecifier = AbstractInputTypeSpecifier<"excluded">;

type AbstractOutputTypeSpecifier<TKind extends OutputTypeKind> = {
  readonly kind: TKind;
  readonly name: string;
  readonly modifier: TypeModifier;
  readonly arguments: InputTypeSpecifiers;
};
// Record types use deferred string format for performance
export type OutputTypeSpecifiers = { [key: string]: DeferredOutputSpecifier };
export type OutputTypeSpecifier =
  | OutputScalarSpecifier
  | OutputEnumSpecifier
  | OutputObjectSpecifier
  | OutputUnionSpecifier
  | OutputTypenameSpecifier
  | OutputExcludedSpecifier;
export type OutputInferrableTypeSpecifier = OutputScalarSpecifier | OutputEnumSpecifier | OutputTypenameSpecifier;
export type OutputScalarSpecifier = AbstractOutputTypeSpecifier<"scalar">;
export type OutputEnumSpecifier = AbstractOutputTypeSpecifier<"enum">;
export type OutputObjectSpecifier = AbstractOutputTypeSpecifier<"object">;
export type OutputUnionSpecifier = AbstractOutputTypeSpecifier<"union">;
export type OutputTypenameSpecifier = AbstractOutputTypeSpecifier<"typename">;
export type OutputExcludedSpecifier = AbstractOutputTypeSpecifier<"excluded">;

// ============================================================
// Deferred String Literal Specifier Types
// ============================================================

/**
 * Deferred input specifier string format: "{kind}|{name}|{modifier}[|D]"
 * - s=scalar, e=enum, i=input
 * - Trailing |D indicates default value present
 */
export type DeferredInputSpecifier = `${"s" | "e" | "i"}|${string}|${TypeModifier}${string}`;

/**
 * Deferred output specifier string format: "{kind}|{name}|{modifier}[|args]"
 * - s=scalar, e=enum, o=object, u=union
 * - Arguments format: "argName:k|Type|Mod,..."
 */
export type DeferredOutputSpecifier = `${"s" | "e" | "o" | "u"}|${string}|${TypeModifier}${string}`;

/**
 * Deferred specifier for inferable output types (scalar, enum).
 * Used for types that can be directly inferred without nested selection.
 */
export type DeferredOutputInferrableSpecifier = `${"s" | "e"}|${string}|${TypeModifier}${string}`;

// Legacy aliases removed - use DeferredInputSpecifier/DeferredOutputSpecifier directly
