import { query, mutation } from '@soda-gql/core';
import {
  ProductWithVariants,
  UserWithProfile,
  PostWithAuthor,
  ArticleWithCategories,
  DeepNestedLocation,
  OrderComplete,
} from './fragments';

/**
 * Example operations for testing type-check performance.
 */

// Product queries
export const getProducts = query('getProducts', {
  products: {
    args: { limit: 10 },
    ...ProductWithVariants.selection,
  },
});

export const getProductByPk = query('getProductByPk', {
  productsByPk: {
    args: { id: '' },
    ...ProductWithVariants.selection,
  },
});

// User queries
export const getUsers = query('getUsers', {
  users: {
    args: { limit: 10 },
    ...UserWithProfile.selection,
  },
});

export const getUserByPk = query('getUserByPk', {
  usersByPk: {
    args: { id: '' },
    ...UserWithProfile.selection,
    posts: {
      args: { limit: 5 },
      ...PostWithAuthor.selection,
    },
    followers: {
      followerId: true,
    },
    following: {
      followingId: true,
    },
  },
});

// Article queries
export const getArticles = query('getArticles', {
  articles: {
    args: { limit: 10, where: { isPublished: { _eq: true } } },
    ...ArticleWithCategories.selection,
  },
});

// Deep nesting query
export const getStreets = query('getStreets', {
  streets: {
    args: { limit: 10 },
    ...DeepNestedLocation.selection,
  },
});

// Order queries
export const getOrders = query('getOrders', {
  orders: {
    args: { limit: 10 },
    ...OrderComplete.selection,
  },
});

export const getOrderByPk = query('getOrderByPk', {
  ordersByPk: {
    args: { id: '' },
    ...OrderComplete.selection,
    shipments: {
      id: true,
      trackingNumber: true,
      shippedAt: true,
      deliveredAt: true,
      carrier: {
        id: true,
        name: true,
        code: true,
        trackingUrlTemplate: true,
      },
      status: {
        id: true,
        name: true,
        code: true,
      },
    },
  },
});

// Aggregation query
export const getProductsAggregate = query('getProductsAggregate', {
  productsAggregate: {
    aggregate: {
      count: true,
      avg: {
        basePrice: true,
      },
      max: {
        basePrice: true,
      },
      min: {
        basePrice: true,
      },
    },
  },
});

// Mutation examples
export const createProduct = mutation('createProduct', {
  insertProductsOne: {
    args: {
      object: {
        name: '',
        slug: '',
        basePrice: 0,
        storeId: '',
        brandId: '',
      },
    },
    id: true,
    name: true,
    slug: true,
    basePrice: true,
    createdAt: true,
  },
});

export const updateProduct = mutation('updateProduct', {
  updateProductsByPk: {
    args: {
      pkColumns: { id: '' },
      _set: { name: '', isPublished: true },
    },
    id: true,
    name: true,
    isPublished: true,
    updatedAt: true,
  },
});
