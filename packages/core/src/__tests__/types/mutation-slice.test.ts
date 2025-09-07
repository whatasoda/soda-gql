import { describe, expect, it } from "bun:test";
import { hiddenBrand } from "../../types/brand-func";
import type { MutationSlice, TransformFunction } from "../../types/mutation-slice";

describe("MutationSlice type", () => {
  it("should have correct type structure", () => {
    type CreateUserData = {
      createUser: { id: string; name: string; email: string };
    };
    type CreateUserArgs = { input: { name: string; email: string } };

    const slice: MutationSlice<CreateUserData, CreateUserArgs> = {
      _data: hiddenBrand(),
      _args: hiddenBrand(),
      sliceKey: "create-user",
      name: "createUser",
      selections: (_mutate, args) => ({
        createUser: {
          id: "123",
          name: args.input.name,
          email: args.input.email,
        },
      }),
      transform: (data) => data,
    };

    expect(slice.name).toBe("createUser");
    expect(slice.sliceKey).toBe("create-user");
    expect(typeof slice.selections).toBe("function");
    expect(typeof slice.transform).toBe("function");
  });

  it("should support update mutations", () => {
    type UpdateUserData = {
      updateUser: {
        id: string;
        name: string;
        updatedAt: string;
      };
    };
    type UpdateUserArgs = {
      id: string;
      input: {
        name?: string;
        email?: string;
      };
    };

    const slice: MutationSlice<UpdateUserData, UpdateUserArgs> = {
      _data: hiddenBrand(),
      _args: hiddenBrand(),
      sliceKey: "update-user",
      name: "updateUser",
      selections: (_mutate, args) => ({
        updateUser: {
          id: args.id,
          name: args.input.name || "",
          updatedAt: new Date().toISOString(),
        },
      }),
      transform: (data) => data,
    };

    expect(slice.sliceKey).toBe("update-user");
  });

  it("should support delete mutations", () => {
    type DeleteUserData = { deleteUser: { success: boolean; message: string } };
    type DeleteUserArgs = { id: string };

    const slice: MutationSlice<DeleteUserData, DeleteUserArgs> = {
      _data: hiddenBrand(),
      _args: hiddenBrand(),
      sliceKey: "delete-user",
      name: "deleteUser",
      selections: (_mutate, args) => ({
        deleteUser: {
          success: true,
          message: `User ${args.id} deleted`,
        },
      }),
      transform: (data) => data,
    };

    expect(slice.name).toBe("deleteUser");
  });

  it("should support batch mutations", () => {
    type BatchCreateData = {
      batchCreate: {
        created: Array<{ id: string; name: string }>;
        errors: Array<{ index: number; message: string }>;
      };
    };
    type BatchCreateArgs = {
      items: Array<{ name: string; email: string }>;
    };

    const slice: MutationSlice<BatchCreateData, BatchCreateArgs> = {
      _data: hiddenBrand(),
      _args: hiddenBrand(),
      sliceKey: "batch-create",
      name: "batchCreate",
      selections: (_mutate, args) => ({
        batchCreate: {
          created: args.items.map((item, i) => ({
            id: `${i}`,
            name: item.name,
          })),
          errors: [],
        },
      }),
      transform: (data) => data,
    };

    expect(slice.sliceKey).toBe("batch-create");
  });

  it("should support transform function for normalizing response", () => {
    type RawResponse = {
      mutation: {
        user: {
          id: string;
          first_name: string;
          last_name: string;
          created_at: string;
        };
      };
    };

    type NormalizedUser = {
      id: string;
      fullName: string;
      createdAt: Date;
    };

    const transform: TransformFunction<RawResponse, NormalizedUser> = (data) => ({
      id: data.mutation.user.id,
      fullName: `${data.mutation.user.first_name} ${data.mutation.user.last_name}`,
      createdAt: new Date(data.mutation.user.created_at),
    });

    const result = transform({
      mutation: {
        user: {
          id: "1",
          first_name: "Jane",
          last_name: "Smith",
          created_at: "2024-01-01T00:00:00Z",
        },
      },
    });

    expect(result.fullName).toBe("Jane Smith");
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});
