// Comprehensive client code with 50 diverse fragment and operation definitions
// This exercises the type system with realistic usage patterns
import { gql } from "./generated";

// ============================================================
// FRAGMENTS (20 definitions)
// ============================================================

// 1. Product fragment
export const ProductFragment = gql.hasura(({ fragment }) =>
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

// 2. Product variant fragment
export const ProductVariantFragment = gql.hasura(({ fragment }) =>
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

// 3. User fragment
export const UserFragment = gql.hasura(({ fragment }) =>
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

// 4. User profile fragment
export const UserProfileFragment = gql.hasura(({ fragment }) =>
  fragment.user_profiles({
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

// 5. Post fragment
export const PostFragment = gql.hasura(({ fragment }) =>
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

// 6. Article fragment
export const ArticleFragment = gql.hasura(({ fragment }) =>
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

// 7. Order fragment
export const OrderFragment = gql.hasura(({ fragment }) =>
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

// 8. Order item fragment
export const OrderItemFragment = gql.hasura(({ fragment }) =>
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

// 9. Brand fragment
export const BrandFragment = gql.hasura(({ fragment }) =>
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

// 10. Color fragment
export const ColorFragment = gql.hasura(({ fragment }) =>
  fragment.colors({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.hex_code(),
      ...f.sort_order(),
    }),
  }),
);

// 11. Size fragment
export const SizeFragment = gql.hasura(({ fragment }) =>
  fragment.sizes({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.code(),
      ...f.sort_order(),
    }),
  }),
);

// 12. Store fragment
export const StoreFragment = gql.hasura(({ fragment }) =>
  fragment.stores({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.slug(),
      ...f.description(),
      ...f.owner_id(),
      ...f.created_at(),
    }),
  }),
);

// 13. Street fragment (for deep nesting chain)
export const StreetFragment = gql.hasura(({ fragment }) =>
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

// 14. Neighborhood fragment
export const NeighborhoodFragment = gql.hasura(({ fragment }) =>
  fragment.neighborhoods({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.population(),
      ...f.city_id(),
    }),
  }),
);

// 15. City fragment
export const CityFragment = gql.hasura(({ fragment }) =>
  fragment.cities({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.postal_code_prefix(),
      ...f.district_id(),
    }),
  }),
);

// 16. District fragment
export const DistrictFragment = gql.hasura(({ fragment }) =>
  fragment.districts({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.code(),
      ...f.region_id(),
    }),
  }),
);

// 17. Region fragment
export const RegionFragment = gql.hasura(({ fragment }) =>
  fragment.regions({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.code(),
      ...f.created_at(),
    }),
  }),
);

// 18. Category fragment
export const CategoryFragment = gql.hasura(({ fragment }) =>
  fragment.categories({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.slug(),
      ...f.parent_id(),
      ...f.sort_order(),
      ...f.created_at(),
    }),
  }),
);

// 19. Site fragment
export const SiteFragment = gql.hasura(({ fragment }) =>
  fragment.sites({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.domain(),
      ...f.owner_id(),
      ...f.created_at(),
    }),
  }),
);

// 20. Address fragment
export const AddressFragment = gql.hasura(({ fragment }) =>
  fragment.addresses({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.street_address(),
      ...f.city(),
      ...f.postal_code(),
      ...f.user_id(),
      ...f.is_default(),
      ...f.created_at(),
    }),
  }),
);

// ============================================================
// QUERIES (18 definitions)
// ============================================================

// 21. Get products list
export const getProducts = gql.hasura(({ query }) =>
  query.operation({
    name: "GetProducts",
    fields: ({ f }) => ({
      ...f.products({ limit: 10 })(() => ({
        ...ProductFragment.spread(),
      })),
    }),
  }),
);

