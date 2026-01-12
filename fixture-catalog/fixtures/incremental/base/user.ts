import { gql } from "../../../graphql-system";

export const userFragment = gql.default(({ fragment, $var }) =>
  fragment.Employee({
    variables: { ...$var("completed").Boolean("?") },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.tasks({ completed: $.completed })(({ f }) => ({ ...f.id(), ...f.title() })),
    }),
  }),
);

export const userRemote = {
  forIterate: gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) })),
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
