import { describe, expect, it } from "bun:test";
import { hiddenBrand } from "../../types/brand-func";
import type { RemoteModel, TransformFunction } from "../../types/remote-model";

describe("RemoteModel type", () => {
  it("should have correct type structure", () => {
    // This test verifies the RemoteModel interface exists and has correct properties
    type UserType = { __typename: "User"; id: string; name: string };
    type TransformedType = { id: string };

    const model: RemoteModel<UserType, TransformedType, {}> = {
      _type: hiddenBrand(),
      _transformed: hiddenBrand(),
      _params: hiddenBrand(),
      typeName: "User",
      fields: (_relation, _args) => ({
        __typename__: "User",
        id: true,
        name: true,
      }),
      transform: (data) => ({ id: data.id }),
    };

    expect(model.typeName).toBe("User");
    expect(typeof model.fields).toBe("function");
    expect(typeof model.transform).toBe("function");

    // Test that fields function returns correct selection
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const selection = model.fields({} as any, undefined);
    expect(selection).toEqual({ __typename__: "User", id: true, name: true });
  });

  it("should support nested field selection with relations", () => {
    type Post = {
      __typename: "Post";
      id: string;
      title: string;
      content: string;
    };

    type User = {
      __typename: "User";
      id: string;
      name: string;
      email: string;
      profile: {
        bio: string;
        avatar: string;
      };
      posts: Post[]; // Array relation - identified by __typename in Post
      friends: User[]; // Array relation - identified by __typename in User
    };

    // Define post model that can be reused
    const postModel: RemoteModel<Post, Post, {}> = {
      _type: hiddenBrand(),
      _transformed: hiddenBrand(),
      _params: hiddenBrand(),
      typeName: "Post",
      fields: () => ({
        __typename__: "Post",
        id: true,
        title: true,
        content: false,
      }),
      transform: (data) => data,
    };

    // Define user model with relations
    const userModel: RemoteModel<User, User, {}> = {
      _type: hiddenBrand(),
      _transformed: hiddenBrand(),
      _params: hiddenBrand(),
      typeName: "User",
      fields: (relation) => ({
        __typename__: "User",
        id: true,
        name: true,
        email: false,
        profile: true, // Regular object field (no __typename), not a relation
        posts: relation("posts", postModel),
        friends: {
          // Can also define inline without using relation function
          __typename__: "User",
          id: true,
          name: true,
          email: true,
        },
      }),
      transform: (data) => data,
    };

    // Test that fields function returns correct selection
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const mockRelation = (_field: string, model: any) => model.fields();
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const selection = userModel.fields(mockRelation as any);

    expect(selection.posts).toBeDefined();
    expect(selection.friends).toBeDefined();
    expect(selection.profile).toBe(true);
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

  it("should support parameters in field selection", () => {
    type Params = { limit: number; offset: number; includeArchived: boolean };
    type User = { __typename: "User"; id: string; name: string; archived: boolean };

    const model: RemoteModel<User, User, Params> = {
      _type: hiddenBrand(),
      _transformed: hiddenBrand(),
      _params: hiddenBrand(),
      typeName: "User",
      fields: (_relation, args) => ({
        __typename__: "User",
        id: true,
        name: true,
        // Conditionally include archived field based on parameters
        archived: args?.includeArchived ?? false,
      }),
      transform: (data) => data,
      parameters: { limit: 10, offset: 0, includeArchived: false },
    };

    // Test with default parameters
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const selection1 = model.fields({} as any, model.parameters);
    expect(selection1.archived).toBe(false);

    // Test with custom parameters
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const selection2 = model.fields({} as any, { limit: 5, offset: 0, includeArchived: true });
    expect(selection2.archived).toBe(true);

    expect(model.parameters).toEqual({ limit: 10, offset: 0, includeArchived: false } as Params);
  });
});
