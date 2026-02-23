import { gql } from "../../../graphql-system";

// Case 1: Non-exported top-level definition (used internally only)
// Should be collected with canonical ID: filePath::internalPostFragment
const internalPostFragment = gql.default(({ fragment }) => fragment("InternalPostFragment", "Task")`{ id title }`());

// Case 2: Exported fragment using the internal fragment
// Should be collected with canonical ID: filePath::userWithPostsFragment
export const userWithPostsFragment = gql.default(({ fragment }) =>
  fragment("UserWithPostsFragment", "Employee")`{ id name tasks { id title } }`(),
);

// Case 3: Nested definitions in function scope
// Inner definitions should be collected with canonical IDs like:
// - filePath::createUserQueries.userById
// - filePath::createUserQueries.userList
export function createUserQueries() {
  const userById = gql.default(({ query }) =>
    query("UserById")`($id: ID!) { employee(id: $id) { id name } }`(),
  );

  const userList = gql.default(({ query }) =>
    query("UserList")`($limit: Int) { employees(limit: $limit) { id name } }`(),
  );

  return { userById, userList };
}

// Case 4: Arrow function with nested definitions
// Should be collected with canonical ID: filePath::queryFactory._arrow_0.baseQuery
export const queryFactory = () => {
  const baseQuery = gql.default(({ query }) =>
    query("BaseQuery")`{ employees(limit: 5) { id } }`(),
  );

  return baseQuery;
};

// Case 5: Nested object structure with operation definitions
// Should be collected with canonical IDs like:
// - filePath::nestedQueries.users.list
// - filePath::nestedQueries.users.byId
export const nestedQueries = {
  users: {
    list: gql.default(({ query }) =>
      query("NestedUserList")`($limit: Int) { employees(limit: $limit) { id name } }`(),
    ),
    byId: gql.default(({ query }) =>
      query("NestedUserById")`($id: ID!) { employee(id: $id) { id name } }`(),
    ),
  },
};

// Case 6: Operation definition in function scope
// Should be collected with canonical ID: filePath::createUserOperation.getUserOperation
export function createUserOperation() {
  const getUserOperation = gql.default(({ query }) =>
    query("GetUserById")`($id: ID!) { employee(id: $id) { id name } }`(),
  );

  return getUserOperation;
}

// Case 7: Operation definition in arrow function
// Should be collected with canonical ID: filePath::operationFactory._arrow_0.listUsersOperation
export const operationFactory = () => {
  const listUsersOperation = gql.default(({ query }) =>
    query("ListUsers")`($limit: Int) { employees(limit: $limit) { id name } }`(),
  );

  return listUsersOperation;
};

// Case 8: Nested object structure with operation definitions
// Should be collected with canonical IDs like:
// - filePath::nestedOperations.users.getUser
// - filePath::nestedOperations.users.listUsers
export const nestedOperations = {
  users: {
    getUser: gql.default(({ query }) =>
      query("NestedGetUser")`($id: ID!) { employee(id: $id) { id name } }`(),
    ),
    listUsers: gql.default(({ query }) =>
      query("NestedListUsers")`($limit: Int) { employees(limit: $limit) { id name } }`(),
    ),
  },
};
