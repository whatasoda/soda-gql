import { describe, expect, it } from "bun:test";
import { ok } from "neverthrow";

import { createCanonicalId, createDocumentRegistry } from "../../../packages/builder/src/registry";

describe("canonical identifier helpers", () => {
  it("normalises absolute file paths and export names", () => {
    const id = createCanonicalId("/app/src/../src/entities/user.ts", "userSlice");
    expect(id).toBe("/app/src/entities/user.ts::userSlice");
  });

  it("guards against relative paths", () => {
    expect(() => createCanonicalId("./user.ts", "userSlice")).toThrow("CANONICAL_ID_REQUIRES_ABSOLUTE_PATH");
  });
});

describe("document registry", () => {
  it("registers refs once and rejects duplicates", () => {
    const registry = createDocumentRegistry();
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
    const registry = createDocumentRegistry();
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
        expect(entry.kind).toBe("operation");
        expect(entry.metadata.canonicalDocument).toBe("ProfilePageQuery");
      },
      () => {
        throw new Error("expected ref to be present");
      },
    );
  });

  it("registers documents and exposes snapshot", () => {
    const registry = createDocumentRegistry();
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
      text: "query ProfilePageQuery { users { id } }",
      variables: {
        userId: "ID!",
      },
    });

    expect(registered.isOk()).toBe(true);

    const snapshot = registry.snapshot();
    expect(snapshot.documents.ProfilePageQuery.text).toContain("ProfilePageQuery");
    expect(snapshot.documents.ProfilePageQuery.variables).toEqual({ userId: "ID!" });
    expect(snapshot.refs[id].kind).toBe("operation");
    expect(snapshot.refs[id].metadata.canonicalDocument).toBe("ProfilePageQuery");
    expect(snapshot.refs[id].metadata.dependencies).toEqual([]);
  });

  it("fails to register document duplicates", () => {
    const registry = createDocumentRegistry();

    const first = registry.registerDocument({
      name: "ProfilePageQuery",
      text: "query ProfilePageQuery { users { id } }",
      variables: {},
    });

    expect(first.isOk()).toBe(true);

    const duplicate = registry.registerDocument({
      name: "ProfilePageQuery",
      text: "query ProfilePageQuery { users { id name } }",
      variables: {},
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
    const registry = createDocumentRegistry();
    const lookup = registry.getRef("/app/src/entities/missing.ts::missingRef");

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
