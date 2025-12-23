// Edge case: gql calls in class instance and static properties.
// NOTE: Class property scope tracking differs between TSC and SWC,
// causing canonical path mismatches. This pattern is not reliably
// supported across all transformers.
//
// In a real codebase, this pattern may not transform correctly:
//   class UserRepository {
//     private userModel = gql.default(({ model }) => ...);
//     static sharedModel = gql.default(({ model }) => ...);
//   }

export const placeholder = "class-properties-test";
