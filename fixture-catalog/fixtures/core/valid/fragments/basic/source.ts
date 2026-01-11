import { gql } from "../../../../../graphql-system";

export const userFragment = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) }));

export const productFragment = gql.default(({ fragment }) => {
  return fragment.Project({ fields: ({ f }) => ({ ...f.id(), ...f.title() }) });
});

export const fragments = {
  user: gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) })),
};
