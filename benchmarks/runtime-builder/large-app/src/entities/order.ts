import { gql } from "@/graphql-system";

type AddressModel = {
  readonly id: string;
  readonly type: string;
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly country: string;
  readonly postalCode: string;
  readonly isDefault: boolean;
};

type OrderItemModel = {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly priceAtPurchase: number;
  readonly discountAtPurchase: number | null;
  readonly totalPrice: number;
};

type OrderModel = {
  readonly id: string;
  readonly userId: string;
  readonly items: readonly OrderItemModel[];
  readonly status: string;
  readonly paymentStatus: string;
  readonly shippingAddress: AddressModel;
  readonly billingAddress: AddressModel;
  readonly subtotal: number;
  readonly tax: number;
  readonly shippingCost: number;
  readonly discount: number;
  readonly totalAmount: number;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export const orderModel = gql.default(({ model }) =>
  model(
    {
      typename: "Order",
    },
    ({ f }) => ({
      ...f.id(),
      ...f.userId(),
      ...f.items(({ f }) => ({
        ...f.id(),
        ...f.product(({ f }) => ({
          ...f.id(),
          ...f.name(),
        })),
        ...f.quantity(),
        ...f.priceAtPurchase(),
        ...f.discountAtPurchase(),
        ...f.totalPrice(),
      })),
      ...f.status(),
      ...f.paymentStatus(),
      ...f.shippingAddress(({ f }) => ({
        ...f.id(),
        ...f.type(),
        ...f.street(),
        ...f.city(),
        ...f.state(),
        ...f.country(),
        ...f.postalCode(),
        ...f.isDefault(),
      })),
      ...f.billingAddress(({ f }) => ({
        ...f.id(),
        ...f.type(),
        ...f.street(),
        ...f.city(),
        ...f.state(),
        ...f.country(),
        ...f.postalCode(),
        ...f.isDefault(),
      })),
      ...f.subtotal(),
      ...f.tax(),
      ...f.shippingCost(),
      ...f.discount(),
      ...f.totalAmount(),
      ...f.notes(),
      ...f.createdAt(),
      ...f.updatedAt(),
    }),
    (selection): OrderModel => ({
      id: selection.id,
      userId: selection.userId,
      items: selection.items.map((item) => ({
        id: item.id,
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase,
        discountAtPurchase: item.discountAtPurchase,
        totalPrice: item.totalPrice,
      })),
      status: selection.status,
      paymentStatus: selection.paymentStatus,
      shippingAddress: {
        id: selection.shippingAddress.id,
        type: selection.shippingAddress.type,
        street: selection.shippingAddress.street,
        city: selection.shippingAddress.city,
        state: selection.shippingAddress.state,
        country: selection.shippingAddress.country,
        postalCode: selection.shippingAddress.postalCode,
        isDefault: selection.shippingAddress.isDefault,
      },
      billingAddress: {
        id: selection.billingAddress.id,
        type: selection.billingAddress.type,
        street: selection.billingAddress.street,
        city: selection.billingAddress.city,
        state: selection.billingAddress.state,
        country: selection.billingAddress.country,
        postalCode: selection.billingAddress.postalCode,
        isDefault: selection.billingAddress.isDefault,
      },
      subtotal: selection.subtotal,
      tax: selection.tax,
      shippingCost: selection.shippingCost,
      discount: selection.discount,
      totalAmount: selection.totalAmount,
      notes: selection.notes,
      createdAt: selection.createdAt,
      updatedAt: selection.updatedAt,
    }),
  ),
);

export const orderSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: {
        ...$("userId").scalar("ID:!"),
        ...$("status").scalar("OrderStatus:?"),
        ...$("limit").scalar("Int:?"),
        ...$("offset").scalar("Int:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.orders({ userId: $.userId, status: $.status, dateRange: null, limit: $.limit, offset: $.offset }, ({ f }) => ({
        ...f.edges(({ f }) => ({
          ...f.node(() => ({
            ...orderModel.fragment(),
          })),
          ...f.cursor(),
        })),
        ...f.pageInfo(({ f }) => ({
          ...f.hasNextPage(),
          ...f.hasPreviousPage(),
          ...f.startCursor(),
          ...f.endCursor(),
        })),
        ...f.totalCount(),
      })),
    }),
    ({ select }) => select(["$.orders"], (result) => result.map((data) => ({
      orders: data.edges.map((edge) => orderModel.normalize(edge.node)),
      pageInfo: data.pageInfo,
      totalCount: data.totalCount,
    }))),
  ),
);

export const createOrderSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: {
        ...$("userId").scalar("ID:!"),
        ...$("items").scalar("[OrderItemInput!]:!"),
        ...$("shippingAddressId").scalar("ID:!"),
        ...$("billingAddressId").scalar("ID:!"),
        ...$("notes").scalar("String:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.createOrder({
        input: {
          userId: $.userId,
          items: $.items,
          shippingAddressId: $.shippingAddressId,
          billingAddressId: $.billingAddressId,
          notes: $.notes,
        },
      }, () => ({
        ...orderModel.fragment(),
      })),
    }),
    ({ select }) => select(["$.createOrder"], (result) => result.map((data) => orderModel.normalize(data))),
  ),
);

export const orderStatusSlice = gql.default(({ slice }, { $ }) =>
  slice.subscription(
    {
      variables: {
        ...$("userId").scalar("ID:!"),
      },
    },
    ({ f, $ }) => ({
      ...f.orderStatusChanged({ userId: $.userId }, () => ({
        ...orderModel.fragment(),
      })),
    }),
    ({ select }) => select(["$.orderStatusChanged"], (result) => result.map((data) => orderModel.normalize(data))),
  ),
);
