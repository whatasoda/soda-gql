import { gql } from "@soda-gql/core";

// Stub dependencies for runtime execution
const userSlice = {} as any;
const nestedSlice = {} as any;
const updateUserSlice = {} as any;

export const profileQuery = gql.default(({ query }, { $ }) =>
	query(
		"ProfileQuery",
		{ variables: { ...$("userId").scalar("ID:!") } },
		({ $, getSlice }) => ({
			...getSlice(userSlice, { id: $.userId }),
		}),
	),
);

export const updateProfileMutation = gql.default(({ query }, { $ }) =>
	query(
		"UpdateProfile",
		{
			variables: {
				...$("userId").scalar("ID:!"),
				...$("name").scalar("String:!"),
			},
		},
		({ $, getSlice }) => ({
			...getSlice(updateUserSlice, { id: $.userId, name: $.name }),
		}),
	),
);

export const query1 = gql.default(({ query }) =>
	query("Query1", {}, ({ getSlice }) => ({})),
);

export const query2 = gql.default(({ query }) =>
	query("Query2", {}, ({ getSlice }) => ({})),
);

export const queryWith2Args = gql.default(({ query }) =>
	query("Query2Args", {}),
);

export const complexQuery = gql.default(({ query }) =>
	query("ComplexQuery", {}, ({ getSlice }) => ({
		...getSlice(nestedSlice, {}),
	})),
);
