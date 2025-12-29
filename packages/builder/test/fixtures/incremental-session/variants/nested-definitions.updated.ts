import { gql } from "../../../codegen-fixture/graphql-system";

// Case 1: Non-exported top-level definition (used internally only)
// Should be collected with canonical ID: filePath::internalPostFragment
// UPDATED: Added body() field
const internalPostFragment = gql.default(({ fragment }) =>
  fragment.Post({ fields: ({ f }) => ({ ...f.id(), ...f.title(), ...f.body() }) }),
);

// Case 2: Exported fragment using the internal fragment
// Should be collected with canonical ID: filePath::userWithPostsFragment
export const userWithPostsFragment = gql.default(({ fragment }) =>
  fragment.User({
    fields: ({ f }) => ({ ...f.id(), ...f.name(), ...f.posts({})(({ f }) => ({ ...f.id(), ...f.title(), ...f.body() })) }),
  }),
);

// Case 3: Nested definitions in function scope
// Inner definitions should be collected with canonical IDs like:
// - filePath::createUserQueries.userById
// - filePath::createUserQueries.userList
export function createUserQueries() {
  const userById = gql.default(({ query }, { $var }) =>
    query.operation({
      name: "UserById",
      variables: { ...$var("id").scalar("ID:!") },
      fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })) }),
    }),
  );

  const userList = gql.default(({ query }, { $var }) =>
    query.operation({
      name: "UserList",
      variables: { ...$var("limit").scalar("Int:?") },
      fields: ({ f, $ }) => ({ ...f.users({ limit: $.limit })(({ f }) => ({ ...f.id(), ...f.name() })) }),
    }),
  );

  return { userById, userList };
}

// Case 4: Arrow function with nested definitions
// Should be collected with canonical ID: filePath::queryFactory.arrow#0.baseQuery
export const queryFactory = () => {
  const baseQuery = gql.default(({ query }) =>
    query.operation({
      name: "BaseQuery",
      fields: ({ f }) => ({ ...f.users({ limit: 5 })(({ f }) => ({ ...f.id() })) }),
    }),
  );

  return baseQuery;
};

// Case 5: Nested object structure with operation definitions
// UPDATED: Added email() field to list
// Should be collected with canonical IDs like:
// - filePath::nestedQueries.users.list
// - filePath::nestedQueries.users.byId
export const nestedQueries = {
  users: {
    list: gql.default(({ query }, { $var }) =>
      query.operation({
        name: "NestedUserList",
        variables: { ...$var("limit").scalar("Int:?") },
        fields: ({ f, $ }) => ({ ...f.users({ limit: $.limit })(({ f }) => ({ ...f.id(), ...f.name(), ...f.email() })) }),
      }),
    ),
    byId: gql.default(({ query }, { $var }) =>
      query.operation({
        name: "NestedUserById",
        variables: { ...$var("id").scalar("ID:!") },
        fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })) }),
      }),
    ),
  },
};

// Case 6: Operation definition in function scope
// Should be collected with canonical ID: filePath::createUserOperation.getUserOperation
export function createUserOperation() {
  const getUserOperation = gql.default(({ query }, { $var }) =>
    query.operation({
      name: "GetUserById",
      variables: { ...$var("id").scalar("ID:!") },
      fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })) }),
    }),
  );

  return getUserOperation;
}

// Case 7: Operation definition in arrow function
// Should be collected with canonical ID: filePath::operationFactory.arrow#0.listUsersOperation
export const operationFactory = () => {
  const listUsersOperation = gql.default(({ query }, { $var }) =>
    query.operation({
      name: "ListUsers",
      variables: { ...$var("limit").scalar("Int:?") },
      fields: ({ f, $ }) => ({ ...f.users({ limit: $.limit })(({ f }) => ({ ...f.id(), ...f.name() })) }),
    }),
  );

  return listUsersOperation;
};

// Case 8: Nested object structure with operation definitions
// Should be collected with canonical IDs like:
// - filePath::nestedOperations.users.getUser
// - filePath::nestedOperations.users.listUsers
export const nestedOperations = {
  users: {
    getUser: gql.default(({ query }, { $var }) =>
      query.operation({
        name: "NestedGetUser",
        variables: { ...$var("id").scalar("ID:!") },
        fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })) }),
      }),
    ),
    listUsers: gql.default(({ query }, { $var }) =>
      query.operation({
        name: "NestedListUsers",
        variables: { ...$var("limit").scalar("Int:?") },
        fields: ({ f, $ }) => ({ ...f.users({ limit: $.limit })(({ f }) => ({ ...f.id(), ...f.name() })) }),
      }),
    ),
  },
};
