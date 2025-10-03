import { gql } from "@/graphql-system";

type ReviewModel = {
  readonly id: string;
  readonly productId: string;
  readonly userId: string;
  readonly rating: number;
  readonly title: string | null;
  readonly comment: string | null;
  readonly helpful: number;
  readonly verified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
};

export const reviewModel = gql.default(({ model }) =>
  model(
    {
      typename: "Review",
    },
    ({ f }) => ({
      ...f.id(),
      ...f.product(({ f }) => ({
        ...f.id(),
      })),
      ...f.user(({ f }) => ({
        ...f.id(),
      })),
      ...f.rating(),
      ...f.title(),
      ...f.comment(),
      ...f.helpful(),
      ...f.verified(),
      ...f.createdAt(),
      ...f.updatedAt(),
    }),
    (selection): ReviewModel => ({
      id: selection.id,
      productId: selection.product.id,
      userId: selection.user.id,
      rating: selection.rating,
      title: selection.title,
      comment: selection.comment,
      helpful: selection.helpful,
      verified: selection.verified,
      createdAt: selection.createdAt,
      updatedAt: selection.updatedAt,
    }),
  ),
);

export const reviewSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: {
        ...$("productId").scalar("ID:?"),
        ...$("userId").scalar("ID:?"),
        ...$("minRating").scalar("Int:?"),
        ...$("limit").scalar("Int:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.reviews({ productId: $.productId, userId: $.userId, minRating: $.minRating, limit: $.limit }, () => ({
        ...reviewModel.fragment(),
      })),
    }),
    ({ select }) => select(["$.reviews"], (result) => result.map((data) => data.map((review) => reviewModel.normalize(review)))),
  ),
);
