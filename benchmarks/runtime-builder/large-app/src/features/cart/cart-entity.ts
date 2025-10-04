import { gql } from "@/graphql-system";

type CartItemModel = {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly productPrice: number;
  readonly quantity: number;
  readonly addedAt: string;
};

type CartModel = {
  readonly id: string;
  readonly userId: string;
  readonly items: readonly CartItemModel[];
  readonly subtotal: number;
  readonly itemCount: number;
  readonly updatedAt: string;
};

export const cartModel = gql.default(({ model }) =>
  model.Cart(
    {},
    ({ f }) => [
      f.id(),
      f.userId(),
      f.items()(({ f }) => [
        f.id(),
        f.product()(({ f}) => [
          f.id(),
          f.name(),
          f.price(),
        ]),
        f.quantity(),
        f.addedAt(),
      ]),
      f.subtotal(),
      f.itemCount(),
      f.updatedAt(),
    ],
    (selection): CartModel => ({
      id: selection.id,
      userId: selection.userId,
      items: selection.items.map((item) => ({
        id: item.id,
        productId: item.product.id,
        productName: item.product.name,
        productPrice: item.product.price,
        quantity: item.quantity,
        addedAt: item.addedAt,
      })),
      subtotal: selection.subtotal,
      itemCount: selection.itemCount,
      updatedAt: selection.updatedAt,
    }),
  ),
);

export const cartSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [$("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [
      f.cart({ userId: $.userId })(() => [
        cartModel.fragment(),
      ]),
    ],
    ({ select }) => select(["$.cart"], (result) => result.map((data) => (data ? cartModel.normalize(data) : null))),
  ),
);

export const addToCartSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: [
        $("userId").scalar("ID:!"),
        $("productId").scalar("ID:!"),
        $("quantity").scalar("Int:!"),
      ],
    },
    ({ f, $ }) => [
      f.addToCart({ input: { userId: $.userId, productId: $.productId, quantity: $.quantity } })(() => [
        cartModel.fragment(),
      ]),
    ],
    ({ select }) => select(["$.addToCart"], (result) => result.map((data) => cartModel.normalize(data))),
  ),
);

export const cartUpdatedSlice = gql.default(({ slice }, { $ }) =>
  slice.subscription(
    {
      variables: [$("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [
      f.cartUpdated({ userId: $.userId })(() => [
        cartModel.fragment(),
      ]),
    ],
    ({ select }) => select(["$.cartUpdated"], (result) => result.map((data) => cartModel.normalize(data))),
  ),
);
