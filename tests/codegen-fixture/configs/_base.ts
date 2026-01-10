import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(__dirname, "..");

export const baseConfig = {
  outdir: join(fixtureRoot, "graphql-system"),
  analyzer: "ts" as const,
  schemas: {
    default: {
      schema: join(fixtureRoot, "schemas/default/schema.graphql"),
      inject: { scalars: join(fixtureRoot, "schemas/default/scalars.ts") },
    },
    admin: {
      schema: join(fixtureRoot, "schemas/admin/schema.graphql"),
      inject: { scalars: join(fixtureRoot, "schemas/admin/scalars.ts") },
    },
  },
};

export const fixturesRoot = join(fixtureRoot, "fixtures");
