import { describe, expect, it } from "bun:test";
import type { FieldSelection } from "../../types/field-selection";
import { hidden } from "../../types/hidden";
import type { RemoteModel, TransformFunction } from "../../types/remote-model";

describe("RemoteModel type", () => {
  it("should have correct type structure", () => {
    // This test verifies the RemoteModel interface exists and has correct properties
    type UserType = { __typename: "User"; id: string; name: string };
    type TransformedType = { id: string };

    const model: RemoteModel<UserType, TransformedType, {}> = {
      _type: hidden(),
      _transformed: hidden(),
      _params: hidden(),
      typeName: "User",
      fields: ({ fields: _fields, args: _args }) => ({
        id: {
          _type: hidden(),
          key: "id" as const,
          args: {},
          directives: {},
        },
        name: {
          _type: hidden(),
          key: "name" as const,
          args: {},
          directives: {},
        },
      }),
      transform: (data) => ({ id: data.id }),
    };

    expect(model.typeName).toBe("User");
    expect(typeof model.fields).toBe("function");
    expect(typeof model.transform).toBe("function");

    // Test that fields function returns correct selection
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const selection = model.fields({ fields: {} as any, args: undefined });
    expect(selection.id).toBeDefined();
    expect(selection.name).toBeDefined();
    expect(selection.id.key).toBe("id");
    expect(selection.name.key).toBe("name");
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
      _type: hidden(),
      _transformed: hidden(),
      _params: hidden(),
      typeName: "Post",
      fields: ({ fields: _fields, args: _args }) => ({
        id: {
          _type: hidden(),
          key: "id" as const,
          args: {},
          directives: {},
        },
        title: {
          _type: hidden(),
          key: "title" as const,
          args: {},
          directives: {},
        },
      }),
      transform: (data) => data,
    };

    // Define user model with relations
    const userModel: RemoteModel<User, User, {}> = {
      _type: hidden(),
      _transformed: hidden(),
      _params: hidden(),
      typeName: "User",
      fields: ({ fields: _fields, args: _args }) => ({
        id: {
          _type: hidden(),
          key: "id" as const,
          args: {},
          directives: {},
        },
        name: {
          _type: hidden(),
          key: "name" as const,
          args: {},
          directives: {},
        },
        profile: {
          _type: hidden(),
          key: "profile" as const,
          args: {},
          directives: {},
        },
        posts: {
          _type: hidden(),
          key: "posts" as const,
          args: {},
          directives: {},
          selection: {
            Post: postModel.fields({ fields: {}, args: {} }),
          },
        },
        friends: {
          _type: hidden(),
          key: "friends" as const,
          args: {},
          directives: {},
          selection: {
            User: {
              id: {
                _type: hidden(),
                key: "id" as const,
                args: {},
                directives: {},
              },
              name: {
                _type: hidden(),
                key: "name" as const,
                args: {},
                directives: {},
              },
              email: {
                _type: hidden(),
                key: "email" as const,
                args: {},
                directives: {},
              },
            },
          },
        },
      }),
      transform: (data) => data,
    };

    // Test that fields function returns correct selection
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const selection = userModel.fields({ fields: {} as any, args: {} });

    expect(selection.posts).toBeDefined();
    expect(selection.friends).toBeDefined();
    expect(selection.profile).toBeDefined();
    expect(selection.posts.selection).toBeDefined();
    expect(selection.friends.selection).toBeDefined();
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
      _type: hidden(),
      _transformed: hidden(),
      _params: hidden(),
      typeName: "User",
      fields: ({ fields: _fields, args }) => {
        const result: FieldSelection<User> = {
          id: {
            _type: hidden(),
            key: "id" as const,
            args: {},
            directives: {},
          },
          name: {
            _type: hidden(),
            key: "name" as const,
            args: {},
            directives: {},
          },
        };
        // Conditionally include archived field based on parameters
        if (args?.includeArchived) {
          result.archived = {
            _type: hidden(),
            key: "archived" as const,
            args: {},
            directives: {},
          };
        }
        return result;
      },
      transform: (data) => data,
      parameters: { limit: 10, offset: 0, includeArchived: false },
    };

    // Test with default parameters
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const selection1 = model.fields({ fields: {} as any, args: model.parameters });
    expect(selection1.archived).toBeUndefined();

    // Test with custom parameters
    const selection2 = model.fields({
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      fields: {} as any,
      args: { limit: 5, offset: 0, includeArchived: true },
    });
    expect(selection2.archived).toBeDefined();
    expect(selection2.archived?.key).toBe("archived");

    expect(model.parameters).toEqual({ limit: 10, offset: 0, includeArchived: false } as Params);
  });
});
