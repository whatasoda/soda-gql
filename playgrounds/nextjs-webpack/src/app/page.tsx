import { getUserQuery, listUsersQuery } from "@/graphql/operations";

export default function Home() {
  // Display operation metadata to verify webpack plugin is working
  const getUserMeta = getUserQuery.metadata;
  const listUsersMeta = listUsersQuery.metadata;

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>soda-gql Next.js Example</h1>
      <p>This example demonstrates the webpack plugin integration with Next.js.</p>

      <h2>Registered Operations</h2>

      <section style={{ marginTop: "1rem" }}>
        <h3>GetUser Query</h3>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            overflow: "auto",
          }}
        >
          {JSON.stringify(getUserMeta, null, 2)}
        </pre>
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h3>ListUsers Query</h3>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            overflow: "auto",
          }}
        >
          {JSON.stringify(listUsersMeta, null, 2)}
        </pre>
      </section>

      <h2 style={{ marginTop: "2rem" }}>API Routes</h2>
      <ul>
        <li>
          <a href="/api/user?id=1&categoryId=cat1">GET /api/user?id=1&categoryId=cat1</a>
        </li>
      </ul>
    </main>
  );
}
