import type { GraphqlAdapter } from "./types/adapter";
import type { FieldPaths, InferByFieldPath } from "./types/field-path";
import type { AnyFields } from "./types/fields";
import type { FieldReferenceFactories } from "./types/fields-builder";
import type { ModelFn } from "./types/model";
import type { OperationFn } from "./types/operation";
import type { OperationSliceFn } from "./types/operation-slice";
import type { AnyGraphqlSchema, OperationType } from "./types/schema";
import { createHelpers } from "./types/schema";
import type { AnySliceResultSelections, SliceResultSelection } from "./types/slice-result-selection";
import type { AnySliceResultRecord, SliceResult } from "./types/slice-result";
import type { InputDefinition } from "./types/type-ref";
import { createRefFactories } from "./types/type-ref";
import type { EmptyObject } from "./types/utility";
import type { VariableReferencesByDefinition, VariableReferencesByFieldName } from "./types/variables";

export * from "./types";

export type CreateGqlConfig<TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter> = {
  readonly schema: TSchema;
  readonly adapter: TAdapter;
};

type DocumentStub = {
  readonly kind: "Document";
  readonly definitions: readonly never[];
};

const createDocumentStub = (): DocumentStub => ({
  kind: "Document",
  definitions: [],
});

type FieldArgsNormalizer<TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"] & string> = <
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string,
>(value: VariableReferencesByFieldName<TSchema, TTypeName, TFieldName> | undefined) =>
  VariableReferencesByFieldName<TSchema, TTypeName, TFieldName>;

const createArgsNormalizer = <TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"] & string>() =>
  (<TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string>(
    value: VariableReferencesByFieldName<TSchema, TTypeName, TFieldName> | undefined,
  ): VariableReferencesByFieldName<TSchema, TTypeName, TFieldName> =>
    (value ?? {}) as VariableReferencesByFieldName<TSchema, TTypeName, TFieldName>);

