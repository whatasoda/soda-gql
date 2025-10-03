import { gql } from "@/graphql-system";

type BrandModel = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly logo: string | null;
};

export const brandModel = gql.default(({ model }) =>
  model(
    {
      typename: "Brand",
    },
    ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.slug(),
      ...f.description(),
      ...f.logo(),
    }),
    (selection): BrandModel => ({
      id: selection.id,
      name: selection.name,
      slug: selection.slug,
      description: selection.description,
      logo: selection.logo,
    }),
  ),
);

export const brandSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: {
        ...$("limit").scalar("Int:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.brands({ limit: $.limit }, () => ({
        ...brandModel.fragment(),
      })),
    }),
    ({ select }) => select(["$.brands"], (result) => result.map((data) => data.map((brand) => brandModel.normalize(brand)))),
  ),
);
