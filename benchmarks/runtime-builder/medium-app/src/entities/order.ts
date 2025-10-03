import { gql } from "@/graphql-system";
import { productModel } from "./product";

type OrderItemModel = {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly price: number;
};

type OrderModel = {
  readonly id: string;
  readonly userId: string;
  readonly items: readonly OrderItemModel[];
  readonly status: string;
  readonly totalAmount: number;
  readonly createdAt: string;
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
        ...f.product(() => ({
          ...f.id(),
          ...f.name(),
        })),
        ...f.quantity(),
        ...f.price(),
      })),
      ...f.status(),
      ...f.totalAmount(),
      ...f.createdAt(),
    }),
    (selection): OrderModel => ({
      id: selection.id,
      userId: selection.userId,
      items: selection.items.map((item) => ({
        id: item.id,
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        price: item.price,
      })),
      status: selection.status,
      totalAmount: selection.totalAmount,
      createdAt: selection.createdAt,
    }),
  ),
);

export const orderSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: {
        ...$("userId").scalar("ID:!"),
        ...$("status").scalar("OrderStatus:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.orders({ userId: $.userId, status: $.status }, () => ({
        ...orderModel.fragment(),
      })),
    }),
    ({ select }) => select(["$.orders"], (result) => result.map((data) => data.map((order) => orderModel.normalize(order)))),
  ),
);

export const createOrderSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: {
        ...$("userId").scalar("ID:!"),
        ...$("items").scalar("[OrderItemInput!]:!"),
      },
    },
    ({ f, $ }) => ({
      ...f.createOrder({ userId: $.userId, items: $.items }, () => ({
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
