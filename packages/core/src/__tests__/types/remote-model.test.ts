import { describe, expect, it } from "bun:test";
import { hiddenBrand } from "../../types/brand-func";
import type { FieldSelection } from "../../types/field-selection";
import type { RemoteModel, TransformFunction } from "../../types/remote-model";

describe("RemoteModel type", () => {
  it("should have correct type structure", () => {
    // This test verifies the RemoteModel interface exists and has correct properties
    const model: RemoteModel<{ id: string; name: string }, { id: string }, {}> = {
      _type: hiddenBrand(),
      _transformed: hiddenBrand(),
      _params: hiddenBrand(),
      typeName: "User",
      fields: {
        id: true,
        name: true,
      },
      transform: (data) => ({ id: data.id }),
    };

    expect(model.typeName).toBe("User");
    expect(model.fields).toEqual({ id: true, name: true });
    expect(typeof model.transform).toBe("function");
  });

  it("should support nested field selection with __relation__", () => {
    type Post = {
      id: string;
      title: string;
      content: string;
    };

    type User = {
      id: string;
      name: string;
      email: string;
      profile: {
        bio: string;
        avatar: string;
      };
      __relation__: {
        posts: Post[]; // Array relation - selection applies to Post type, not array
        friends: User[]; // Array relation - selection applies to User type, not array
      };
    };

    const fields: FieldSelection<User> = {
      id: true,
      name: true,
      email: false,
      profile: true, // Regular object field, not a relation
      posts: {
        // Relation field from __relation__
        id: true,
        title: true,
        content: false,
      },
      friends: {
        // Nested relation
        id: true,
        name: true,
        email: true,
      },
    };

    expect(fields.posts).toBeDefined();
    expect(fields.friends).toBeDefined();
  });

  it("should support transform function", () => {
    type Raw = { id: string; firstName: string; lastName: string };
    type Transformed = { id: string; fullName: string };

    const transform: TransformFunction<Raw, Transformed> = (data) => ({
      id: data.id,
      fullName: `${data.firstName} ${data.lastName}`,
    });

    const result = transform({ id: "1", firstName: "John", lastName: "Doe" });
    expect(result.fullName).toBe("John Doe");
  });

  it("should support parameters", () => {
    type Params = { limit: number; offset: number };

    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const model: RemoteModel<any, any, Params> = {
      _type: hiddenBrand(),
      _transformed: hiddenBrand(),
      _params: hiddenBrand(),
      typeName: "User",
      fields: {},
      transform: (data) => data,
      parameters: { limit: 10, offset: 0 },
    };

    expect(model.parameters).toEqual({ limit: 10, offset: 0 } as Params);
  });
});
