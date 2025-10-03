import { gql } from "@/graphql-system";
import type { AnyModel, AnyOperation, AnySlice } from "@soda-gql/core";

type GqlModel = Extract<ReturnType<typeof gql.default>, AnyModel>;
type GqlSlice = Extract<ReturnType<typeof gql.default>, AnySlice>;
type GqlOperation = Extract<ReturnType<typeof gql.default>, AnyOperation>;

// Case 1: Non-exported top-level definition (used internally only)
// Should be collected with canonical ID: filePath::internalPostModel
const internalPostModel = gql.default(({ model }) =>
  model(
    { typename: "Post" },
    ({ f }) => ({
      ...f.id(),
      ...f.title(),
    }),
    (selection) => ({
      id: selection.id,
      title: selection.title,
    }),
  ),
);

// Case 2: Exported model using the internal model
// Should be collected with canonical ID: filePath::userWithPostsModel
export const userWithPostsModel: GqlModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.posts({}, () => ({
        ...internalPostModel.fragment(),
      })),
    }),
    (selection) => ({
      id: selection.id,
      name: selection.name,
      posts: selection.posts.map((post) => internalPostModel.normalize(post)),
    }),
  ),
);

// Case 3: Nested definitions in function scope
// Inner definitions should be collected with canonical IDs like:
// - filePath::createUserQueries.userById
// - filePath::createUserQueries.userList
export function createUserQueries(): { userById: GqlSlice; userList: GqlSlice } {
  const userById: GqlSlice = gql.default(({ slice }, { $ }) =>
    slice.query(
      {
        variables: {
          ...$("id").scalar("ID:!"),
        },
      },
      ({ f, $ }) => ({
        ...f.user({ id: $.id }, ({ f }) => ({
          ...f.id(),
          ...f.name(),
        })),
      }),
      ({ select }) => select(["$.user"], (result) => result),
    ),
  );

  const userList: GqlSlice = gql.default(({ slice }, { $ }) =>
    slice.query(
      {
        variables: {
          ...$("limit").scalar("Int:?"),
        },
      },
      ({ f, $ }) => ({
        ...f.users({ limit: $.limit }, ({ f }) => ({
          ...f.id(),
          ...f.name(),
        })),
      }),
      ({ select }) => select(["$.users"], (result) => result),
    ),
  );

  return { userById, userList };
}

// Case 4: Arrow function with nested definitions
// Should be collected with canonical ID: filePath::queryFactory.arrow#0.baseQuery
export const queryFactory = (): GqlSlice => {
  const baseQuery: GqlSlice = gql.default(({ slice }) =>
    slice.query(
      { variables: {} },
      ({ f }) => ({
        ...f.users({ limit: 5 }, ({ f }) => ({
          ...f.id(),
        })),
      }),
      ({ select }) => select(["$.users"], (result) => result),
    ),
  );

  return baseQuery;
};

// Case 5: Nested object structure with gql definitions
// Should be collected with canonical IDs like:
// - filePath::nestedQueries.users.list
// - filePath::nestedQueries.users.byId
const nestedQueriesUsersList: GqlSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: {
        ...$("limit").scalar("Int:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.users({ limit: $.limit }, ({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
    ({ select }) => select(["$.users"], (result) => result),
  ),
);

const nestedQueriesUsersById: GqlSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: {
        ...$("id").scalar("ID:!"),
      },
    },
    ({ f, $ }) => ({
      ...f.user({ id: $.id }, ({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

export const nestedQueries = {
  users: {
    list: nestedQueriesUsersList,
    byId: nestedQueriesUsersById,
  },
};

// Case 6: Operation definition in function scope
// Should be collected with canonical ID: filePath::createUserOperation.getUserOperation
// Uses the previously defined nestedQueries.users.byId slice
export function createUserOperation(): GqlOperation {
  const getUserOperation: GqlOperation = gql.default(({ operation }, { $ }) =>
    operation.query(
      {
        operationName: "GetUserById",
        variables: {
          ...$("id").scalar("ID:!"),
        },
      },
      ({ $ }) => ({
        user: nestedQueries.users.byId.build({ id: $.id }),
      }),
    ),
  );

  return getUserOperation;
}

// Case 7: Operation definition in arrow function
// Should be collected with canonical ID: filePath::operationFactory.arrow#0.listUsersOperation
// Uses the previously defined nestedQueries.users.list slice
export const operationFactory = (): GqlOperation => {
  const listUsersOperation: GqlOperation = gql.default(({ operation }, { $ }) =>
    operation.query(
      {
        operationName: "ListUsers",
        variables: {
          ...$("limit").scalar("Int:?"),
        },
      },
      ({ $ }) => ({
        users: nestedQueries.users.list.build({ limit: $.limit }),
      }),
    ),
  );

  return listUsersOperation;
};

// Case 8: Nested object structure with operation definitions
// Should be collected with canonical IDs like:
// - filePath::nestedOperations.users.getUser
// - filePath::nestedOperations.users.listUsers
const nestedOperationsUsersGetUser: GqlOperation = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "NestedGetUser",
      variables: {
        ...$("id").scalar("ID:!"),
      },
    },
    ({ $ }) => ({
      user: nestedQueries.users.byId.build({ id: $.id }),
    }),
  ),
);

const nestedOperationsUsersListUsers: GqlOperation = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "NestedListUsers",
      variables: {
        ...$("limit").scalar("Int:?"),
      },
    },
    ({ $ }) => ({
      users: nestedQueries.users.list.build({ limit: $.limit }),
    }),
  ),
);

export const nestedOperations = {
  users: {
    getUser: nestedOperationsUsersGetUser,
    listUsers: nestedOperationsUsersListUsers,
  },
};
