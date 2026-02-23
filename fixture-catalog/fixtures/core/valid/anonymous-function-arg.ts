import { gql } from "../../../graphql-system";

declare function someFunction(fragment: unknown): void;

someFunction(gql.default(({ fragment }) => fragment("EmployeeFragment", "Employee")`{ id }`()));
