import { type AnyFields, type AnyGraphqlSchema, type EmptyObject, hidden, type Model } from "../types";

type GeneratedModel = {
  typename: string;
  transform: (raw: unknown) => object;
};

export const runtimeModel = (generated: GeneratedModel): Model<AnyGraphqlSchema, string, EmptyObject, AnyFields, object> => ({
  _input: hidden(),
  _output: hidden(),
  typename: generated.typename,
  fragment: hidden(),
  transform: generated.transform,
});
