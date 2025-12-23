import { getUserQuery, listUsersQuery, updateUserMutation } from "./graphql/operations";

/**
 * Webpack + SWC Transformer Example
 *
 * This example demonstrates using soda-gql with webpack and the SWC transformer
 * for faster build performance.
 */

console.log("=== soda-gql Webpack + SWC Transformer Example ===\n");

// Log registered operations with metadata
console.log("Registered operations:");
console.log("- GetUser:", getUserQuery);
console.log("  metadata:", getUserQuery.metadata);
console.log("- ListUsers:", listUsersQuery);
console.log("  metadata:", listUsersQuery.metadata);
console.log("- UpdateUser:", updateUserMutation);
console.log("  metadata:", updateUserMutation.metadata);

// Display on page
document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `
      <h1>soda-gql Webpack + SWC Example</h1>
      <p>Check the console for registered operations and metadata.</p>
      <h2>Registered Operations:</h2>
      <ul>
        <li>GetUser - metadata: <code>${JSON.stringify(getUserQuery.metadata)}</code></li>
        <li>ListUsers - metadata: <code>${JSON.stringify(listUsersQuery.metadata)}</code></li>
        <li>UpdateUser - metadata: <code>${JSON.stringify(updateUserMutation.metadata)}</code></li>
      </ul>
    `;
  }
});
