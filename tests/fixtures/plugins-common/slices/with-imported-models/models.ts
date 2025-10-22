import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [f.id(), f.name(), f.email()],
    (selection) => ({ id: selection.id, name: selection.name, email: selection.email }),
  ),
);

export const postModel = gql.default(({ model }) =>
  model.Post(
    {},
    ({ f }) => [f.id(), f.title(), f.content()],
    (selection) => ({ id: selection.id, title: selection.title, content: selection.content }),
  ),
);
