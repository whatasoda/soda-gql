Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserQuery = void 0;

// Simulating webpack ts-loader output with multiple require() calls
const graphql_system_1 = require("@soda-gql/core");
const slices_1 = require("./slices");

exports.getUserQuery = graphql_system_1.gql.default(({ query }, { $ }) =>
  query("GetUser", { variables: { ...$(": userId").scalar("ID:!") } }, ({ getSlice }) => ({
    ...getSlice(slices_1.userSlice, {}),
  })),
);
