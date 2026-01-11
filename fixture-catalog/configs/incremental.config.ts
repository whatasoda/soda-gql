import { join } from "node:path";
import { defineConfig } from "@soda-gql/config";
import { baseConfig, fixturesRoot } from "./_base";

export default defineConfig({
  ...baseConfig,
  include: [join(fixturesRoot, "incremental/base/**/*.ts")],
});
