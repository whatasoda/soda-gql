#!/usr/bin/env bun
/**
 * Exports GraphQL schema from running Hasura instance.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildClientSchema, getIntrospectionQuery, printSchema } from "graphql";

const HASURA_ENDPOINT =
  process.env.HASURA_ENDPOINT || "http://localhost:8080/v1/graphql";
const HASURA_ADMIN_SECRET =
  process.env.HASURA_ADMIN_SECRET || "my-admin-secret";

async function exportSchema(): Promise<void> {
  console.log(`Fetching schema from ${HASURA_ENDPOINT}...`);

  const response = await fetch(HASURA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hasura-Admin-Secret": HASURA_ADMIN_SECRET,
    },
    body: JSON.stringify({
      query: getIntrospectionQuery(),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch schema: ${response.status} ${response.statusText}`
    );
  }

  const result = (await response.json()) as {
    data?: unknown;
    errors?: Array<{ message: string }>;
  };

  if (result.errors) {
    throw new Error(
      `GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`
    );
  }

  if (!result.data) {
    throw new Error("No data returned from introspection query");
  }

  const schema = buildClientSchema(
    result.data as Parameters<typeof buildClientSchema>[0]
  );
  const schemaString = printSchema(schema);

  const outputPath = join(import.meta.dirname, "..", "schema.graphql");
  await writeFile(outputPath, schemaString);

  // Count types
  const typeCount = schemaString.match(/^type /gm)?.length || 0;
  const inputCount = schemaString.match(/^input /gm)?.length || 0;
  const enumCount = schemaString.match(/^enum /gm)?.length || 0;
  const lineCount = schemaString.split("\n").length;

  console.log(`Schema exported to: ${outputPath}`);
  console.log(`Statistics:`);
  console.log(`  - Types: ${typeCount}`);
  console.log(`  - Inputs: ${inputCount}`);
  console.log(`  - Enums: ${enumCount}`);
  console.log(`  - Lines: ${lineCount}`);
}

exportSchema().catch((error) => {
  console.error("Failed to export schema:", error);
  process.exit(1);
});
