import type { AnyConstDirectiveAttachments } from "./const-directives";
import type { ConstValue } from "./const-value";
import type { ListTypeModifierSuffix, StripTailingListFromTypeModifier, TypeModifier } from "./type-modifier";

export type AnyDefaultValue = { default: ConstValue };

export type InputTypeKind = "scalar" | "enum" | "input";
export type OutputTypeKind = "scalar" | "enum" | "object" | "union" | "typename";

export type AnyTypeRef = {
  kind: string;
  name: string;
  modifier: TypeModifier;
  directives: AnyConstDirectiveAttachments;
  defaultValue?: AnyDefaultValue | null;
  arguments?: InputTypeRefs;
};

type AbstractInputTypeRef<TKind extends InputTypeKind> = {
  kind: TKind;
  name: string;
  modifier: TypeModifier;
  directives: AnyConstDirectiveAttachments;
  defaultValue: AnyDefaultValue | null;
};
export type InputTypeRefs = { [key: string]: InputTypeRef };
export type InputTypeRef = InputScalarRef | InputEnumRef | InputInputObjectRef;
export type InputInferrableTypeRef = InputScalarRef | InputEnumRef;
export type InputScalarRef = AbstractInputTypeRef<"scalar">;
export type InputEnumRef = AbstractInputTypeRef<"enum">;
export type InputInputObjectRef = AbstractInputTypeRef<"input">;

type AbstractOutputTypeRef<TKind extends OutputTypeKind> = {
  kind: TKind;
  name: string;
  modifier: TypeModifier;
  directives: AnyConstDirectiveAttachments;
  arguments: InputTypeRefs;
};
export type OutputTypeRefs = { [key: string]: OutputTypeRef };
export type OutputTypeRef = OutputScalarRef | OutputEnumRef | OutputObjectRef | OutputUnionRef | OutputTypenameRef;
export type OutputInferrableTypeRef = OutputScalarRef | OutputEnumRef | OutputTypenameRef;
export type OutputScalarRef = AbstractOutputTypeRef<"scalar">;
export type OutputEnumRef = AbstractOutputTypeRef<"enum">;
export type OutputObjectRef = AbstractOutputTypeRef<"object">;
export type OutputUnionRef = AbstractOutputTypeRef<"union">;
export type OutputTypenameRef = AbstractOutputTypeRef<"typename">;

export type StripTailingListFromTypeRef<TRef extends AnyTypeRef> = TRef extends { defaultValue: AnyDefaultValue | null }
  ? {
      kind: TRef["kind"];
      name: TRef["name"];
      modifier: StripTailingListFromTypeModifier<TRef["modifier"]>;
      directives: TRef["directives"];
      defaultValue: TRef["modifier"] extends `${string}${ListTypeModifierSuffix}` ? null : TRef["defaultValue"];
    }
  : TRef extends { arguments: InputTypeRefs }
    ? {
        kind: TRef["kind"];
        name: TRef["name"];
        modifier: StripTailingListFromTypeModifier<TRef["modifier"]>;
        directives: TRef["directives"];
        arguments: TRef["arguments"];
      }
    : never;
