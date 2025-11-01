import {
  type AnyConstDirectiveAttachments,
  type AnyGraphqlSchema,
  type AnyTypeSpecifier,
  type ConstAssignableInputValue,
  type ModifiedTypeName,
  parseModifiedTypeName,
  type TypeModifier,
} from "../types/schema";
import { wrapByKey } from "../utils/wrap-by-key";

type AssignableDefaultValue<
  TSchema extends AnyGraphqlSchema,
  TKind extends "scalar" | "enum" | "input",
  TName extends keyof TSchema[TKind] & string,
  TModifier extends TypeModifier,
> = ConstAssignableInputValue<
  TSchema,
  {
    scalar: { kind: "scalar"; name: TName; modifier: TModifier; directives: {}; defaultValue: null };
    enum: { kind: "enum"; name: TName; modifier: TModifier; directives: {}; defaultValue: null };
    input: { kind: "input"; name: TName; modifier: TModifier; directives: {}; defaultValue: null };
  }[TKind]
>;

export const createVarBuilder = <TSchema extends AnyGraphqlSchema>(schema: TSchema) => {
  const $ = <TVarName extends string>(varName: TVarName) => {
    const createRefBuilder = <TKind extends "scalar" | "enum" | "input">(kind: TKind) => {
      type InputRef<
        TTypeName extends keyof TSchema[TKind] & string,
        TModifier extends TypeModifier,
        TDefaultFn extends (() => AssignableDefaultValue<TSchema, TKind, TTypeName, TModifier>) | null,
        TDirectives extends AnyConstDirectiveAttachments,
      > = {
        kind: TKind;
        name: TTypeName;
        modifier: TModifier;
        defaultValue: TDefaultFn extends null
          ? null
          : {
              default: ReturnType<NonNullable<TDefaultFn>>;
            };
        directives: TDirectives;
      };

      return <
        const TTypeName extends keyof TSchema[TKind] & string,
        const TModifier extends TypeModifier,
        const TDefaultFn extends (() => AssignableDefaultValue<TSchema, TKind, TTypeName, TModifier>) | null = null,
        const TDirectives extends AnyConstDirectiveAttachments = {},
      >(
        type: ModifiedTypeName<string, TTypeName, TModifier>,
        extras?: {
          default?:
            | (TDefaultFn & (() => AssignableDefaultValue<TSchema, TKind, TTypeName, TModifier>))
            | (NoInfer<TDefaultFn> extends null ? () => AssignableDefaultValue<TSchema, TKind, TTypeName, TModifier> : never);
          directives?: TDirectives;
        },
      ) =>
        wrapByKey(varName, {
          kind,
          ...parseModifiedTypeName(type),
          defaultValue: extras?.default ? { default: extras.default() } : null,
          directives: extras?.directives ?? ({} as TDirectives),
        } satisfies AnyTypeSpecifier as InputRef<TTypeName, TModifier, TDefaultFn, TDirectives>);
    };

    return {
      scalar: createRefBuilder("scalar"),
      enum: createRefBuilder("enum"),
      input: createRefBuilder("input"),

      byField: <
        const TTypeName extends keyof TSchema["object"] & string,
        const TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string,
        const TArgName extends keyof TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"] & string,
      >(
        typeName: TTypeName,
        fieldName: TFieldName,
        argName: TArgName,
      ) => {
        const argTypeRef = schema.object[typeName]?.fields[fieldName]?.arguments[argName];

        if (!argTypeRef) {
          throw new Error(`Argument ${argName} not found in field ${fieldName} of type ${typeName}`);
        }

        // TODO: clone
        return { ...argTypeRef } as TSchema["object"][TTypeName]["fields"][TFieldName]["arguments"][TArgName];
      },
    };
  };

  return { $ };
};
