import { gql } from "@/graphql-system";

/**
 * Query operation to fetch a single user
 */
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      operationName: "GetUser",
      variables: [
        $var("userId").scalar("ID:!"),
        $var("categoryId").scalar("ID:!"),
      ],
    },
    ({ f, $ }) => [
      f.user({ id: $.userId })(({ f }) => [
        f.id(),
        f.name(),
        f.email(),
        f.posts({ categoryId: $.categoryId })(({ f }) => [
          f.id(),
          f.title(),
        ]),
      ]),
    ],
  ),
);

/**
 * Query operation to fetch multiple users
 */
export const listUsersQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      operationName: "ListUsers",
      variables: [$var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      f.users({ categoryId: $.categoryId })(({ f }) => [
        f.id(),
        f.name(),
        f.email(),
      ]),
    ],
  ),
);

/**
 * Mutation operation to update user
 */
export const updateUserMutation = gql.default(({ mutation }, { $var }) =>
  mutation.operation(
    {
      operationName: "UpdateUser",
      variables: [
        $var("userId").scalar("ID:!"),
        $var("name").scalar("String:!"),
      ],
    },
    ({ f, $ }) => [
      f.updateUser({ id: $.userId, name: $.name })(({ f }) => [
        f.id(),
        f.name(),
        f.email(),
      ]),
    ],
  ),
);

/**
 * Subscription operation for user updates
 */
export const userUpdatesSubscription = gql.default(({ subscription }, { $var }) =>
  subscription.operation(
    {
      operationName: "UserUpdates",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [
      f.userUpdated({ userId: $.userId })(({ f }) => [
        f.id(),
        f.name(),
        f.email(),
      ]),
    ],
  ),
);

/**
 * Query operation with helpers (auth + cache metadata)
 */
export const getProtectedUserQuery = gql.default(({ query }, { $var, auth, cache }) =>
  query.operation(
    {
      operationName: "GetProtectedUser",
      variables: [$var("userId").scalar("ID:!"), $var("categoryId").scalar("ID:!")],
      metadata: ({ $ }) => ({
        custom: {
          ...auth.requiresLogin(),
          ...cache.ttl(300),
          trackedVariables: [$var.getName($.userId)],
        },
      }),
    },
    ({ f, $ }) => [
      f.user({ id: $.userId })(({ f }) => [
        f.id(),
        f.name(),
        f.email(),
        f.posts({ categoryId: $.categoryId })(({ f }) => [
          f.id(),
          f.title(),
        ]),
      ]),
    ],
  ),
);
