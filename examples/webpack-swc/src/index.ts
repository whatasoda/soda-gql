import { getUserQuery, listUsersQuery, updateUserMutation } from "./graphql/operations";

/**
 * Webpack + SWC Transformer Example
 *
 * This example demonstrates using soda-gql with webpack and the SWC transformer
 * for faster build performance.
 */

console.log("=== soda-gql Webpack + SWC Transformer Example ===\n");

// Log registered operations
console.log("Registered operations:");
console.log("- GetUser:", getUserQuery);
console.log("- ListUsers:", listUsersQuery);
console.log("- UpdateUser:", updateUserMutation);

// Display on page
document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `
      <h1>soda-gql Webpack + SWC Example</h1>
      <p>Check the console for registered operations.</p>
      <h2>Registered Operations:</h2>
      <ul>
        <li>GetUser</li>
        <li>ListUsers</li>
        <li>UpdateUser</li>
      </ul>
    `;
  }
});
