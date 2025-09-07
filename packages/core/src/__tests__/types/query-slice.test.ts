import { describe, expect, it } from "bun:test";
import { hiddenBrand } from "../../types/brand-func";
import type {
  QuerySlice,
  SelectionBuilder,
  TransformFunction,
} from "../../types/query-slice";

describe("QuerySlice type", () => {
  it("should have correct type structure", () => {
    type UserData = { id: string; name: string };
    type UserArgs = { id: string };

    const slice: QuerySlice<UserData, UserArgs> = {
      _data: hiddenBrand(),
      _args: hiddenBrand(),
      sliceKey: "user-by-id",
      name: "user",
      selections: (_query, args) => ({
        id: args.id,
        name: "John",
      }),
      transform: (data) => data,
    };

    expect(slice.name).toBe("user");
    expect(slice.sliceKey).toBe("user-by-id");
    expect(typeof slice.selections).toBe("function");
    expect(typeof slice.transform).toBe("function");
  });

  it("should support selection builder", () => {
    const mockBuilder: SelectionBuilder = {
      select: (_field: string) => true,
      relation: (_field: string, model: any) => model,
      argument: (name: string, value: any) => ({ name, value }),
    };

    expect(mockBuilder.select("id")).toBe(true);
    expect(mockBuilder.relation("posts", {})).toEqual({});
    expect(mockBuilder.argument("limit", 10)).toEqual({
      name: "limit",
      value: 10,
    });
  });

  it("should work without arguments", () => {
    type AllUsersData = { users: Array<{ id: string; name: string }> };

    const slice: QuerySlice<AllUsersData, {}> = {
      _data: hiddenBrand(),
      _args: hiddenBrand(),
      sliceKey: "all-users",
      name: "users",
      selections: (_query) => ({
        users: [{ id: "1", name: "User 1" }],
      }),
      transform: (data) => data,
    };

    expect(slice.name).toBe("users");
  });

  it("should support transform function", () => {
    type RawData = {
      user: { id: string; first_name: string; last_name: string };
    };
    type TransformedData = { id: string; fullName: string };

    const transform: TransformFunction<RawData, TransformedData> = (data) => ({
      id: data.user.id,
      fullName: `${data.user.first_name} ${data.user.last_name}`,
    });

    const result = transform({
      user: { id: "1", first_name: "John", last_name: "Doe" },
    });

    expect(result.fullName).toBe("John Doe");
  });

  it("should support complex arguments", () => {
    type SearchArgs = {
      query: string;
      filters: {
        status: string[];
        dateRange: { from: Date; to: Date };
      };
      pagination: {
        limit: number;
        offset: number;
      };
    };

    type SearchData = {
      results: Array<{ id: string; title: string }>;
      total: number;
    };

    const slice: QuerySlice<SearchData, SearchArgs> = {
      _data: hiddenBrand(),
      _args: hiddenBrand(),
      sliceKey: "search",
      name: "search",
      selections: (_query, _args) => ({
        results: [],
        total: 0,
      }),
      transform: (data) => data,
    };

    expect(slice.sliceKey).toBe("search");
  });
});
