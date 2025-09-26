import { type AnyFields, type AnyGraphqlSchema, type EmptyObject, pseudoTypeAnnotation, type Model } from "../types";

type GeneratedModel = {
  typename: string;
  // biome-ignore lint/suspicious/noExplicitAny: abstract type
  transform: (raw: any) => object;
};

export const runtimeModel = (generated: GeneratedModel): Model<AnyGraphqlSchema, string, EmptyObject, AnyFields, object> => ({
  _input: pseudoTypeAnnotation(),
  _output: pseudoTypeAnnotation(),
  typename: generated.typename,
  fragment: pseudoTypeAnnotation(),
  transform: generated.transform,
});
