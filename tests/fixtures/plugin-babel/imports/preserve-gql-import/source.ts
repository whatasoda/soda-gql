import { gql, type GraphQLSchema } from "@soda-gql/core";

export const userModel = gql.default(({ model }) =>
	model(
		{ typename: "User" },
		({ f }) => ({ ...f.id() }),
		(selection) => ({ id: selection.id }),
	),
);

export const schema: GraphQLSchema = gql.schema;
