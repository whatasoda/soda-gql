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
  query.operation({
    name: "GetProducts",
    fields: ({ f }) => ({
      ...f.products({ limit: 10 })(() => ({
        ...ProductFragment.spread(),
      })),
    }),
  }),
);

export const getProductByPk = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetProductByPk",
    variables: { ...$var("id").uuid("!") },
    fields: ({ f, $ }) => ({
      ...f.products_by_pk({ id: $.id })(() => ({
        ...ProductFragment.spread(),
      })),
    }),
  }),
);

export const getProductVariants = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetProductVariants",
    variables: { ...$var("productId").uuid("!") },
    fields: ({ f, $ }) => ({
      ...f.product_variants({ where: { product_id: { _eq: $.productId } } })(() => ({
        ...ProductVariantFragment.spread(),
      })),
    }),
  }),
);

// User queries
export const getUsers = gql.default(({ query }) =>
  query.operation({
    name: "GetUsers",
    fields: ({ f }) => ({
      ...f.users({ limit: 10 })(() => ({
        ...UserFragment.spread(),
      })),
    }),
  }),
);

export const getUserByPk = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUserByPk",
    variables: { ...$var("id").uuid("!") },
    fields: ({ f, $ }) => ({
      ...f.users_by_pk({ id: $.id })(() => ({
        ...UserFragment.spread(),
      })),
    }),
  }),
);

// Article queries
export const getArticles = gql.default(({ query }) =>
  query.operation({
    name: "GetArticles",
    fields: ({ f }) => ({
      ...f.articles({ limit: 10, where: { is_published: { _eq: true } } })(() => ({
        ...ArticleFragment.spread(),
      })),
    }),
  }),
);

// Street queries (deep nesting chain)
export const getStreets = gql.default(({ query }) =>
  query.operation({
    name: "GetStreets",
    fields: ({ f }) => ({
      ...f.streets({ limit: 10 })(() => ({
        ...StreetFragment.spread(),
      })),
    }),
  }),
);

// Order queries
export const getOrders = gql.default(({ query }) =>
  query.operation({
    name: "GetOrders",
    fields: ({ f }) => ({
      ...f.orders({ limit: 10 })(() => ({
        ...OrderFragment.spread(),
      })),
    }),
  }),
);

export const getOrderByPk = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetOrderByPk",
    variables: { ...$var("id").uuid("!") },
    fields: ({ f, $ }) => ({
      ...f.orders_by_pk({ id: $.id })(() => ({
        ...OrderFragment.spread(),
      })),
    }),
  }),
);

export const getOrderItems = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetOrderItems",
    variables: { ...$var("orderId").uuid("!") },
    fields: ({ f, $ }) => ({
      ...f.order_items({ where: { order_id: { _eq: $.orderId } } })(() => ({
        ...OrderItemFragment.spread(),
      })),
    }),
  }),
);

// Aggregation query
export const getProductsAggregate = gql.default(({ query }) =>
  query`query GetProductsAggregate {
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
export const createProduct = gql.default(({ mutation, $var }) =>
  mutation.operation({
    name: "CreateProduct",
    variables: {
      ...$var("name").String("!"),
      ...$var("slug").String("!"),
      ...$var("basePrice").numeric("!"),
      ...$var("storeId").uuid("?"),
      ...$var("brandId").uuid("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.insert_products_one({
        object: {
          name: $.name,
          slug: $.slug,
          base_price: $.basePrice,
          store_id: $.storeId,
          brand_id: $.brandId,
        },
      })(() => ({
        ...ProductFragment.spread(),
      })),
    }),
  }),
);

export const updateProduct = gql.default(({ mutation }) =>
  mutation`mutation UpdateProduct($id: uuid!, $name: String, $isPublished: Boolean) {
    update_products_by_pk(pk_columns: { id: $id }, _set: { name: $name, is_published: $isPublished }) {
      id
      name
      is_published
      updated_at
    }
  }`(),
);

export const deleteProduct = gql.default(({ mutation }) =>
  mutation`mutation DeleteProduct($id: uuid!) {
    delete_products_by_pk(id: $id) {
      id
      name
    }
  }`(),
);
