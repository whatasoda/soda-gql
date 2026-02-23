import { gql } from "../../../graphql-system";

const { attach } = gql.default(({ fragment }) => fragment("EmployeeFragment", "Employee")`{ id }`());
