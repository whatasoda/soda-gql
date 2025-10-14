import { gql } from "@soda-gql/core";

export const model1 = gql.default(({ model }) =>
	model(
		{ typename: "User" },
		({ f }) => ({ ...f.id() }),
		(selection) => ({ id: selection.id }),
	),
);

export const model2 = gql.default(({ model }) =>
	model(
		{ typename: "Post" },
		({ f }) => ({ ...f.id() }),
		(selection) => ({ id: selection.id }),
	),
);