const createFieldFactories = <TSchema extends AnyGraphqlSchema, TTypeName extends keyof TSchema["object"] & string>(
  schema: TSchema,
  typeName: TTypeName,
): FieldReferenceFactories<TSchema, TTypeName> => {
  const typeDef = schema.object[typeName];
  if (!typeDef) {
    throw new Error(`Type ${typeName} is not defined in schema objects`);
  }

  const normaliseArgs = createArgsNormalizer<TSchema, TTypeName>();
  const factories: Partial<FieldReferenceFactories<TSchema, TTypeName>> = {};

  const fieldEntries = Object.keys(typeDef.fields) as Array<keyof typeof typeDef.fields & string>;

  fieldEntries.forEach((fieldName) => {
    const field = typeDef.fields[fieldName];

    if (field.type.kind === "object") {
      const nestedTypeName = field.type.name as keyof TSchema["object"] & string;

      const factory = (
        argsOrBuilder?:
          | VariableReferencesByFieldName<TSchema, TTypeName, typeof fieldName>
          | ((tools: { _: FieldReferenceFactories<TSchema, typeof nestedTypeName>; f: FieldReferenceFactories<TSchema, typeof nestedTypeName>; fields: FieldReferenceFactories<TSchema, typeof nestedTypeName>; }) => AnyFields),
        maybeBuilder?: (tools: {
          _: FieldReferenceFactories<TSchema, typeof nestedTypeName>;
          f: FieldReferenceFactories<TSchema, typeof nestedTypeName>;
          fields: FieldReferenceFactories<TSchema, typeof nestedTypeName>;
        }) => AnyFields,
      ) => {
        const nestedBuilder = (typeof argsOrBuilder === "function" ? argsOrBuilder : maybeBuilder) ?? (() => ({}));
        const args = typeof argsOrBuilder === "function" ? undefined : argsOrBuilder;
        const nestedFactories = createFieldFactories(schema, nestedTypeName);
        const nestedSelections = nestedBuilder({
          _: nestedFactories,
          f: nestedFactories,
          fields: nestedFactories,
        });

        return {
          [fieldName]: {
            parent: typeName,
            field: fieldName,
            type: field.type,
            args: normaliseArgs(args),
            directives: {},
            object: nestedSelections,
            union: null,
          },
        };
      };

      factories[fieldName] = factory as FieldReferenceFactories<TSchema, TTypeName>[typeof fieldName];
      return;
    }

    if (field.type.kind === "union") {
      const factory = (
        args?:
          | VariableReferencesByFieldName<TSchema, TTypeName, typeof fieldName>
          | {
            [TMember in keyof TSchema["union"][typeof field.type.name]["types"] & string]: (tools: {
              _: FieldReferenceFactories<TSchema, TMember & keyof TSchema["object"]>;
              f: FieldReferenceFactories<TSchema, TMember & keyof TSchema["object"]>;
              fields: FieldReferenceFactories<TSchema, TMember & keyof TSchema["object"]>;
            }) => AnyFields;
          },
        maybeUnion?: {
          [TMember in keyof TSchema["union"][typeof field.type.name]["types"] & string]: (tools: {
            _: FieldReferenceFactories<TSchema, TMember & keyof TSchema["object"]>;
            f: FieldReferenceFactories<TSchema, TMember & keyof TSchema["object"]>;
            fields: FieldReferenceFactories<TSchema, TMember & keyof TSchema["object"]>;
          }) => AnyFields;
        },
      ) => {
        const unionBuilder = (typeof args === "object" && args !== null && !("parent" in (args as object)))
          ? (args as {
              [TMember in keyof TSchema["union"][typeof field.type.name]["types"] & string]: (tools: {
                _: FieldReferenceFactories<TSchema, TMember & keyof TSchema["object"]>;
                f: FieldReferenceFactories<TSchema, TMember & keyof TSchema["object"]>;
                fields: FieldReferenceFactories<TSchema, TMember & keyof TSchema["object"]>;
              }) => AnyFields;
            })
          : maybeUnion ?? {};

        const fieldArgs = typeof args === "object" && args !== null && !("parent" in (args as object))
          ? undefined
          : (args as VariableReferencesByFieldName<TSchema, TTypeName, typeof fieldName> | undefined);

        const unionSelections: Record<string, AnyFields> = {};
        Object.keys(schema.union[field.type.name].types).forEach((memberName) => {
          const nestedFactories = createFieldFactories(
            schema,
            memberName as keyof TSchema["object"] & string,
          );
          const builder = unionBuilder[memberName];
          unionSelections[memberName] = builder
            ? builder({ _: nestedFactories, f: nestedFactories, fields: nestedFactories })
            : {};
        });

        return {
          [fieldName]: {
            parent: typeName,
            field: fieldName,
            type: field.type,
            args: normaliseArgs(fieldArgs),
            directives: {},
            object: null,
            union: unionSelections,
          },
        };
      };

      factories[fieldName] = factory as FieldReferenceFactories<TSchema, TTypeName>[typeof fieldName];
      return;
    }

    const factory = (
      args?: VariableReferencesByFieldName<TSchema, TTypeName, typeof fieldName>,
    ) => ({
      [fieldName]: {
        parent: typeName,
        field: fieldName,
        type: field.type,
        args: normaliseArgs(args),
        directives: {},
        object: null,
        union: null,
      },
    });

    factories[fieldName] = factory as FieldReferenceFactories<TSchema, TTypeName>[typeof fieldName];
  });

  return factories as FieldReferenceFactories<TSchema, TTypeName>;
};

const createVariableAssignments = <
  TSchema extends AnyGraphqlSchema,
  TVariables extends { [key: string]: InputDefinition },
>(
  definitions: TVariables,
  provided: VariableReferencesByDefinition<TSchema, TVariables> | EmptyObject | undefined,
): VariableReferencesByDefinition<TSchema, TVariables> => {
  if (Object.keys(definitions).length === 0) {
    return {} as VariableReferencesByDefinition<TSchema, TVariables>;
  }

  if (!provided) {
    return {} as VariableReferencesByDefinition<TSchema, TVariables>;
  }

  return provided as VariableReferencesByDefinition<TSchema, TVariables>;
};

const isSliceSelectionSingle = <
  TAdapter extends GraphqlAdapter,
>(value: AnySliceResultSelections<TAdapter>): value is SliceResultSelection<TAdapter, string, unknown, unknown> =>
  typeof value === "object" && value !== null && "transform" in value && "path" in value;

const evaluateSelections = <
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TFields extends AnyFields,
>(
  selection: AnySliceResultSelections<TAdapter>,
  results: AnySliceResultRecord<TAdapter>,
) => {
  if (isSliceSelectionSingle(selection)) {
    const key = selection.path.startsWith("$.") ? selection.path.slice(2) : selection.path;
    const target = results[key];
    if (!target) {
      throw new Error(`Slice result missing for path ${selection.path}`);
    }

    return selection.transform(target as SliceResult<unknown, TAdapter>);
  }

  const entries = Object.keys(selection).map((key) => {
    const value = evaluateSelections<TSchema, TAdapter, TFields>(selection[key], results);
    return [key, value] as const;
  });

  return Object.fromEntries(entries) as {
    [K in keyof typeof selection]: ReturnType<(typeof selection)[K]["transform"]>;
  };
};

