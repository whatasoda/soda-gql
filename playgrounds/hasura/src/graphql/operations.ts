import { gql } from "@/graphql-system";
import {
  ArticleFragment,
  OrderFragment,
  OrderItemFragment,
  ProductFragment,
  ProductVariantFragment,
  StreetFragment,
  UserFragment,
} from "./fragments";

/**
 * Example operations for testing type-check performance.
 */

// Product queries
export const getProducts = gql.default(({ query }) =>
  query("GetProducts")`{
    products(limit: 10) {
      ...${ProductFragment}
    }
  }`(),
);

export const getProductByPk = gql.default(({ query }) =>
  query("GetProductByPk")`($id: uuid!) {
    products_by_pk(id: $id) {
      ...${ProductFragment}
    }
  }`(),
);

export const getProductVariants = gql.default(({ query }) =>
  query("GetProductVariants")`($productId: uuid!) {
    product_variants(where: { product_id: { _eq: $productId } }) {
      ...${ProductVariantFragment}
    }
  }`(),
);

// User queries
export const getUsers = gql.default(({ query }) =>
  query("GetUsers")`{
    users(limit: 10) {
      ...${UserFragment}
    }
  }`(),
);

export const getUserByPk = gql.default(({ query }) =>
  query("GetUserByPk")`($id: uuid!) {
    users_by_pk(id: $id) {
      ...${UserFragment}
    }
  }`(),
);

// Article queries
export const getArticles = gql.default(({ query }) =>
  query("GetArticles")`{
    articles(limit: 10, where: { is_published: { _eq: true } }) {
      ...${ArticleFragment}
    }
  }`(),
);

// Street queries (deep nesting chain)
export const getStreets = gql.default(({ query }) =>
  query("GetStreets")`{
    streets(limit: 10) {
      ...${StreetFragment}
    }
  }`(),
);

// Order queries
export const getOrders = gql.default(({ query }) =>
  query("GetOrders")`{
    orders(limit: 10) {
      ...${OrderFragment}
    }
  }`(),
);

export const getOrderByPk = gql.default(({ query }) =>
  query("GetOrderByPk")`($id: uuid!) {
    orders_by_pk(id: $id) {
      ...${OrderFragment}
    }
  }`(),
);

export const getOrderItems = gql.default(({ query }) =>
  query("GetOrderItems")`($orderId: uuid!) {
    order_items(where: { order_id: { _eq: $orderId } }) {
      ...${OrderItemFragment}
    }
  }`(),
);

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

// Mutation examples
export const createProduct = gql.default(({ mutation }) =>
  mutation("CreateProduct")`($name: String!, $slug: String!, $basePrice: numeric!, $storeId: uuid, $brandId: uuid) {
    insert_products_one(object: { name: $name, slug: $slug, base_price: $basePrice, store_id: $storeId, brand_id: $brandId }) {
      ...${ProductFragment}
    }
  }`(),
);

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
