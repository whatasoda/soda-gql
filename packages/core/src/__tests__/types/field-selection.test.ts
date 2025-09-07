import { describe, expect, it } from "bun:test";
import type { FieldSelection } from "../../types/field-selection";

describe("FieldSelection type", () => {
  it("should support basic field selection", () => {
    type User = {
      __typename: "User";
      id: string;
      name: string;
      email: string;
      age: number;
    };

    const selection: FieldSelection<User> = {
      __typename__: "User",
      id: true,
      name: true,
      email: false,
      age: true,
    };

    expect(selection.id).toBe(true);
    expect(selection.email).toBe(false);
  });

  it("should support nested __relation__ in relation types", () => {
    type Tag = {
      __typename: "Tag";
      id: string;
      name: string;
      color: string;
    };

    type Category = {
      __typename: "Category";
      id: string;
      name: string;
      description: string;
      __relation__: {
        parent: Category; // Self-reference
        tags: Tag[];
      };
    };

    type Post = {
      __typename: "Post";
      id: string;
      title: string;
      content: string;
      metadata: {
        views: number;
        likes: number;
      };
      __relation__: {
        author: {
          __typename: "Author";
          // Inline type with nested __relation__
          id: string;
          name: string;
          verified: boolean;
          __relation__: {
            profile: {
              __typename: "Profile";
              bio: string;
              website: string;
              __relation__: {
                socialLinks: Array<{
                  __typename: "SocialLink";
                  platform: string;
                  url: string;
                }>;
              };
            };
            posts: Post[]; // Recursive reference
          };
        };
        category: Category; // Type with its own __relation__
      };
    };

    const selection: FieldSelection<Post> = {
      __typename__: "Post",
      id: true,
      title: true,
      content: false,
      metadata: true, // Regular object - boolean only
      author: {
        __typename__: "Author",
        id: true,
        name: true,
        verified: true,
        profile: {
          __typename__: "Profile",
          // Nested __relation__ access
          bio: true,
          website: false,
          socialLinks: {
            __typename__: "SocialLink",
            platform: true,
            url: true,
          },
        },
        posts: {
          __typename__: "Post",
          // Recursive selection
          id: true,
          title: true,
          metadata: true,
        },
      },
      category: {
        __typename__: "Category",
        id: true,
        name: true,
        description: false,
        parent: {
          __typename__: "Category",
          // Nested relation from Category's __relation__
          id: true,
          name: true,
          description: true,
        },
        tags: {
          __typename__: "Tag",
          id: true,
          name: true,
          color: false,
        },
      },
    };

    expect(selection.author).toBeDefined();
    expect(selection.author?.profile).toBeDefined();
    expect(selection.category?.parent).toBeDefined();
  });

  it("should distinguish between relations and regular objects using __relation__", () => {
    type Author = {
      __typename: "Author";
      id: string;
      name: string;
      bio: string;
    };

    type Post = {
      __typename: "Post";
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
          __typename: "Comment";
          id: string;
          content: string;
        }>;
      };
    };

    const selection: FieldSelection<Post> = {
      __typename__: "Post",
      id: true,
      title: true,
      metadata: true, // Regular object field - can only be boolean
      author: {
        __typename__: "Author",
        // Relation field - can be nested selection
        id: true,
        name: true,
        bio: false,
      },
      comments: {
        __typename__: "Comment",
        id: true,
        content: true,
      },
    };

    expect(selection.metadata).toBe(true);
    expect(selection.author).toBeDefined();
    expect(selection.author?.name).toBe(true);
  });

  it("should support array relations via __relation__", () => {
    type Post = {
      __typename: "Post";
      id: string;
      title: string;
      content: string;
    };

    type Blog = {
      __typename: "Blog";
      id: string;
      title: string;
      tags: string[]; // Simple array, not a relation
      __relation__: {
        posts: Post[]; // Array relation - selection applies to Post type
        featuredPost: Post; // Single relation
      };
    };

    const selection: FieldSelection<Blog> = {
      __typename__: "Blog",
      id: true,
      title: true,
      tags: true, // Simple array field - boolean only
      posts: {
        __typename__: "Post",
        // Array relation - selection applies to each Post element
        id: true,
        title: true,
        content: false,
      },
      featuredPost: {
        __typename__: "Post",
        // Single relation - same selection structure
        id: true,
        title: true,
        content: true,
      },
    };

    expect(selection.tags).toBe(true);
    expect(selection.posts).toBeDefined();
    expect(selection.posts?.title).toBe(true);
    // Both array and single relations use same selection structure
    expect(typeof selection.posts).toBe(typeof selection.featuredPost);
  });

  it("should support deep field selection with nested __relation__", () => {
    type Address = {
      street: string;
      city: string;
      country: string;
    };

    type Company = {
      __typename: "Company";
      id: string;
      name: string;
      address: Address; // Regular nested object
      __relation__: {
        employees: Array<{
          __typename: "Employee";
          id: string;
          name: string;
          role: string;
        }>;
      };
    };

    type User = {
      __typename: "User";
      id: string;
      name: string;
      profile: {
        bio: string;
        avatar: string;
      };
      __relation__: {
        company: Company;
        manager: {
          __typename: "Manager";
          id: string;
          name: string;
          level: number;
          __relation__: {
            // Nested __relation__ inside a relation
            department: {
              __typename: "Department";
              id: string;
              name: string;
              budget: number;
              __relation__: {
                // Another level of nested __relation__
                head: {
                  __typename: "DepartmentHead";
                  id: string;
                  name: string;
                  title: string;
                };
                projects: Array<{
                  __typename: "Project";
                  id: string;
                  name: string;
                  status: string;
                }>;
              };
            };
            reports: User[]; // Recursive reference
          };
        };
      };
    };

    const selection: FieldSelection<User> = {
      __typename__: "User",
      id: true,
      name: true,
      profile: true, // Regular object - boolean only
      company: {
        __typename__: "Company",
        id: true,
        name: true,
        address: true, // Regular nested object inside relation - boolean only
        employees: {
          __typename__: "Employee",
          id: true,
          name: true,
          role: false,
        },
      },
      manager: {
        __typename__: "Manager",
        id: true,
        name: true,
        level: true,
        department: {
          __typename__: "Department",
          // Accessing nested __relation__
          id: true,
          name: true,
          budget: false,
          head: {
            __typename__: "DepartmentHead",
            // Another level deep
            id: true,
            name: true,
            title: true,
          },
          projects: {
            __typename__: "Project",
            id: true,
            name: true,
            status: true,
          },
        },
        reports: {
          __typename__: "User",
          // Recursive selection
          id: true,
          name: true,
          profile: true,
        },
      },
    };

    expect(selection.manager).toBeDefined();
    expect(selection.manager?.department).toBeDefined();
    expect(selection.manager?.department?.head).toBeDefined();
  });

  it("should support conditional field selection", () => {
    type Review = {
      __typename: "Review";
      id: string;
      rating: number;
      comment: string;
    };

    type Product = {
      __typename: "Product";
      id: string;
      name: string;
      price: number;
      discount?: number;
      metadata?: {
        tags: string[];
        category: string;
      };
      __relation__: {
        reviews?: Review[]; // Optional relation
        relatedProducts?: Product[]; // Optional recursive relation
      };
    };

    const selection: FieldSelection<Product> = {
      __typename__: "Product",
      id: true,
      name: true,
      price: true,
      discount: true, // Optional scalar field
      metadata: true, // Optional object field - boolean only
      reviews: {
        __typename__: "Review",
        // Optional relation - can have nested selection
        id: true,
        rating: true,
        comment: false,
      },
      relatedProducts: {
        __typename__: "Product",
        id: true,
        name: true,
        price: true,
      },
    };

    expect(selection.discount).toBe(true);
    expect(selection.metadata).toBe(true);
    expect(selection.reviews).toBeDefined();
  });

  it("should support union type selection", () => {
    type SearchResult =
      | { __typename: "User"; id: string; name: string }
      | { __typename: "Post"; id: string; title: string }
      | { __typename: "Comment"; id: string; content: string };

    // Union types require selecting __typename and all possible fields
    const selection: FieldSelection<SearchResult> = {
      __typename__: "User",
      id: true,
      name: true,
    };

    expect(selection.__typename__).toBe("User");
    expect(selection.id).toBe(true);
  });

  it("should support partial selection", () => {
    type Post = {
      __typename: "Post";
      id: string;
      title: string;
      content: string;
    };

    type Settings = {
      __typename: "Settings";
      theme: string;
      notifications: boolean;
      privacy: string;
    };

    type FullUser = {
      __typename: "FullUser";
      id: string;
      email: string;
      profile: {
        name: string;
        bio: string;
        avatar: string;
      };
      __relation__: {
        posts: Post[];
        followers: FullUser[];
        settings: Settings;
      };
    };

    // Only select some fields
    const partialSelection: FieldSelection<FullUser> = {
      __typename__: "FullUser",
      id: true,
      // email not selected
      profile: true, // Regular object - boolean only
      posts: {
        __typename__: "Post",
        // Relation - partial selection of fields
        id: true,
        title: true,
        // content not selected
      },
      // followers not selected
      settings: {
        __typename__: "Settings",
        theme: true,
        // notifications and privacy not selected
      },
    };

    expect(partialSelection.email).toBeUndefined();
    expect(partialSelection.followers).toBeUndefined();
    expect(partialSelection.posts?.content).toBeUndefined();
  });

  it("should handle nested array relations", () => {
    type Comment = {
      __typename: "Comment";
      id: string;
      text: string;
      __relation__: {
        replies: Comment[]; // Recursive array relation
      };
    };

    type Post = {
      __typename: "Post";
      id: string;
      title: string;
      __relation__: {
        comments: Comment[];
      };
    };

    const selection: FieldSelection<Post> = {
      __typename__: "Post",
      id: true,
      title: true,
      comments: {
        __typename__: "Comment",
        // Selection for Comment array elements
        id: true,
        text: true,
        replies: {
          __typename__: "Comment",
          // Nested array relation - still selects element fields
          id: true,
          text: true,
          replies: {
            __typename__: "Comment",
            // Can continue recursively
            id: true,
            text: false,
          },
        },
      },
    };

    expect(selection.comments).toBeDefined();
    expect(selection.comments?.replies).toBeDefined();
  });

  it("should handle recursive types with __relation__", () => {
    type TreeNode = {
      __typename: "TreeNode";
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
      __typename__: "TreeNode",
      id: true,
      value: true,
      metadata: true, // Regular object - boolean only
      parent: {
        __typename__: "TreeNode",
        // Relation - nested selection
        id: true,
        value: true,
        metadata: true,
      },
      children: {
        __typename__: "TreeNode",
        id: true,
        value: true,
        children: {
          __typename__: "TreeNode",
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
