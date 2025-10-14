import { gql } from "@soda-gql/core";

// Non-arrow factory function - should cause error or warning
function factory({ model }: any) {
	return model(
		{ typename: "User" },
		({ f }: any) => ({ ...f.id() }),
		(selection: any) => ({ id: selection.id }),
	);
}

export const userModel = gql.default(factory);
