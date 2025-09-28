import {
  type AnyFields,
  type AnyGraphqlSchema,
  type EmptyObject,
  type Model,
  pseudoTypeAnnotation,
  type StripFunctions,
} from "../types";

export type RuntimeModelInput = {
  prebuild: StripFunctions<Model<AnyGraphqlSchema, string, EmptyObject, AnyFields, object>>;
  runtime: {
    transform: (raw: any) => object;
  };
};

export const runtimeModel = (input: RuntimeModelInput): Model<AnyGraphqlSchema, string, EmptyObject, AnyFields, object> => ({
  _input: pseudoTypeAnnotation(),
  _output: pseudoTypeAnnotation(),
  typename: input.prebuild.typename,
  fragment: pseudoTypeAnnotation(),
  transform: input.runtime.transform,
});
