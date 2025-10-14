import { getUserQuery, listUsersQuery, updateUserMutation } from './operations';

/**
 * Example usage of soda-gql with Babel plugin
 *
 * This demonstrates:
 * - Model definitions with transforms
 * - Operation slices for queries/mutations/subscriptions
 * - Composed operations from multiple slices
 * - Runtime execution (mocked for demonstration)
 */

console.log('=== Babel App Example ===\n');

// Type information is preserved
console.log('Available operations:');
console.log('- getUserQuery:', typeof getUserQuery);
console.log('- listUsersQuery:', typeof listUsersQuery);
console.log('- updateUserMutation:', typeof updateUserMutation);

// In a real application, you would execute these operations with a GraphQL client
// Example:
// const result = await client.query(getUserQuery, { userId: '1', categoryId: '10' });
console.log('\n✅ Operations are registered and ready to use');
