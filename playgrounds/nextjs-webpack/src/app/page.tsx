import { getEmployeeQuery, listEmployeesQuery } from "@/graphql/operations";

export default function Home() {
  // Display operation metadata to verify webpack plugin is working
  const getEmployeeMeta = getEmployeeQuery.metadata;
  const listEmployeesMeta = listEmployeesQuery.metadata;

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>soda-gql Next.js Example</h1>
      <p>This example demonstrates the webpack plugin integration with Next.js using the Organization domain schema.</p>

      <h2>Registered Operations</h2>

      <section style={{ marginTop: "1rem" }}>
        <h3>GetEmployee Query</h3>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            overflow: "auto",
          }}
        >
          {JSON.stringify(getEmployeeMeta, null, 2)}
        </pre>
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h3>ListEmployees Query</h3>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            overflow: "auto",
          }}
        >
          {JSON.stringify(listEmployeesMeta, null, 2)}
        </pre>
      </section>

      <h2 style={{ marginTop: "2rem" }}>API Routes</h2>
      <ul>
        <li>
          <a href="/api/employee?employeeId=1">GET /api/employee?employeeId=1</a>
        </li>
        <li>
          <a href="/api/employee?employeeId=1&taskLimit=5">GET /api/employee?employeeId=1&taskLimit=5</a>
        </li>
      </ul>
    </main>
  );
}