const createSliceSelector = <
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TFields extends AnyFields,
>(
  _schema: TSchema,
  _fields: TFields,
) => <TPath extends FieldPaths<TSchema, TFields>, TTransformed>(
  path: TPath,
  projector: (result: SliceResult<InferByFieldPath<TSchema, TFields, TPath>, TAdapter>) => TTransformed,
) => ({
  path,
  transform: projector,
} as SliceResultSelection<TAdapter, TPath, InferByFieldPath<TSchema, TFields, TPath>, TTransformed>);

const createOperationSliceFactory = <TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter>(
  schema: TSchema,
  adapter: TAdapter,
) =>
  <TOperation extends OperationType>(operation: TOperation): OperationSliceFn<TSchema, TAdapter, TOperation> =>
    (variablesTuple, builder, selectionBuilder) => {
      const definitions = (variablesTuple?.[0] ?? {}) as Record<string, InputDefinition>;
      const rootType = schema.schema[operation] as keyof TSchema["object"] & string;

      return (assignments) => {
        const variables = createVariableAssignments<TSchema, typeof definitions>(definitions, assignments);
        const fieldFactories = createFieldFactories(schema, rootType);
        const fields = builder({
          _: fieldFactories,
          f: fieldFactories,
          fields: fieldFactories,
          $: variables,
        });

        const selector = createSliceSelector<TSchema, TAdapter, typeof fields>(schema, fields);
        const selections = selectionBuilder({ select: selector });

        return {
          operation,
          object: fields,
          transform: ({ results }) => evaluateSelections<TSchema, TAdapter, typeof fields>(selections, results),
          adapter,
        };
      };
    };

const createOperationFactory = <TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter>(
  schema: TSchema,
  adapter: TAdapter,
) =>
  <TOperation extends OperationType>(operation: TOperation): OperationFn<TSchema, TAdapter, TOperation> =>
    (name, variableDefinitions, builder) => {
      const definitions = (variableDefinitions ?? {}) as Record<string, InputDefinition>;
      const variableRefs = createVariableAssignments<TSchema, typeof definitions>(definitions, {} as EmptyObject);
      const sliceFactory = createOperationSliceFactory(schema, adapter)(operation);
      const slices = builder({ $: variableRefs });

      const transform = (data: unknown) => {
        const records = (typeof data === "object" && data !== null
          ? (data as AnySliceResultRecord<TAdapter>)
          : {}) satisfies AnySliceResultRecord<TAdapter>;

        const entries = Object.keys(slices).map((key) => {
          const slice = slices[key];
          return [key, slice.transform({ prefix: key, results: records })] as const;
        });

        return Object.fromEntries(entries) as {
          [K in keyof typeof slices]: ReturnType<typeof slices[K]["transform"]>;
        };
      };

      return {
        name,
        document: createDocumentStub(),
        transform,
        variables: definitions,
        slices,
      };
    };

export const createGql = <TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter>({
  schema,
  adapter,
}: CreateGqlConfig<TSchema, TAdapter>) => {
  const helpers = createHelpers(schema);
  const refs = createRefFactories<TSchema>();

  const model: ModelFn<TSchema> = (target, builder, transform) => {
    const [typename, variablesDefinition] = Array.isArray(target)
      ? [target[0], target[1] ?? ({} as EmptyObject)]
      : [target, {} as EmptyObject];

    const fieldFactories = createFieldFactories(
      schema,
      typename as keyof TSchema["object"] & string,
    );

    return {
      typename,
      variables: variablesDefinition,
      fragment: (assignments) =>
        builder({
          _: fieldFactories,
          f: fieldFactories,
          fields: fieldFactories,
          $: createVariableAssignments<TSchema, typeof variablesDefinition>(
            variablesDefinition,
            assignments,
          ),
        }),
      transform,
    };
  };

  const sliceFactory = createOperationSliceFactory(schema, adapter);
  const operationFactory = createOperationFactory(schema, adapter);

  return {
    ...helpers,
    ...refs,
    model,
    querySlice: sliceFactory("query"),
    mutationSlice: sliceFactory("mutation"),
    subscriptionSlice: sliceFactory("subscription"),
    query: operationFactory("query"),
    mutation: operationFactory("mutation"),
    subscription: operationFactory("subscription"),
    adapter,
  };
};
