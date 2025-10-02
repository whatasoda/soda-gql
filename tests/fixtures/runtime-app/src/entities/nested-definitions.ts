import { gql } from "@/graphql-system";

// Case 1: Non-exported top-level definition (used internally only)
const internalModel = gql.default(({ model }) =>
  model(
    { typename: "Internal" },
    ({ f }) => ({
      ...f.id(),
    }),
    (selection) => ({ id: selection.id }),
  ),
);

// Case 2: Exported definition using internal model
export const publicModel = gql.default(({ model }) =>
  model(
    { typename: "Public" },
    ({ f }) => ({
      ...f.id(),
      ...f.internal(() => ({
        ...internalModel.fragment(),
      })),
    }),
    (selection) => ({
      id: selection.id,
      internal: internalModel.normalize(selection.internal),
    }),
  ),
);

// Case 3: Nested definitions in function scope
export function createUserQueries() {
  const userById = gql.default(({ slice }) =>
    slice.query(
      { variables: {} },
      ({ f }) => ({
        ...f.user({ id: "1" }, ({ f }) => ({
          ...f.id(),
          ...f.name(),
        })),
      }),
      ({ select }) => select(["$.user"], (result) => result),
    ),
  );

  const userList = gql.default(({ slice }) =>
    slice.query(
      { variables: {} },
      ({ f }) => ({
        ...f.users({ limit: 10 }, ({ f }) => ({
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
export const queryFactory = () => {
  const baseQuery = gql.default(({ slice }) =>
    slice.query(
      { variables: {} },
      ({ f }) => ({
        ...f.id(),
      }),
      ({ select }) => select(["$.id"], (result) => result),
    ),
  );

  return {
    base: baseQuery,
    extended: gql.default(({ slice }) =>
      slice.query(
        { variables: {} },
        ({ f }) => ({
          ...f.id(),
          ...f.name(),
        }),
        ({ select }) => select(["$.id", "$.name"], (result) => result),
      ),
    ),
  };
};

// Case 5: Class with method containing definitions
export class QueryBuilder {
  buildUserQuery() {
    const userQuery = gql.default(({ slice }) =>
      slice.query(
        { variables: {} },
        ({ f }) => ({
          ...f.user({ id: "1" }, ({ f }) => ({
            ...f.id(),
          })),
        }),
        ({ select }) => select(["$.user"], (result) => result),
      ),
    );

    return userQuery;
  }

  static buildStaticQuery() {
    return gql.default(({ slice }) =>
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
  }
}

// Case 6: Deeply nested object structure
export const queries = {
  users: {
    list: gql.default(({ slice }) =>
      slice.query(
        { variables: {} },
        ({ f }) => ({
          ...f.users({ limit: 10 }, ({ f }) => ({
            ...f.id(),
          })),
        }),
        ({ select }) => select(["$.users"], (result) => result),
      ),
    ),
    byId: gql.default(({ slice }) =>
      slice.query(
        { variables: {} },
        ({ f }) => ({
          ...f.user({ id: "1" }, ({ f }) => ({
            ...f.id(),
          })),
        }),
        ({ select }) => select(["$.user"], (result) => result),
      ),
    ),
  },
  posts: {
    list: gql.default(({ slice }) =>
      slice.query(
        { variables: {} },
        ({ f }) => ({
          ...f.posts({ limit: 10 }, ({ f }) => ({
            ...f.id(),
          })),
        }),
        ({ select }) => select(["$.posts"], (result) => result),
      ),
    ),
  },
};
