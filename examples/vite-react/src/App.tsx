import { getUserQuery, listUsersQuery } from "./graphql/operations";

function App() {
  // Display query information to verify soda-gql transformation works
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>soda-gql Vite + React Example</h1>
      <p>This example demonstrates soda-gql integration with Vite.</p>

      <h2>Registered Operations</h2>
      <div style={{ marginTop: "1rem" }}>
        <h3>GetUser Query</h3>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            overflow: "auto",
          }}
        >
          {JSON.stringify(getUserQuery, null, 2)}
        </pre>

        <h3>ListUsers Query</h3>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            overflow: "auto",
          }}
        >
          {JSON.stringify(listUsersQuery, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default App;
