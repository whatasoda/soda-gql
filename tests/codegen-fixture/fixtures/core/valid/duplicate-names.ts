import { gql } from "../../graphql-system";

const fragment1 = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));
const fragment2 = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));

function factory() {
  const fragment1 = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));
  const fragment2 = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));
}
