import { gql } from "../../../graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment`fragment UserFragment($completed: Boolean) on Employee { id name tasks(completed: $completed) { id title } }`(),
);

export const userRemote = {
  forIterate: gql.default(({ fragment }) => fragment`fragment ForIterateFragment on Employee { id name }`()),
};

export const usersQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUsers",
    variables: { ...$var("departmentId").ID("?"), ...$var("limit").Int("?") },
    fields: ({ f, $ }) => ({
      ...f.employees({
        departmentId: $.departmentId,
        limit: $.limit,
      })(({ f }) => ({ ...f.id(), ...f.name() })),
    }),
  }),
);

export const usersQueryCatalog = {
  byId: gql.default(({ query, $var }) =>
    query.operation({
      name: "GetUsersById",
      variables: { ...$var("employeeId").ID("!") },
      fields: ({ f, $ }) => ({
        ...f.employee({ id: $.employeeId })(({ f }) => ({ ...f.id(), ...f.name() })),
      }),
    }),
  ),
};
