import { gql } from "@/graphql-system";

/**
 * Example fragments for testing type-check performance.
 * Note: This schema uses flat table structure without explicit Hasura relationships.
 */

// Product fragment
export const ProductFragment = gql.default(({ fragment }) =>
  fragment.products({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.slug(),
      ...f.description(),
      ...f.base_price(),
      ...f.is_published(),
      ...f.brand_id(),
      ...f.store_id(),
      ...f.created_at(),
      ...f.updated_at(),
    }),
  }),
);

// Product variant fragment
export const ProductVariantFragment = gql.default(({ fragment }) =>
  fragment.product_variants({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.sku(),
      ...f.price(),
      ...f.stock_quantity(),
      ...f.product_id(),
      ...f.color_id(),
      ...f.size_id(),
      ...f.created_at(),
    }),
  }),
);

// User fragment
export const UserFragment = gql.default(({ fragment }) =>
  fragment.users({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.username(),
      ...f.email(),
      ...f.display_name(),
      ...f.is_verified(),
      ...f.bio(),
      ...f.avatar_url(),
      ...f.created_at(),
    }),
  }),
);

// User profile fragment
export const UserProfileFragment = gql.default(({ fragment, $var }) =>
  fragment.user_profiles({
    variables: { ...$var("condition").user_profiles_bool_exp("!") },
    fields: ({ f }) => ({
      ...f.id(),
      ...f.user_id(),
      ...f.website(),
      ...f.location(),
      ...f.birthday(),
      ...f.is_private(),
      ...f.created_at(),
    }),
  }),
);

gql.default(({ fragment, $var }) =>
  fragment.user_profiles({
    variables: { ...$var("condition").user_profiles_bool_exp("!") },
    fields: ({ f, $ }) => ({
      ...UserProfileFragment.spread({ condition: { _or: [$.condition] } }),
      ...f.id(),
    }),
  }),
);

// Post fragment
export const PostFragment = gql.default(({ fragment }) =>
  fragment.posts({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.author_id(),
      ...f.content(),
      ...f.is_published(),
      ...f.published_at(),
      ...f.view_count(),
      ...f.created_at(),
    }),
  }),
);

// Article fragment
export const ArticleFragment = gql.default(({ fragment }) =>
  fragment.articles({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.title(),
      ...f.slug(),
      ...f.excerpt(),
      ...f.content(),
      ...f.is_featured(),
      ...f.is_published(),
      ...f.published_at(),
      ...f.view_count(),
      ...f.author_id(),
      ...f.site_id(),
      ...f.created_at(),
    }),
  }),
);

// Order fragment
export const OrderFragment = gql.default(({ fragment }) =>
  fragment.orders({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.order_number(),
      ...f.total_amount(),
      ...f.notes(),
      ...f.customer_id(),
      ...f.status_id(),
      ...f.shipping_address_id(),
      ...f.created_at(),
    }),
  }),
);

// Order item fragment
export const OrderItemFragment = gql.default(({ fragment }) =>
  fragment.order_items({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.order_id(),
      ...f.variant_id(),
      ...f.quantity(),
      ...f.unit_price(),
      ...f.total_price(),
      ...f.created_at(),
    }),
  }),
);

// Brand fragment
export const BrandFragment = gql.default(({ fragment }) =>
  fragment.brands({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.slug(),
      ...f.logo_url(),
      ...f.created_at(),
    }),
  }),
);

// Color fragment
export const ColorFragment = gql.default(({ fragment }) =>
  fragment.colors({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.hex_code(),
      ...f.sort_order(),
    }),
  }),
);

// Size fragment
export const SizeFragment = gql.default(({ fragment }) =>
  fragment.sizes({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.code(),
      ...f.sort_order(),
    }),
  }),
);

// Street fragment (for deep nesting chain)
export const StreetFragment = gql.default(({ fragment }) =>
  fragment.streets({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.postal_code(),
      ...f.neighborhood_id(),
      ...f.created_at(),
    }),
  }),
);

// Neighborhood fragment
export const NeighborhoodFragment = gql.default(({ fragment }) =>
  fragment.neighborhoods({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.population(),
      ...f.city_id(),
    }),
  }),
);

// City fragment
export const CityFragment = gql.default(({ fragment }) =>
  fragment.cities({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.postal_code_prefix(),
      ...f.district_id(),
    }),
  }),
);

// District fragment
export const DistrictFragment = gql.default(({ fragment }) =>
  fragment.districts({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.code(),
      ...f.region_id(),
    }),
  }),
);

// Region fragment
export const RegionFragment = gql.default(({ fragment }) =>
  fragment.regions({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.code(),
      ...f.created_at(),
    }),
  }),
);
