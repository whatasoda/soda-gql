Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserQuery = exports.updateUserMutation = void 0;

// Simulating webpack ts-loader output (CommonJS format)
// Note: Using plain JavaScript syntax (no TypeScript type annotations)
const graphql_system_1 = { gql: { default: () => {} } };

// Stub dependencies for runtime execution
const userSlice = {};
const updateUserSlice = {};

exports.updateUserMutation = graphql_system_1.gql.default(({ mutation }, { $ }) =>
  mutation(
    "UpdateUser",
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

exports.getUserQuery = graphql_system_1.gql.default(({ query }, { $ }) =>
  query("GetUser", { variables: { ...$("userId").scalar("ID:!") } }, ({ $, getSlice }) => ({
    ...getSlice(userSlice, { id: $.userId }),
  })),
);
