import { gql } from "@/graphql-system";
import { addReviewSlice } from "../../entities/review";

export const addReviewMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "AddReview",
      variables: {
        ...$("productId").scalar("ID:!"),
        ...$("userId").scalar("ID:!"),
        ...$("rating").scalar("Int:!"),
        ...$("title").scalar("String:?"),
        ...$("comment").scalar("String:?"),
      },
    },
    ({ $ }) => ({
      review: addReviewSlice.build({ productId: $.productId, userId: $.userId, rating: $.rating, title: $.title, comment: $.comment }),
    }),
  ),
);
