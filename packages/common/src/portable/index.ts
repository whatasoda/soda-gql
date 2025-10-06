/**
 * Portable APIs for runtime-agnostic code (Bun + Node.js)
 */

export {
	createPortableFS,
	getPortableFS,
	__resetPortableFSForTests,
	type PortableFS,
} from "./fs";

export {
	createPortableHasher,
	getPortableHasher,
	__resetPortableHasherForTests,
	type PortableHasher,
	type HashAlgorithm,
} from "./hash";

export { generateId } from "./id";

export { spawn, type SpawnOptions, type SpawnResult } from "./spawn";

export { runtime, once, resetPortableForTests } from "./runtime";
