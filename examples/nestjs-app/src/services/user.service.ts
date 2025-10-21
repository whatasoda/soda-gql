import { Injectable } from "@nestjs/common";
import { createUserMutation, getUserQuery, listUsersQuery, updateUserMutation } from "../graphql/operations";

/**
 * User service demonstrating soda-gql usage in NestJS
 */
@Injectable()
export class UserService {
  /**
   * Get a single user by ID
   */
  async getUser(userId: string) {
    // In a real application, execute the query with a GraphQL client
    console.log("Executing getUserQuery with userId:", userId);
    console.log("Query type:", typeof getUserQuery);

    // Mock response
    return {
      id: userId,
      name: "John Doe",
      email: "john@example.com",
      posts: [],
    };
  }

  /**
   * List all users
   */
  async listUsers() {
    console.log("Executing listUsersQuery");
    console.log("Query type:", typeof listUsersQuery);

    // Mock response
    return [
      { id: "1", name: "John Doe", email: "john@example.com" },
      { id: "2", name: "Jane Smith", email: "jane@example.com" },
    ];
  }

  /**
   * Create a new user
   */
  async createUser(name: string, email: string) {
    console.log("Executing createUserMutation with:", { name, email });
    console.log("Mutation type:", typeof createUserMutation);

    // Mock response
    return {
      id: Math.random().toString(36).substring(7),
      name,
      email,
    };
  }

  /**
   * Update an existing user
   */
  async updateUser(userId: string, name: string) {
    console.log("Executing updateUserMutation with:", { userId, name });
    console.log("Mutation type:", typeof updateUserMutation);

    // Mock response
    return {
      id: userId,
      name,
      email: "updated@example.com",
    };
  }
}
