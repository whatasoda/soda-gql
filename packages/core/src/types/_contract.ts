import type { DocumentNode } from "graphql";
import type { PseudoTypeAnnotation } from "./utility";

/**
 * Type declarations in this namespace is to show overall architecture of the library.
 * These are not intended to be used by the user.
 */
export namespace BuilderContract {
  // const-value
  export type ConstValue = string | number | boolean | null | undefined | { [key: string]: ConstValue } | ConstValue[];
  export type ConstValues = { [key: string]: ConstValue };

  // type-modifier
  export type TypeModifier = string;

  // input-value
  declare const __VARIABLE_REFERENCE_BRAND__: unique symbol;
  export type VariableReferenceMeta = {
    kind: string;
    name: string;
    assignability: unknown;
  };
  export type VariableReference = {
    [__VARIABLE_REFERENCE_BRAND__]: PseudoTypeAnnotation<VariableReferenceMeta>;
    name: string;
  };

  export type AssignableInputValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | VariableReference
    | { [key: string]: AssignableInputValue }
    | AssignableInputValue[];
  export type AssignableInput = {
    [name: string]: AssignableInputValue;
  };

  // directives
  export type ConstDirectiveAttachments = { [key: string]: ConstValues };
  export type DirectiveAttachments = { [key: string]: AssignableInput };

  // type-ref
  export type DefaultValue = { default: ConstValue };
  export type InputTypeRef = {
    kind: string;
    name: string;
    modifier: TypeModifier;
    defaultValue: DefaultValue | null;
    directives: ConstDirectiveAttachments;
  };
  export type InputTypeRefs = { [key: string]: InputTypeRef };

  export type OutputTypeRef = {
    kind: string;
    name: string;
    modifier: TypeModifier;
    arguments: InputTypeRefs;
    directives: ConstDirectiveAttachments;
  };

  // schema
  export type ScalarDef = {
    _type: PseudoTypeAnnotation<{ input: unknown; output: unknown }>;
    name: string;
    directives: ConstDirectiveAttachments;
  };
  export type EnumDef = {
    _type: PseudoTypeAnnotation<string>;
    name: string;
    values: { [key: string]: true };
    directives: ConstDirectiveAttachments;
  };
  export type InputDef = {
    name: string;
    fields: InputTypeRefs;
    directives: ConstDirectiveAttachments;
  };
  export type ObjectDef = {
    name: string;
    fields: OutputTypeRef;
    directives: ConstDirectiveAttachments;
  };
  export type UnionDef = {
    name: string;
    types: { [key: string]: true };
    directives: ConstDirectiveAttachments;
  };
  export type OperationRoots = {
    query: string;
    mutation: string;
    subscription: string;
  };
  export type GraphqlSchema = {
    operations: OperationRoots;
    scalar: { [name: string]: ScalarDef };
    enum: { [name: string]: EnumDef };
    input: { [name: string]: InputDef };
    object: { [name: string]: ObjectDef };
    union: { [name: string]: UnionDef };
  };

  // field-path
  export type FieldPath = string;

  // fields
  export type Fields = {
    [name: string]: FieldReference;
  };
  export type FieldReference = {
    parent: string;
    field: string;
    type: InputTypeRef;
    args: AssignableInput;
    directives: DirectiveAttachments;
    object: NestedObject | null;
    union: NestedUnion | null;
  };

  export type NestedObject = {
    [name: string]: FieldReference;
  };
  export type NestedUnion = {
    [name: string]: NestedObject | undefined;
  };

  // model
  export type Model = {
    typename: string;
    variables: AssignableInput;
    fragment: (variables: AssignableInput) => Fields;
    transform: (selected: Fields) => unknown;
  };

  // slice-result
  export type SliceResult = {
    data?: unknown;
    error?: unknown;
  };
  export type SliceResultRecord = {
    [path: string]: SliceResult;
  };

  // slice-result-selection
  declare const __SLICE_RESULT_PROJECTION_BRAND__: unique symbol;
  export type SliceResultProjection = {
    [__SLICE_RESULT_PROJECTION_BRAND__]: PseudoTypeAnnotation<never>;
    path: FieldPath;
    projector: (result: SliceResult) => unknown;
  };
  export type SliceResultProjections = SliceResultProjection | { [key: string]: SliceResultProjection };

  // operation-slice
  export type OperationSlice = {
    _output: PseudoTypeAnnotation<unknown>;
    operationType: string;
    variables: AssignableInput;
    fields: Fields;
    projections: SliceResultProjections;
  };

  export type Operation = {
    _input: PseudoTypeAnnotation<ConstValues>;
    _raw: PseudoTypeAnnotation<unknown>;
    _output: PseudoTypeAnnotation<unknown>;
    type: string;
    name: string;
    document: DocumentNode;
    parse: (data: unknown) => {
      [key: string]: unknown;
    };
  };
}
