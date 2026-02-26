import { gql } from "@/graphql-system";

/**
 * Example fragments for testing type-check performance.
 * Note: This schema uses flat table structure without explicit Hasura relationships.
 */

// Product fragment
export const ProductFragment = gql.default(({ fragment }) =>
  fragment(
    "ProductFragment",
    "products",
  )`{ id name slug description base_price is_published brand_id store_id created_at updated_at }`(),
);

// Product variant fragment
export const ProductVariantFragment = gql.default(({ fragment }) =>
  fragment(
    "ProductVariantFragment",
    "product_variants",
  )`{ id sku price stock_quantity product_id color_id size_id created_at }`(),
);

// User fragment
export const UserFragment = gql.default(({ fragment }) =>
  fragment("UserFragment", "users")`{ id username email display_name is_verified bio avatar_url created_at }`(),
);

// User profile fragment
export const UserProfileFragment = gql.default(({ fragment }) =>
  fragment(
    "UserProfileFragment",
    "user_profiles",
  )`($condition: user_profiles_bool_exp!) { id user_id website location birthday is_private created_at }`(),
);

// Post fragment
export const PostFragment = gql.default(({ fragment }) =>
  fragment("PostFragment", "posts")`{ id author_id content is_published published_at view_count created_at }`(),
);

// Article fragment
export const ArticleFragment = gql.default(({ fragment }) =>
  fragment("ArticleFragment", "articles")`{
    id title slug excerpt content is_featured is_published published_at view_count author_id site_id created_at
  }`(),
);

// Order fragment
export const OrderFragment = gql.default(({ fragment }) =>
  fragment(
    "OrderFragment",
    "orders",
  )`{ id order_number total_amount notes customer_id status_id shipping_address_id created_at }`(),
);

// Order item fragment
export const OrderItemFragment = gql.default(({ fragment }) =>
  fragment("OrderItemFragment", "order_items")`{ id order_id variant_id quantity unit_price total_price created_at }`(),
);

// Brand fragment
export const BrandFragment = gql.default(({ fragment }) =>
  fragment("BrandFragment", "brands")`{ id name slug logo_url created_at }`(),
);

// Color fragment
export const ColorFragment = gql.default(({ fragment }) =>
  fragment("ColorFragment", "colors")`{ id name hex_code sort_order }`(),
);

// Size fragment
export const SizeFragment = gql.default(({ fragment }) => fragment("SizeFragment", "sizes")`{ id name code sort_order }`());

// Street fragment (for deep nesting chain)
export const StreetFragment = gql.default(({ fragment }) =>
  fragment("StreetFragment", "streets")`{ id name postal_code neighborhood_id created_at }`(),
);

// Neighborhood fragment
export const NeighborhoodFragment = gql.default(({ fragment }) =>
  fragment("NeighborhoodFragment", "neighborhoods")`{ id name population city_id }`(),
);

// City fragment
export const CityFragment = gql.default(({ fragment }) =>
  fragment("CityFragment", "cities")`{ id name postal_code_prefix district_id }`(),
);

// District fragment
export const DistrictFragment = gql.default(({ fragment }) =>
  fragment("DistrictFragment", "districts")`{ id name code region_id }`(),
);

// Region fragment
export const RegionFragment = gql.default(({ fragment }) => fragment("RegionFragment", "regions")`{ id name code created_at }`());
