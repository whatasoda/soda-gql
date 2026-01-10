import { defineConfig } from "@soda-gql/config";
import { join } from "node:path";
import { baseConfig, fixturesRoot } from "./_base";

export default defineConfig({
  ...baseConfig,
  include: [join(fixturesRoot, "incremental/base/**/*.ts")],
});
