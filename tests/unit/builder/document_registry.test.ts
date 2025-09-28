import { describe, expect, it } from "bun:test";
import { parse } from "graphql";
import { ok } from "neverthrow";

import { type CanonicalId, createCanonicalId, createOperationRegistry } from "../../../packages/builder/src/registry";

describe("canonical identifier helpers", () => {
  it("normalizes absolute file paths and export names", () => {
    const id = createCanonicalId("/app/src/../src/entities/user.ts", "userSlice");
    expect(id).toBe("/app/src/entities/user.ts::userSlice" as unknown as CanonicalId);
  });

  it("guards against relative paths", () => {
    expect(() => createCanonicalId("./user.ts", "userSlice")).toThrow("CANONICAL_ID_REQUIRES_ABSOLUTE_PATH");
  });
});

describe("document registry", () => {
  it("registers refs once and rejects duplicates", () => {
    const registry = createOperationRegistry();
    const id = createCanonicalId("/app/src/entities/user.ts", "userSlice");

    const first = registry.registerRef({
      id,
      kind: "slice",
      metadata: {
        dependencies: [],
        canonicalDocuments: ["ProfilePageQuery"],
      },
      loader: () => ok("userSlice"),
    });

    expect(first.isOk()).toBe(true);

    const duplicate = registry.registerRef({
      id,
      kind: "slice",
      metadata: {
        dependencies: [],
        canonicalDocuments: ["OtherQuery"],
      },
      loader: () => ok("duplicate"),
    });

    expect(duplicate.isErr()).toBe(true);
    duplicate.match(
      () => {
        throw new Error("expected duplicate registration to err");
      },
      (error) => {
        expect(error.code).toBe("REF_ALREADY_REGISTERED");
        expect(error.id).toBe(id);
      },
    );
  });

  it("provides lookup for registered refs", () => {
    const registry = createOperationRegistry();
    const id = createCanonicalId("/app/src/pages/profile.query.ts", "profileQuery");

    registry.registerRef({
      id,
      kind: "operation",
      metadata: {
        canonicalDocument: "ProfilePageQuery",
        dependencies: [],
      },
      loader: () => ok("profileQuery"),
    });

    const ref = registry.getRef(id);

    ref.match(
      (entry) => {
        expect(entry).toEqual({
          id: expect.any(String),
          kind: "operation",
          metadata: {
            canonicalDocument: "ProfilePageQuery",
            dependencies: [],
          },
          loader: expect.any(Function),
        });
      },
      () => {
        throw new Error("expected ref to be present");
      },
    );
  });

  it("registers documents and exposes snapshot", () => {
    const registry = createOperationRegistry();
    const id = createCanonicalId("/app/src/pages/profile.query.ts", "profileQuery");

    registry.registerRef({
      id,
      kind: "operation",
      metadata: {
        canonicalDocument: "ProfilePageQuery",
        dependencies: [],
      },
      loader: () => ok("profileQuery"),
    });

    const registered = registry.registerDocument({
      name: "ProfilePageQuery",
      text: "query ProfilePageQuery($userId: ID!) { users { id } }",
      variableNames: ["userId"],
      ast: parse("query ProfilePageQuery($userId: ID!) { users { id } }"),
    });

    expect(registered.isOk()).toBe(true);

    const snapshot = registry.snapshot();
    expect(snapshot.documents.ProfilePageQuery.text).toContain("ProfilePageQuery");
    expect(snapshot.documents.ProfilePageQuery.variableNames).toEqual(["userId"]);
    expect(snapshot.refs[id]).toEqual({
      kind: "operation",
      metadata: {
        canonicalDocument: "ProfilePageQuery",
        dependencies: [],
      },
    });
  });

  it("fails to register document duplicates", () => {
    const registry = createOperationRegistry();

    const first = registry.registerDocument({
      name: "ProfilePageQuery",
      text: "query ProfilePageQuery { users { id } }",
      variableNames: [],
      ast: parse("query ProfilePageQuery { users { id } }"),
    });

    expect(first.isOk()).toBe(true);

    const duplicate = registry.registerDocument({
      name: "ProfilePageQuery",
      text: "query ProfilePageQuery { users { id name } }",
      variableNames: [],
      ast: parse("query ProfilePageQuery { users { id name } }"),
    });

    expect(duplicate.isErr()).toBe(true);
    duplicate.match(
      () => {
        throw new Error("expected duplicate document to err");
      },
      (error) => {
        expect(error.code).toBe("DOCUMENT_ALREADY_REGISTERED");
        expect(error.name).toBe("ProfilePageQuery");
      },
    );
  });

  it("produces errors when looking up missing refs", () => {
    const registry = createOperationRegistry();
    const lookup = registry.getRef("/app/src/entities/missing.ts::missingRef" as unknown as CanonicalId);

    expect(lookup.isErr()).toBe(true);
    lookup.match(
      () => {
        throw new Error("expected lookup to fail");
      },
      (error) => {
        expect(error.code).toBe("REF_NOT_FOUND");
      },
    );
  });
});
