import { join } from "node:path";
import { __clearGqlCache, createBuilderService } from "@soda-gql/builder";
import { getTestConfig } from "./codegen-fixture/get-config";

// Enable debug output (uncomment to debug)
// process.env.DEBUG_INTERMEDIATE_MODULE = "1";

const baseConfig = getTestConfig();
const graphqlSystemDir = join(import.meta.dirname, "./codegen-fixture/graphql-system");

// Clear cache before starting
__clearGqlCache();

// Test TS analyzer for models/basic first
console.log("\n--- 1. TS analyzer on models/basic ---");
const tsConfig = { ...baseConfig, analyzer: "ts" as const };
const tsService1 = createBuilderService({
  config: {
    ...tsConfig,
    outdir: graphqlSystemDir,
    include: [join(import.meta.dirname, "./fixtures/models/basic/source.ts")],
  },
});
const tsResult1 = tsService1.build();
console.log("Result:", tsResult1.isOk() ? "OK" : tsResult1.error.code);

// Test TS analyzer for operations/basic
console.log("\n--- 2. TS analyzer on operations/basic ---");
const tsService2 = createBuilderService({
  config: {
    ...tsConfig,
    outdir: graphqlSystemDir,
    include: [join(import.meta.dirname, "./fixtures/operations/basic/source.ts")],
  },
});
const tsResult2 = tsService2.build();
console.log("Result:", tsResult2.isOk() ? "OK" : tsResult2.error.code);

// Clear cache before SWC tests
__clearGqlCache();

// Test SWC analyzer for operations/basic FIRST (was 4th, now 3rd)
console.log("\n--- 3. SWC analyzer on operations/basic (FIRST) ---");
const swcConfig = { ...baseConfig, analyzer: "swc" as const };
const swcService2 = createBuilderService({
  config: {
    ...swcConfig,
    outdir: graphqlSystemDir,
    include: [join(import.meta.dirname, "./fixtures/operations/basic/source.ts")],
  },
});
const swcResult2 = swcService2.build();
if (swcResult2.isOk()) {
  console.log("Result: OK");
} else {
  console.log("Result:", swcResult2.error.code);
  console.log("Error:", JSON.stringify(swcResult2.error, null, 2));
}

// Clear cache between SWC builds
__clearGqlCache();

// Test SWC analyzer for models/basic SECOND (was 3rd, now 4th)
console.log("\n--- 4. SWC analyzer on models/basic ---");
const swcService1 = createBuilderService({
  config: {
    ...swcConfig,
    outdir: graphqlSystemDir,
    include: [join(import.meta.dirname, "./fixtures/models/basic/source.ts")],
  },
});
const swcResult1 = swcService1.build();
if (swcResult1.isOk()) {
  console.log("Result: OK");
} else {
  console.log("Result:", swcResult1.error.code);
  console.log("Error:", JSON.stringify(swcResult1.error, null, 2));
}
