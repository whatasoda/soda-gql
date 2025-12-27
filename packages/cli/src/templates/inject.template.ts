export const getInjectTemplate = (): string => `\
import { defineScalar } from "@soda-gql/core";
import type {
  FragmentMetaInfo,
  MetadataAdapter,
  OperationMetadata,
} from "@soda-gql/core";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
} as const;

export const helpers = {};

export const metadata: MetadataAdapter<
  OperationMetadata,
  readonly (OperationMetadata | undefined)[]
> = {
  aggregateFragmentMetadata: (
    fragments: readonly FragmentMetaInfo<OperationMetadata>[],
  ) => fragments.map((m) => m.metadata),
};
`;
