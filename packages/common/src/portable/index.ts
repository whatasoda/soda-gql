/**
 * Portable APIs for runtime-agnostic code (Bun + Node.js)
 */

export {
  __resetPortableFSForTests,
  createPortableFS,
  getPortableFS,
  type PortableFS,
} from "./fs";

export {
  __resetPortableHasherForTests,
  createPortableHasher,
  getPortableHasher,
  type HashAlgorithm,
  type PortableHasher,
} from "./hash";

export { generateId } from "./id";
export { once, resetPortableForTests, runtime } from "./runtime";
export { type SpawnOptions, type SpawnResult, spawn } from "./spawn";
