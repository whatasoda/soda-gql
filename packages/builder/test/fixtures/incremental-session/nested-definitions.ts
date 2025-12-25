import { gql } from "../../../../../tests/codegen-fixture/graphql-system";

// Case 1: Non-exported top-level definition (used internally only)
// Should be collected with canonical ID: filePath::internalPostModel
const internalPostModel = gql.default(({ model }) => model.Post({}, ({ f }) => [f.id(), f.title()]));

// Case 2: Exported model using the internal model
// Should be collected with canonical ID: filePath::userWithPostsModel
export const userWithPostsModel = gql.default(({ model }) =>
  model.User({}, ({ f }) => [f.id(), f.name(), f.posts({})(({ f }) => [f.id(), f.title()])]),
);

// Case 3: Nested definitions in function scope
// Inner definitions should be collected with canonical IDs like:
// - filePath::createUserQueries.userById
// - filePath::createUserQueries.userList
export function createUserQueries() {
  const userById = gql.default(({ query }, { $var }) =>
    query.operation(
      {
        name: "UserById",
        variables: [$var("id").scalar("ID:!")],
      },
      ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name()])],
    ),
  );

  const userList = gql.default(({ query }, { $var }) =>
    query.operation(
      {
        name: "UserList",
        variables: [$var("limit").scalar("Int:?")],
      },
      ({ f, $ }) => [f.users({ limit: $.limit })(({ f }) => [f.id(), f.name()])],
    ),
  );

  return { userById, userList };
}

// Case 4: Arrow function with nested definitions
// Should be collected with canonical ID: filePath::queryFactory.arrow#0.baseQuery
export const queryFactory = () => {
  const baseQuery = gql.default(({ query }) =>
    query.operation(
      {
        name: "BaseQuery",
      },
      ({ f }) => [f.users({ limit: 5 })(({ f }) => [f.id()])],
    ),
  );

  return baseQuery;
};

// Case 5: Nested object structure with operation definitions
// Should be collected with canonical IDs like:
// - filePath::nestedQueries.users.list
// - filePath::nestedQueries.users.byId
export const nestedQueries = {
  users: {
    list: gql.default(({ query }, { $var }) =>
      query.operation(
        {
          name: "NestedUserList",
          variables: [$var("limit").scalar("Int:?")],
        },
        ({ f, $ }) => [f.users({ limit: $.limit })(({ f }) => [f.id(), f.name()])],
      ),
    ),
    byId: gql.default(({ query }, { $var }) =>
      query.operation(
        {
          name: "NestedUserById",
          variables: [$var("id").scalar("ID:!")],
        },
        ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name()])],
      ),
    ),
  },
};

// Case 6: Operation definition in function scope
// Should be collected with canonical ID: filePath::createUserOperation.getUserOperation
export function createUserOperation() {
  const getUserOperation = gql.default(({ query }, { $var }) =>
    query.operation(
      {
        name: "GetUserById",
        variables: [$var("id").scalar("ID:!")],
      },
      ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name()])],
    ),
  );

  return getUserOperation;
}

// Case 7: Operation definition in arrow function
// Should be collected with canonical ID: filePath::operationFactory.arrow#0.listUsersOperation
export const operationFactory = () => {
  const listUsersOperation = gql.default(({ query }, { $var }) =>
    query.operation(
      {
        name: "ListUsers",
        variables: [$var("limit").scalar("Int:?")],
      },
      ({ f, $ }) => [f.users({ limit: $.limit })(({ f }) => [f.id(), f.name()])],
    ),
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
      query.operation(
        {
          name: "NestedGetUser",
          variables: [$var("id").scalar("ID:!")],
        },
        ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name()])],
      ),
    ),
    listUsers: gql.default(({ query }, { $var }) =>
      query.operation(
        {
          name: "NestedListUsers",
          variables: [$var("limit").scalar("Int:?")],
        },
        ({ f, $ }) => [f.users({ limit: $.limit })(({ f }) => [f.id(), f.name()])],
      ),
    ),
  },
};
