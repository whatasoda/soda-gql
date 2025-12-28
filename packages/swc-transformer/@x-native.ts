import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const native = require("./src/native/index.cjs");
export const { transform, SwcTransformer } = native;
