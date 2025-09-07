import { describe, expect, it } from "bun:test";
import type { DeepFieldSelection, FieldSelection } from "../../types/field-selection";

describe("FieldSelection type", () => {
  it("should support basic field selection", () => {
    type User = {
      id: string;
      name: string;
      email: string;
      age: number;
    };

    const selection: FieldSelection<User> = {
      id: true,
      name: true,
      email: false,
      age: true,
    };

    expect(selection.id).toBe(true);
    expect(selection.email).toBe(false);
  });

  it("should support nested object selection", () => {
    type Post = {
      id: string;
      title: string;
      author: {
        id: string;
        name: string;
        profile: {
          bio: string;
          avatar: string;
        };
      };
    };

    const selection: FieldSelection<Post> = {
      id: true,
      title: true,
      author: {
        id: true,
        name: true,
        profile: {
          bio: true,
          avatar: false,
        },
      },
    };

    expect(selection.author).toBeDefined();
    expect((selection.author as any).profile.bio).toBe(true);
  });

  it("should support array field selection", () => {
    type Blog = {
      id: string;
      posts: Array<{
        id: string;
        title: string;
        tags: string[];
      }>;
    };

    const selection: FieldSelection<Blog> = {
      id: true,
      posts: {
        id: true,
        title: true,
        tags: true,
      },
    };

    expect(selection.posts).toBeDefined();
    expect((selection.posts as any).tags).toBe(true);
  });

  it("should support deep field selection", () => {
    type DeepStructure = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: string;
            };
          };
        };
      };
    };

    const selection: DeepFieldSelection<DeepStructure> = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: true,
            },
          },
        },
      },
    };

    expect(selection.level1).toBeDefined();
  });

  it("should support conditional field selection", () => {
    type Product = {
      id: string;
      name: string;
      price: number;
      discount?: number;
      metadata?: {
        tags: string[];
        category: string;
      };
    };

    const selection: FieldSelection<Product> = {
      id: true,
      name: true,
      price: true,
      discount: true, // Optional field
      metadata: {
        tags: true,
        category: true,
      },
    };

    expect(selection.discount).toBe(true);
    expect(selection.metadata).toBeDefined();
  });

  it("should support union type selection", () => {
    type SearchResult =
      | { type: "user"; id: string; name: string }
      | { type: "post"; id: string; title: string }
      | { type: "comment"; id: string; content: string };

    // Union types require selecting all possible fields
    const selection: FieldSelection<SearchResult> = {
      type: true,
      id: true,
      name: true,
      title: true,
      content: true,
    } as any;

    expect(selection.type).toBe(true);
    expect(selection.id).toBe(true);
  });

  it("should support partial selection", () => {
    type FullUser = {
      id: string;
      email: string;
      profile: {
        name: string;
        bio: string;
        avatar: string;
        settings: {
          theme: string;
          notifications: boolean;
        };
      };
    };

    // Only select some fields
    const partialSelection: FieldSelection<FullUser> = {
      id: true,
      profile: {
        name: true,
        avatar: true,
        // bio and settings not selected
      },
    };

    expect(partialSelection.email).toBeUndefined();
    expect((partialSelection.profile as any).bio).toBeUndefined();
  });

  it("should handle recursive types", () => {
    type TreeNode = {
      id: string;
      value: string;
      children?: TreeNode[];
    };

    const selection: FieldSelection<TreeNode> = {
      id: true,
      value: true,
      children: {
        id: true,
        value: true,
        children: {
          id: true,
          value: true,
          // Can continue recursively
        },
      },
    };

    expect(selection.children).toBeDefined();
  });
});
