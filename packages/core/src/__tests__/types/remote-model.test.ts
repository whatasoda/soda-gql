import { describe, expect, it } from "bun:test";
import { hiddenBrand } from "../../types/brand-func";
import type {
  FieldSelection,
  RemoteModel,
  TransformFunction,
} from "../../types/remote-model";

describe("RemoteModel type", () => {
  it("should have correct type structure", () => {
    // This test verifies the RemoteModel interface exists and has correct properties
    const model: RemoteModel<{ id: string; name: string }, { id: string }, {}> =
      {
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

  it("should support nested field selection", () => {
    type User = {
      id: string;
      name: string;
      posts: Post[];
    };

    type Post = {
      id: string;
      title: string;
    };

    const fields: FieldSelection<User> = {
      id: true,
      name: true,
      posts: {
        id: true,
        title: true,
      },
    };

    expect(fields.posts).toBeDefined();
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
