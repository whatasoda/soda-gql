import { gql } from "@/graphql-system";
import { productModel } from "../entities/product";

export const productDetailQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      variables: {
        ...$("id").scalar("ID:!"),
      },
    },
    ({ f, $ }) => ({
      ...f.product({ id: $.id }, () => ({
        ...productModel.fragment(),
        ...f.relatedProducts({ limit: 5 }, () => ({
          ...f.id(),
          ...f.name(),
          ...f.price(),
        })),
      })),
    }),
  ),
);
