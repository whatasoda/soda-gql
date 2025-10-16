import { Injectable } from "@nestjs/common";
import { getUserQuery, getUsersQuery } from "../graphql/operations";

/**
 * User service demonstrating soda-gql integration with NestJS.
 *
 * In a real application, you would use a GraphQL client to execute
 * the operations against your GraphQL server.
 */
@Injectable()
export class UserService {
  /**
   * Get a single user by ID.
   *
   * The getUserQuery operation is transformed to zero-runtime code,
   * so it contains only the GraphQL document string and metadata.
   */
  async getUser(userId: string) {
    // In a real app, execute with your GraphQL client:
    // return await graphqlClient.query(getUserQuery, { userId });

    console.log("Query operation:", getUserQuery);
    console.log("Variables:", { userId });

    // Mock response for demonstration
    return {
      user: {
        id: userId,
        name: "John Doe",
        email: "john@example.com",
      },
    };
  }

  /**
   * Get all users.
   */
  async getUsers() {
    // In a real app, execute with your GraphQL client:
    // return await graphqlClient.query(getUsersQuery);

    console.log("Query operation:", getUsersQuery);

    // Mock response for demonstration
    return {
      users: [
        { id: "1", name: "John Doe", email: "john@example.com" },
        { id: "2", name: "Jane Smith", email: "jane@example.com" },
      ],
    };
  }
}