// 22. Get product by PK
export const getProductByPk = gql.hasura(({ query, $var }) =>
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

// 23. Get product variants
export const getProductVariants = gql.hasura(({ query, $var }) =>
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

// 24. Get users list
export const getUsers = gql.hasura(({ query }) =>
  query.operation({
    name: "GetUsers",
    fields: ({ f }) => ({
      ...f.users({ limit: 10 })(() => ({
        ...UserFragment.spread(),
      })),
    }),
  }),
);

// 25. Get user by PK
export const getUserByPk = gql.hasura(({ query, $var }) =>
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

// 26. Get articles list
export const getArticles = gql.hasura(({ query }) =>
  query.operation({
    name: "GetArticles",
    fields: ({ f }) => ({
      ...f.articles({ limit: 10, where: { is_published: { _eq: true } } })(() => ({
        ...ArticleFragment.spread(),
      })),
    }),
  }),
);

// 27. Get streets list (deep nesting chain)
export const getStreets = gql.hasura(({ query }) =>
  query.operation({
    name: "GetStreets",
    fields: ({ f }) => ({
      ...f.streets({ limit: 10 })(() => ({
        ...StreetFragment.spread(),
      })),
    }),
  }),
);

// 28. Get orders list
export const getOrders = gql.hasura(({ query }) =>
  query.operation({
    name: "GetOrders",
    fields: ({ f }) => ({
      ...f.orders({ limit: 10 })(() => ({
        ...OrderFragment.spread(),
      })),
    }),
  }),
);

// 29. Get order by PK
export const getOrderByPk = gql.hasura(({ query, $var }) =>
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

// 30. Get order items
export const getOrderItems = gql.hasura(({ query, $var }) =>
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

// 31. Get products aggregate
export const getProductsAggregate = gql.hasura(({ query }) =>
  query.operation({
    name: "GetProductsAggregate",
    fields: ({ f }) => ({
      ...f.products_aggregate()(({ f }) => ({
        ...f.aggregate()(({ f }) => ({
          ...f.count(),
          ...f.avg()(({ f }) => ({
            ...f.base_price(),
          })),
          ...f.max()(({ f }) => ({
            ...f.base_price(),
          })),
          ...f.min()(({ f }) => ({
            ...f.base_price(),
          })),
        })),
      })),
    }),
  }),
);

// 32. Get brands list
export const getBrands = gql.hasura(({ query }) =>
  query.operation({
    name: "GetBrands",
    fields: ({ f }) => ({
      ...f.brands({ order_by: [{ name: "asc" }] })(() => ({
        ...BrandFragment.spread(),
      })),
    }),
  }),
);

// 33. Get categories list
export const getCategories = gql.hasura(({ query }) =>
  query.operation({
    name: "GetCategories",
    fields: ({ f }) => ({
      ...f.categories({ order_by: [{ sort_order: "asc" }] })(() => ({
        ...CategoryFragment.spread(),
      })),
    }),
  }),
);

// 34. Get stores list
export const getStores = gql.hasura(({ query }) =>
  query.operation({
    name: "GetStores",
    fields: ({ f }) => ({
      ...f.stores({ limit: 10 })(() => ({
        ...StoreFragment.spread(),
      })),
    }),
  }),
);

// 35. Get sites list
export const getSites = gql.hasura(({ query }) =>
  query.operation({
    name: "GetSites",
    fields: ({ f }) => ({
      ...f.sites({ limit: 10 })(() => ({
        ...SiteFragment.spread(),
      })),
    }),
  }),
);

// 36. Get posts list
export const getPosts = gql.hasura(({ query }) =>
  query.operation({
    name: "GetPosts",
    fields: ({ f }) => ({
      ...f.posts({ limit: 10, where: { is_published: { _eq: true } } })(() => ({
        ...PostFragment.spread(),
      })),
    }),
  }),
);

// 37. Search products
export const searchProducts = gql.hasura(({ query, $var }) =>
  query.operation({
    name: "SearchProducts",
    variables: {
      ...$var("searchTerm").String("?"),
      ...$var("brandId").uuid("?"),
      ...$var("limit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.products({
        where: {
          _and: [{ name: { _ilike: $.searchTerm } }, { brand_id: { _eq: $.brandId } }],
        },
        limit: $.limit,
      })(() => ({
        ...ProductFragment.spread(),
      })),
    }),
  }),
);

// 38. Get user addresses
export const getUserAddresses = gql.hasura(({ query, $var }) =>
  query.operation({
    name: "GetUserAddresses",
    variables: { ...$var("userId").uuid("!") },
    fields: ({ f, $ }) => ({
      ...f.addresses({ where: { user_id: { _eq: $.userId } } })(() => ({
        ...AddressFragment.spread(),
      })),
    }),
  }),
);

// ============================================================
// MUTATIONS (12 definitions)
// ============================================================

// 39. Create product
export const createProduct = gql.hasura(({ mutation, $var }) =>
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

// 40. Update product
export const updateProduct = gql.hasura(({ mutation, $var }) =>
  mutation.operation({
    name: "UpdateProduct",
    variables: {
      ...$var("id").uuid("!"),
      ...$var("name").String("?"),
      ...$var("isPublished").Boolean("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.update_products_by_pk({
        pk_columns: { id: $.id },
        _set: { name: $.name, is_published: $.isPublished },
      })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.is_published(),
        ...f.updated_at(),
      })),
    }),
  }),
);

