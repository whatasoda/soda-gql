import { UserPage, userPageQuery } from "./pages/UserPage";

function App() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>soda-gql Vite + React Example</h1>
      <p>This example demonstrates fragment colocation with @soda-gql/colocation-tools.</p>

      <UserPage />

      <h2 style={{ marginTop: "2rem" }}>Generated Query</h2>
      <pre
        style={{
          background: "#f5f5f5",
          padding: "1rem",
          borderRadius: "4px",
          overflow: "auto",
        }}
      >
        {JSON.stringify(userPageQuery, null, 2)}
      </pre>
    </div>
  );
}

export default App;
