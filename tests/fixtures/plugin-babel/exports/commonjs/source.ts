Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserQuery = exports.updateUserMutation = void 0;

// Simulating webpack ts-loader output (CommonJS format)
// Note: Using plain JavaScript syntax (no TypeScript type annotations)
const graphql_system_1 = { gql: { default: () => {} } };

// Stub dependencies for runtime execution
const userSlice = { build: {} };
const updateUserSlice = { build: {} };

exports.updateUserMutation = graphql_system_1.gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "UpdateUser",
      variables: [
        $("userId").scalar("ID:!"),
        $("name").scalar("String:!"),
      ],
    },
    ({ $ }) => ({
      result: updateUserSlice.build({ id: $.userId, name: $.name }),
    }),
  ),
);

exports.getUserQuery = graphql_system_1.gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "GetUser",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.build({ id: $.userId }),
    }),
  ),
);
