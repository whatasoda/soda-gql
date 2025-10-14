import { gql } from "@soda-gql/core";
import { type ExecutionResult } from "@soda-gql/runtime";

export const userModel = gql.default(({ model }) =>
	model(
		{ typename: "User" },
		({ f }) => ({ ...f.id() }),
		(selection) => ({ id: selection.id }),
	),
);

export type QueryResult = ExecutionResult;
