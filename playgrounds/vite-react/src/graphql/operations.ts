import { gql } from "@/graphql-system";
import { userFragment } from "./fragments";

/**
 * Query operation to fetch a single user
 */
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!"), ...$var("categoryId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(() => ({ ...userFragment.embed({ categoryId: $.categoryId }) })) }),
  }),
);

/**
 * Query operation to fetch multiple users
 */
export const listUsersQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "ListUsers",
    variables: { ...$var("categoryId").ID("?") },
    fields: ({ f, $ }) => ({ ...f.users({ categoryId: $.categoryId })(() => ({ ...f.id(), ...f.name(), ...f.email() })) }),
  }),
);

/**
 * Mutation operation to update user
 */
export const updateUserMutation = gql.default(({ mutation }, { $var }) =>
  mutation.operation({
    name: "UpdateUser",
    variables: { ...$var("userId").ID("!"), ...$var("name").String("!") },
    fields: ({ f, $ }) => ({
      ...f.updateUser({ id: $.userId, name: $.name })(() => ({ ...f.id(), ...f.name(), ...f.email() })),
    }),
  }),
);
