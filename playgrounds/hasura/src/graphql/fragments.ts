import { fragment } from '@soda-gql/core';

/**
 * Example fragments for testing type-check performance.
 */

export const ProductBasic = fragment('Products', {
  id: true,
  name: true,
  slug: true,
  basePrice: true,
  isPublished: true,
  createdAt: true,
});

export const ProductWithBrand = fragment('Products', {
  ...ProductBasic.selection,
  brand: {
    id: true,
    name: true,
    slug: true,
  },
});

export const ProductWithVariants = fragment('Products', {
  ...ProductWithBrand.selection,
  productVariants: {
    id: true,
    sku: true,
    price: true,
    stockQuantity: true,
    color: {
      id: true,
      name: true,
      hexCode: true,
    },
    size: {
      id: true,
      name: true,
      code: true,
    },
  },
});

export const UserBasic = fragment('Users', {
  id: true,
  username: true,
  email: true,
  displayName: true,
  isVerified: true,
});

export const UserWithProfile = fragment('Users', {
  ...UserBasic.selection,
  userProfile: {
    website: true,
    location: true,
    birthday: true,
    isPrivate: true,
  },
});

export const PostWithAuthor = fragment('Posts', {
  id: true,
  content: true,
  isPublished: true,
  publishedAt: true,
  viewCount: true,
  author: UserBasic.selection,
});

export const ArticleWithCategories = fragment('Articles', {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  isFeatured: true,
  isPublished: true,
  publishedAt: true,
  viewCount: true,
  author: {
    id: true,
    name: true,
    email: true,
  },
  articleCategoryAssignments: {
    category: {
      id: true,
      name: true,
      slug: true,
      parent: {
        id: true,
        name: true,
      },
    },
  },
});

// Deep nesting example (5+ levels)
export const DeepNestedLocation = fragment('Streets', {
  id: true,
  name: true,
  postalCode: true,
  neighborhood: {
    id: true,
    name: true,
    population: true,
    city: {
      id: true,
      name: true,
      postalCodePrefix: true,
      district: {
        id: true,
        name: true,
        code: true,
        region: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  },
});

// Order with multiple relations
export const OrderComplete = fragment('Orders', {
  id: true,
  orderNumber: true,
  totalAmount: true,
  notes: true,
  createdAt: true,
  customer: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
  },
  status: {
    id: true,
    name: true,
    code: true,
    isFinal: true,
  },
  shippingAddress: {
    id: true,
    label: true,
    street: true,
    city: true,
    postalCode: true,
    country: {
      id: true,
      name: true,
      code: true,
    },
  },
  orderItems: {
    id: true,
    quantity: true,
    unitPrice: true,
    totalPrice: true,
    variant: {
      id: true,
      sku: true,
      price: true,
      product: {
        id: true,
        name: true,
        slug: true,
      },
    },
  },
  payments: {
    id: true,
    amount: true,
    transactionId: true,
    paidAt: true,
    method: {
      id: true,
      name: true,
      code: true,
    },
    status: {
      id: true,
      name: true,
      code: true,
    },
  },
});