// 41. Delete product
export const deleteProduct = gql.hasura(({ mutation, $var }) =>
  mutation.operation({
    name: "DeleteProduct",
    variables: { ...$var("id").uuid("!") },
    fields: ({ f, $ }) => ({
      ...f.delete_products_by_pk({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);

// 42. Create user
export const createUser = gql.hasura(({ mutation, $var }) =>
  mutation.operation({
    name: "CreateUser",
    variables: {
      ...$var("username").String("!"),
      ...$var("email").String("!"),
      ...$var("displayName").String("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.insert_users_one({
        object: {
          username: $.username,
          email: $.email,
          display_name: $.displayName,
        },
      })(() => ({
        ...UserFragment.spread(),
      })),
    }),
  }),
);

// 43. Update user
export const updateUser = gql.hasura(({ mutation, $var }) =>
  mutation.operation({
    name: "UpdateUser",
    variables: {
      ...$var("id").uuid("!"),
      ...$var("displayName").String("?"),
      ...$var("bio").String("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.update_users_by_pk({
        pk_columns: { id: $.id },
        _set: { display_name: $.displayName, bio: $.bio },
      })(({ f }) => ({
        ...f.id(),
        ...f.username(),
        ...f.display_name(),
        ...f.bio(),
      })),
    }),
  }),
);

// 44. Create order
export const createOrder = gql.hasura(({ mutation, $var }) =>
  mutation.operation({
    name: "CreateOrder",
    variables: {
      ...$var("customerId").uuid("!"),
      ...$var("totalAmount").numeric("!"),
      ...$var("shippingAddressId").uuid("?"),
      ...$var("notes").String("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.insert_orders_one({
        object: {
          customer_id: $.customerId,
          total_amount: $.totalAmount,
          shipping_address_id: $.shippingAddressId,
          notes: $.notes,
        },
      })(() => ({
        ...OrderFragment.spread(),
      })),
    }),
  }),
);

// 45. Update order
export const updateOrder = gql.hasura(({ mutation, $var }) =>
  mutation.operation({
    name: "UpdateOrder",
    variables: {
      ...$var("id").uuid("!"),
      ...$var("statusId").uuid("?"),
      ...$var("notes").String("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.update_orders_by_pk({
        pk_columns: { id: $.id },
        _set: { status_id: $.statusId, notes: $.notes },
      })(({ f }) => ({
        ...f.id(),
        ...f.order_number(),
        ...f.status_id(),
        ...f.notes(),
      })),
    }),
  }),
);

