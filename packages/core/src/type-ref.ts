import type {
  AnyConstDirectiveAttachments,
  AnyGraphqlSchema,
  DefaultValue,
  InputTypeRefs,
  TypeModifier,
  TypeModifierBuilder,
} from "./types";

/** Fluent helper to declare schema components in a type-safe way. */
type UnsafeInputRefFactory<TKind extends "scalar" | "enum" | "input"> = <
  const TName extends string,
  const TModifier extends TypeModifier,
  const TDefaultValue extends DefaultValue | null,
  const TDirectives extends AnyConstDirectiveAttachments,
>(
  type: [name: TName, modifier: TypeModifierBuilder<TModifier>],
  defaultValue: TDefaultValue,
  directives: TDirectives,
) => {
  kind: TKind;
  name: TName;
  modifier: TModifier;
  defaultValue: TDefaultValue;
  directives: TDirectives;
};

const createUnsafeInputRefFactory = <const TKind extends "scalar" | "enum" | "input">(
  kind: TKind,
): UnsafeInputRefFactory<TKind> => {
  return <
    const TName extends string,
    const TModifier extends TypeModifier,
    const TDefaultValue extends DefaultValue | null,
    const TDirectives extends AnyConstDirectiveAttachments,
  >(
    [name, modifier]: [name: TName, modifier: TypeModifierBuilder<TModifier>],
    defaultValue: TDefaultValue,
    directives: TDirectives,
  ) => ({
    kind,
    name,
    modifier: modifier as TModifier,
    defaultValue,
    directives,
  });
};

export const unsafeInputRef = {
  scalar: createUnsafeInputRefFactory("scalar"),
  enum: createUnsafeInputRefFactory("enum"),
  input: createUnsafeInputRefFactory("input"),
};

type UnsafeOutputRefFactory<TKind extends "scalar" | "enum" | "object" | "union" | "typename"> = <
  const TName extends string,
  const TModifier extends TypeModifier,
  const TArguments extends InputTypeRefs,
  const TDirectives extends AnyConstDirectiveAttachments,
>(
  type: [name: TName, modifier: TypeModifierBuilder<TModifier>],
  arguments_: TArguments,
  directives: TDirectives,
) => {
  kind: TKind;
  name: TName;
  modifier: TModifier;
  arguments: TArguments;
  directives: TDirectives;
};

const createUnsafeOutputRefFactory = <const TKind extends "scalar" | "enum" | "object" | "union" | "typename">(
  kind: TKind,
): UnsafeOutputRefFactory<TKind> => {
  return <
    const TName extends string,
    const TModifier extends TypeModifier,
    const TArguments extends InputTypeRefs,
    const TDirectives extends AnyConstDirectiveAttachments,
  >(
    [name, modifier]: [name: TName, modifier: TypeModifierBuilder<TModifier>],
    arguments_: TArguments,
    directives: TDirectives,
  ) => ({
    kind,
    name,
    modifier: modifier as TModifier,
    arguments: arguments_,
    directives,
  });
};

export const unsafeOutputRef = {
  scalar: createUnsafeOutputRefFactory("scalar"),
  enum: createUnsafeOutputRefFactory("enum"),
  object: createUnsafeOutputRefFactory("object"),
  union: createUnsafeOutputRefFactory("union"),
  typename: createUnsafeOutputRefFactory("typename"),
};

type AssignableDefaultValue<
  TSchema extends AnyGraphqlSchema,
  TKind extends "scalar" | "enum" | "input",
  TName extends keyof TSchema[TKind] & string,
  TModifier extends TypeModifier,
> = {
  scalar: { kind: "scalar"; name: TName; modifier: TModifier; directives: {}; defaultValue: null };
  enum: { kind: "enum"; name: TName; modifier: TModifier; directives: {}; defaultValue: null };
  input: { kind: "input"; name: TName; modifier: TModifier; directives: {}; defaultValue: null };
}[TKind];

type InputTypeRefFactory<TSchema extends AnyGraphqlSchema, TKind extends "scalar" | "enum" | "input"> = {
  <const TName extends keyof TSchema[TKind] & string, const TModifier extends TypeModifier>(
    type: [name: TName, modifier: TypeModifierBuilder<TModifier>],
  ): {
    kind: TKind;
    name: TName;
    modifier: TModifier;
    defaultValue: null;
    directives: {};
  };

  <
    const TName extends keyof TSchema[TKind] & string,
    const TModifier extends TypeModifier,
    const TDefaultValue extends AssignableDefaultValue<TSchema, TKind, TName, TModifier>,
  >(
    type: [name: TName, modifier: TypeModifierBuilder<TModifier>],
    defaultValue: TDefaultValue,
  ): {
    kind: TKind;
    name: TName;
    modifier: TModifier;
    defaultValue: TDefaultValue;
    directives: {};
  };

  <
    const TName extends keyof TSchema[TKind] & string,
    const TModifier extends TypeModifier,
    const TDefaultValue extends AssignableDefaultValue<TSchema, TKind, TName, TModifier> | null,
    const TDirectives extends AnyConstDirectiveAttachments,
  >(
    type: [name: TName, modifier: TypeModifierBuilder<TModifier>],
    defaultValue: TDefaultValue,
    directives: TDirectives,
  ): {
    kind: TKind;
    name: TName;
    modifier: TModifier;
    defaultValue: TDefaultValue;
    directives: TDirectives;
  };

  <
    const TName extends keyof TSchema[TKind] & string,
    const TModifier extends TypeModifier,
    const TDefaultValue extends DefaultValue | null,
    const TDirectives extends AnyConstDirectiveAttachments,
  >(
    type: [name: TName, modifier: TypeModifierBuilder<TModifier>],
    defaultValue?: TDefaultValue,
    directives?: TDirectives,
  ): {
    kind: TKind;
    name: TName;
    modifier: TModifier;
    directives: TDirectives;
    defaultValue: TDefaultValue;
  };
};

export const createInputTypeRefFactory = <TSchema extends AnyGraphqlSchema, TKind extends "scalar" | "enum" | "input">(
  kind: TKind,
): InputTypeRefFactory<TSchema, TKind> => {
  return <
    const TName extends keyof TSchema[TKind] & string,
    const TModifier extends TypeModifier,
    const TDirectives extends AnyConstDirectiveAttachments,
    const TDefaultValue extends DefaultValue,
  >(
    [name, modifier]: [name: TName, modifier: TypeModifierBuilder<TModifier>],
    defaultValue?: TDefaultValue,
    directives?: TDirectives,
  ) => ({
    kind,
    name,
    modifier,
    directives: directives ?? {},
    defaultValue: defaultValue ?? null,
  });
};
