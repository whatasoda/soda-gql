import { join } from "node:path";
import { loadConfig } from "@soda-gql/config";

export const getTestConfig = () =>
  loadConfig(
    join(import.meta.dirname, "../soda-gql.config.ts")
  )._unsafeUnwrap();
