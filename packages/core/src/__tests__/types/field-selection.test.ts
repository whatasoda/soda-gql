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

  it("should distinguish between relations and regular objects using __relation__", () => {
    type Author = {
      id: string;
      name: string;
      bio: string;
    };

    type Post = {
      id: string;
      title: string;
      metadata: {
        // Regular object, not a relation
        createdAt: string;
        updatedAt: string;
        version: number;
      };
      __relation__: {
        author: Author;
        comments: Array<{
          id: string;
          content: string;
        }>;
      };
    };

    const selection: FieldSelection<Post> = {
      id: true,
      title: true,
      metadata: true, // Regular object field - can only be boolean
      author: {
        // Relation field - can be nested selection
        id: true,
        name: true,
        bio: false,
      },
      comments: {
        id: true,
        content: true,
      },
    };

    expect(selection.metadata).toBe(true);
    expect(selection.author).toBeDefined();
    expect((selection.author as any).name).toBe(true);
  });

  it("should support array relations via __relation__", () => {
    type Post = {
      id: string;
      title: string;
      content: string;
    };

    type Blog = {
      id: string;
      title: string;
      tags: string[]; // Simple array, not a relation
      __relation__: {
        posts: Post[]; // Array relation - selection applies to Post type
        featuredPost: Post; // Single relation
      };
    };

    const selection: FieldSelection<Blog> = {
      id: true,
      title: true,
      tags: true, // Simple array field - boolean only
      posts: {
        // Array relation - selection applies to each Post element
        id: true,
        title: true,
        content: false,
      },
      featuredPost: {
        // Single relation - same selection structure
        id: true,
        title: true,
        content: true,
      },
    };

    expect(selection.tags).toBe(true);
    expect(selection.posts).toBeDefined();
    expect((selection.posts as any).title).toBe(true);
    // Both array and single relations use same selection structure
    expect(typeof selection.posts).toBe(typeof selection.featuredPost);
  });

  it("should support deep field selection with __relation__", () => {
    type Level4 = {
      value: string;
    };

    type Level3 = {
      name: string;
      __relation__: {
        level4: Level4;
      };
    };

    type Level2 = {
      id: string;
      __relation__: {
        level3: Level3;
      };
    };

    type DeepStructure = {
      rootData: string;
      __relation__: {
        level1: {
          data: string;
          __relation__: {
            level2: Level2;
          };
        };
      };
    };

    const selection: DeepFieldSelection<DeepStructure> = {
      rootData: true,
      level1: {
        data: true,
        level2: {
          id: true,
          level3: {
            name: true,
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

  it("should handle nested array relations", () => {
    type Comment = {
      id: string;
      text: string;
      __relation__: {
        replies: Comment[]; // Recursive array relation
      };
    };

    type Post = {
      id: string;
      title: string;
      __relation__: {
        comments: Comment[];
      };
    };

    const selection: FieldSelection<Post> = {
      id: true,
      title: true,
      comments: {
        // Selection for Comment array elements
        id: true,
        text: true,
        replies: {
          // Nested array relation - still selects element fields
          id: true,
          text: true,
          replies: {
            // Can continue recursively
            id: true,
            text: false,
          },
        },
      },
    };

    expect(selection.comments).toBeDefined();
    expect((selection.comments as any).replies).toBeDefined();
  });

  it("should handle recursive types with __relation__", () => {
    type TreeNode = {
      id: string;
      value: string;
      metadata: {
        depth: number;
        path: string;
      };
      __relation__: {
        parent?: TreeNode;
        children?: TreeNode[];
      };
    };

    const selection: FieldSelection<TreeNode> = {
      id: true,
      value: true,
      metadata: true, // Regular object - boolean only
      parent: {
        // Relation - nested selection
        id: true,
        value: true,
        metadata: true,
      },
      children: {
        id: true,
        value: true,
        children: {
          // Can continue recursively through relations
          id: true,
          value: true,
        },
      },
    };

    expect(selection.children).toBeDefined();
    expect(selection.parent).toBeDefined();
  });
});