// 46. Create article
export const createArticle = gql.hasura(({ mutation, $var }) =>
  mutation.operation({
    name: "CreateArticle",
    variables: {
      ...$var("title").String("!"),
      ...$var("slug").String("!"),
      ...$var("content").String("!"),
      ...$var("authorId").uuid("!"),
      ...$var("siteId").uuid("!"),
    },
    fields: ({ f, $ }) => ({
      ...f.insert_articles_one({
        object: {
          title: $.title,
          slug: $.slug,
          content: $.content,
          author_id: $.authorId,
          site_id: $.siteId,
        },
      })(() => ({
        ...ArticleFragment.spread(),
      })),
    }),
  }),
);

// 47. Update article
export const updateArticle = gql.hasura(({ mutation, $var }) =>
  mutation.operation({
    name: "UpdateArticle",
    variables: {
      ...$var("id").uuid("!"),
      ...$var("title").String("?"),
      ...$var("content").String("?"),
      ...$var("isPublished").Boolean("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.update_articles_by_pk({
        pk_columns: { id: $.id },
        _set: { title: $.title, content: $.content, is_published: $.isPublished },
      })(({ f }) => ({
        ...f.id(),
        ...f.title(),
        ...f.is_published(),
        ...f.updated_at(),
      })),
    }),
  }),
);

// 48. Create brand
export const createBrand = gql.hasura(({ mutation, $var }) =>
  mutation.operation({
    name: "CreateBrand",
    variables: {
      ...$var("name").String("!"),
      ...$var("slug").String("!"),
      ...$var("logoUrl").String("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.insert_brands_one({
        object: {
          name: $.name,
          slug: $.slug,
          logo_url: $.logoUrl,
        },
      })(() => ({
        ...BrandFragment.spread(),
      })),
    }),
  }),
);

// 49. Create address
export const createAddress = gql.hasura(({ mutation, $var }) =>
  mutation.operation({
    name: "CreateAddress",
    variables: {
      ...$var("userId").uuid("!"),
      ...$var("streetAddress").String("!"),
      ...$var("city").String("!"),
      ...$var("postalCode").String("!"),
      ...$var("isDefault").Boolean("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.insert_addresses_one({
        object: {
          user_id: $.userId,
          street_address: $.streetAddress,
          city: $.city,
          postal_code: $.postalCode,
          is_default: $.isDefault,
        },
      })(() => ({
        ...AddressFragment.spread(),
      })),
    }),
  }),
);

// 50. Delete order
export const deleteOrder = gql.hasura(({ mutation, $var }) =>
  mutation.operation({
    name: "DeleteOrder",
    variables: { ...$var("id").uuid("!") },
    fields: ({ f, $ }) => ({
      ...f.delete_orders_by_pk({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.order_number(),
      })),
    }),
  }),
);

// Export all definitions to ensure they are type-checked
export const fragments = {
  ProductFragment,
  ProductVariantFragment,
  UserFragment,
  UserProfileFragment,
  PostFragment,
  ArticleFragment,
  OrderFragment,
  OrderItemFragment,
  BrandFragment,
  ColorFragment,
  SizeFragment,
  StoreFragment,
  StreetFragment,
  NeighborhoodFragment,
  CityFragment,
  DistrictFragment,
  RegionFragment,
  CategoryFragment,
  SiteFragment,
  AddressFragment,
};

export const queries = {
  getProducts,
  getProductByPk,
  getProductVariants,
  getUsers,
  getUserByPk,
  getArticles,
  getStreets,
  getOrders,
  getOrderByPk,
  getOrderItems,
  getProductsAggregate,
  getBrands,
  getCategories,
  getStores,
  getSites,
  getPosts,
  searchProducts,
  getUserAddresses,
};

export const mutations = {
  createProduct,
  updateProduct,
  deleteProduct,
  createUser,
  updateUser,
  createOrder,
  updateOrder,
  createArticle,
  updateArticle,
  createBrand,
  createAddress,
  deleteOrder,
};
