import { gql } from "../graphql-system";

// $uuid maps to the branded custom scalar UUID (`string & { __brand: "UUID" }`), so its metadata
// selector proxy must be a terminal leaf — see prebuilt-metadata-typing.test.ts.
export const getByUuid = gql.default(({ query }) => query("GetByUuid")`($uuid: UUID!) { userByUuid(uuid: $uuid) { id } }`());
