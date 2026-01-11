import { gql } from "../../../graphql-system";

const fragment1 = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));
const fragment2 = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));

function factory() {
  const fragment1 = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));
  const fragment2 = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));
}
