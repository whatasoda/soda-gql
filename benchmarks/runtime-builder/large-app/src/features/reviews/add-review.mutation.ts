import { gql } from "@/graphql-system";
import { reviewModel } from "../../entities/review";

export const addReviewMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      variables: {
        ...$("productId").scalar("ID:!"),
        ...$("userId").scalar("ID:!"),
        ...$("rating").scalar("Int:!"),
        ...$("title").scalar("String:?"),
        ...$("comment").scalar("String:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.addReview({ input: { productId: $.productId, userId: $.userId, rating: $.rating, title: $.title, comment: $.comment } }, () => ({
        ...reviewModel.fragment(),
      })),
    }),
  ),
);
