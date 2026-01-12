import { Injectable } from "@nestjs/common";
import { getEmployeeQuery, getEmployeesQuery } from "../graphql/operations";

/**
 * Employee service demonstrating soda-gql integration with NestJS.
 *
 * In a real application, you would use a GraphQL client to execute
 * the operations against your GraphQL server.
 */
@Injectable()
export class EmployeeService {
  /**
   * Get a single employee by ID.
   *
   * The getEmployeeQuery operation is transformed to zero-runtime code,
   * so it contains only the GraphQL document string and metadata.
   */
  async getEmployee(employeeId: string) {
    // In a real app, execute with your GraphQL client:
    // return await graphqlClient.query(getEmployeeQuery, { employeeId });

    console.log("Query operation:", getEmployeeQuery);
    console.log("Variables:", { employeeId });

    // Mock response for demonstration
    return {
      employee: {
        id: employeeId,
        name: "Alice Johnson",
        email: "alice@company.com",
        role: "ENGINEER",
      },
    };
  }

  /**
   * Get all employees.
   */
  async getEmployees() {
    // In a real app, execute with your GraphQL client:
    // return await graphqlClient.query(getEmployeesQuery);

    console.log("Query operation:", getEmployeesQuery);

    // Mock response for demonstration
    return {
      employees: [
        { id: "1", name: "Alice Johnson", email: "alice@company.com", role: "ENGINEER" },
        { id: "2", name: "Bob Smith", email: "bob@company.com", role: "MANAGER" },
      ],
    };
  }
}
