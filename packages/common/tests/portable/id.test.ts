import { describe, test, expect } from "bun:test";
import { generateId } from "@soda-gql/common";

describe("generateId", () => {
	test("generates unique IDs", () => {
		const id1 = generateId();
		const id2 = generateId();

		expect(id1).not.toBe(id2);
	});

	test("generates valid UUID format", () => {
		const id = generateId();
		const uuidRegex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

		expect(id).toMatch(uuidRegex);
	});

	test("generates many unique IDs", () => {
		const ids = new Set<string>();
		const count = 1000;

		for (let i = 0; i < count; i++) {
			ids.add(generateId());
		}

		expect(ids.size).toBe(count);
	});
});
