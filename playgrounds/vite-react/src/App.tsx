import { ProjectPage, projectPageQuery } from "./pages/ProjectPage";
import { SearchPage } from "./pages/SearchPage";

function App() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>soda-gql Vite + React Example</h1>
      <p>This example demonstrates soda-gql features with the Organization domain schema.</p>

      <hr style={{ margin: "2rem 0", border: "none", borderTop: "1px solid #ddd" }} />

      <ProjectPage />

      <hr style={{ margin: "2rem 0", border: "none", borderTop: "1px solid #ddd" }} />

      <SearchPage />

      <hr style={{ margin: "2rem 0", border: "none", borderTop: "1px solid #ddd" }} />

      <h2>Generated Query (Project Page)</h2>
      <pre
        style={{
          background: "#f5f5f5",
          padding: "1rem",
          borderRadius: "4px",
          overflow: "auto",
        }}
      >
        {JSON.stringify(projectPageQuery, null, 2)}
      </pre>
    </div>
  );
}

export default App;
