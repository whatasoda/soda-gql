import { gql } from "@/graphql-system";

/**
 * Operations without fragment spreads — use tagged template syntax.
 * Separated from operations.ts so the typegen merge logic correctly uses
 * builder results for callback builder operations and template scanner
 * results for tagged template operations.
 */

// Aggregation query
export const getProductsAggregate = gql.default(({ query }) =>
  query("GetProductsAggregate")`{
    products_aggregate {
      aggregate {
        count
        avg { base_price }
        max { base_price }
        min { base_price }
      }
    }
  }`(),
);

// Simple mutations without fragment spreads
export const updateProduct = gql.default(({ mutation }) =>
  mutation("UpdateProduct")`($id: uuid!, $name: String, $isPublished: Boolean) {
    update_products_by_pk(pk_columns: { id: $id }, _set: { name: $name, is_published: $isPublished }) {
      id
      name
      is_published
      updated_at
    }
  }`(),
);

export const deleteProduct = gql.default(({ mutation }) =>
  mutation("DeleteProduct")`($id: uuid!) {
    delete_products_by_pk(id: $id) {
      id
      name
    }
  }`(),
);
