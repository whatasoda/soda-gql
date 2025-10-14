import { describe, expect, it, beforeEach } from "bun:test";
import { DevBuilderSession } from "@soda-gql/plugin-shared/dev";
import type { BuilderServiceController } from "@soda-gql/plugin-shared/dev";
import { createBuilderArtifact } from "../../utils/artifact-fixtures";
import { createCanonicalId } from "@soda-gql/builder";
import { ok, err } from "neverthrow";

describe("DevBuilderSession", () => {
	interface MockController extends BuilderServiceController {
		setArtifact: (artifact: any) => void;
	}

	const createMockController = (): MockController => {
		let artifact = createBuilderArtifact([]);
		let generation = 0;

		return {
			initialized: true,
			build: async () => ok(artifact),
			update: async () => ok(artifact),
			reset: () => {
				// Controller reset should only increment generation
				// It doesn't clear the artifact itself
				generation++;
			},
			getGeneration: () => generation,
			getCurrentArtifact: () => artifact,
			setArtifact: (newArtifact: any) => {
				artifact = newArtifact;
			},
		};
	};

	describe("ensureInitialBuild", () => {
		it("performs initial build and emits artifact event", async () => {
			const controller = createMockController();
			const session = new DevBuilderSession({ controller });

			const events: any[] = [];
			session.subscribe((event) => events.push(event));

			await session.ensureInitialBuild();

			expect(events.length).toBe(1);
			expect(events[0].type).toBe("artifact");
			expect(events[0].source).toBe("initial");
			expect(events[0].artifact).toBeDefined();
			expect(events[0].diff).toBeDefined();
		});

		it("stores artifact as latest", async () => {
			const controller = createMockController();
			const session = new DevBuilderSession({ controller });

			await session.ensureInitialBuild();

			const latest = session.getLatestArtifact();
			expect(latest).not.toBeNull();
		});
	});

	describe("rebuild", () => {
		it("performs manual rebuild and emits artifact event", async () => {
			const controller = createMockController();
			const session = new DevBuilderSession({ controller });

			await session.ensureInitialBuild();

			const events: any[] = [];
			session.subscribe((event) => events.push(event));

			await session.rebuild();

			expect(events.length).toBe(1);
			expect(events[0].type).toBe("artifact");
			expect(events[0].source).toBe("manual");
		});
	});

	describe("diff computation", () => {
		it("detects added elements", async () => {
			const controller = createMockController();
			const session = new DevBuilderSession({ controller });

			// Initial build with no elements
			await session.ensureInitialBuild();

			// Update with new element
			const newArtifact = createBuilderArtifact([
				[
					createCanonicalId("/test/file.ts", "newElement"),
					{
						id: createCanonicalId("/test/file.ts", "newElement"),
						type: "operation",
						prebuild: { operationType: "query" },
					},
				],
			]);

			controller.setArtifact(newArtifact);

			const events: any[] = [];
			session.subscribe((event) => events.push(event));

			await session.rebuild();

			expect(events[0].diff.added.length).toBe(1);
			expect(events[0].diff.removed.length).toBe(0);
			expect(events[0].diff.updated.length).toBe(0);
		});

		it("detects removed elements", async () => {
			const id = createCanonicalId("/test/file.ts", "element");
			const controller = createMockController();

			// Initial artifact with element
			const initialArtifact = createBuilderArtifact([
				[
					id,
					{
						id,
						type: "operation",
						prebuild: { operationType: "query" },
					},
				],
			]);

			controller.setArtifact(initialArtifact);

			const session = new DevBuilderSession({ controller });
			await session.ensureInitialBuild();

			// Remove element
			controller.setArtifact(createBuilderArtifact([]));

			const events: any[] = [];
			session.subscribe((event) => events.push(event));

			await session.rebuild();

			expect(events[0].diff.added.length).toBe(0);
			expect(events[0].diff.removed.length).toBe(1);
			expect(events[0].diff.removed[0]).toBe(id);
		});

		it("detects updated elements", async () => {
			const id = createCanonicalId("/test/file.ts", "element");
			const controller = createMockController();

			// Initial artifact
			const initialArtifact = createBuilderArtifact([
				[
					id,
					{
						id,
						type: "operation",
						prebuild: { operationType: "query", operationName: "Old" },
					},
				],
			]);

			controller.setArtifact(initialArtifact);

			const session = new DevBuilderSession({ controller });
			await session.ensureInitialBuild();

			// Update element (different prebuild causes hash change)
			const updatedArtifact = createBuilderArtifact([
				[
					id,
					{
						id,
						type: "operation",
						prebuild: { operationType: "query", operationName: "New" },
					},
				],
			]);

			controller.setArtifact(updatedArtifact);

			const events: any[] = [];
			session.subscribe((event) => events.push(event));

			await session.rebuild();

			expect(events[0].diff.added.length).toBe(0);
			expect(events[0].diff.removed.length).toBe(0);
			expect(events[0].diff.updated.length).toBe(1);
			expect(events[0].diff.updated[0]).toBe(id);
		});

		it("detects unchanged elements", async () => {
			const id = createCanonicalId("/test/file.ts", "element");
			const controller = createMockController();

			// Initial artifact
			const artifact = createBuilderArtifact([
				[
					id,
					{
						id,
						type: "operation",
						prebuild: { operationType: "query" },
					},
				],
			]);

			controller.setArtifact(artifact);

			const session = new DevBuilderSession({ controller });
			await session.ensureInitialBuild();

			const events: any[] = [];
			session.subscribe((event) => events.push(event));

			await session.rebuild();

			expect(events[0].diff.unchanged.length).toBe(1);
			expect(events[0].diff.unchanged[0]).toBe(id);
		});
	});

	describe("error handling", () => {
		it("emits error event when build fails", async () => {
			const controller = {
				build: async () => err(new Error("Build failed")),
				update: async () => err(new Error("Update failed")),
				reset: () => {},
			} as any;

			const session = new DevBuilderSession({ controller });

			const events: any[] = [];
			session.subscribe((event) => events.push(event));

			await session.ensureInitialBuild();

			expect(events.length).toBe(1);
			expect(events[0].type).toBe("error");
			expect(events[0].source).toBe("initial");
			expect(events[0].error.message).toBe("Build failed");
		});
	});

	describe("reset", () => {
		it("clears previous artifact and hashes", async () => {
			const id = createCanonicalId("/test/file.ts", "element");
			const controller = createMockController();

			const artifact = createBuilderArtifact([
				[
					id,
					{
						id,
						type: "operation",
						prebuild: { operationType: "query" },
					},
				],
			]);

			controller.setArtifact(artifact);

			const session = new DevBuilderSession({ controller });
			await session.ensureInitialBuild();

			expect(session.getLatestArtifact()).not.toBeNull();

			// Reset session (clears previous hashes)
			session.reset();

			// Controller still has artifact, so after reset + rebuild
			// all elements should be detected as "added" (not "unchanged")
			const events: any[] = [];
			session.subscribe((event) => events.push(event));

			await session.rebuild();

			// After reset, session forgot previous state, so element appears as "added"
			expect(events[0].diff.added.length).toBe(1);
			expect(events[0].diff.unchanged.length).toBe(0);
		});
	});

	describe("subscription", () => {
		it("allows subscribing to events", async () => {
			const controller = createMockController();
			const session = new DevBuilderSession({ controller });

			const events: any[] = [];
			const unsubscribe = session.subscribe((event) => events.push(event));

			await session.ensureInitialBuild();

			expect(events.length).toBe(1);

			unsubscribe();

			await session.rebuild();

			// No new events after unsubscribe
			expect(events.length).toBe(1);
		});

		it("supports multiple subscribers", async () => {
			const controller = createMockController();
			const session = new DevBuilderSession({ controller });

			const events1: any[] = [];
			const events2: any[] = [];

			session.subscribe((event) => events1.push(event));
			session.subscribe((event) => events2.push(event));

			await session.ensureInitialBuild();

			expect(events1.length).toBe(1);
			expect(events2.length).toBe(1);
		});
	});
});
