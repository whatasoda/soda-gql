import { gql } from "../../../graphql-system";

const { attach } = gql.default(({ fragment }) => fragment`fragment EmployeeFragment on Employee { id }`());
