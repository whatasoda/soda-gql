import { gql } from "@/graphql-system";

type ProductImageModel = {
  readonly id: string;
  readonly url: string;
  readonly alt: string | null;
  readonly isPrimary: boolean;
  readonly order: number;
};

type ProductAttributeModel = {
  readonly id: string;
  readonly name: string;
  readonly value: string;
};

type CategoryModel = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
};

type BrandModel = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
};

type ProductModel = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly price: number;
  readonly discountedPrice: number | null;
  readonly sku: string;
  readonly stockQuantity: number;
  readonly category: CategoryModel;
  readonly brand: BrandModel;
  readonly images: readonly ProductImageModel[];
  readonly attributes: readonly ProductAttributeModel[];
  readonly averageRating: number | null;
  readonly reviewCount: number;
};

export const productModel = gql.default(({ model }) =>
  model.Product(
    {},
    ({ f }) => [
      f.id(),
      f.name(),
      f.description(),
      f.price(),
      f.discountedPrice(),
      f.sku(),
      f.stockQuantity(),
      f.category()(({ f }) => [
        f.id(),
        f.name(),
        f.slug(),
      ]),
      f.brand()(({ f }) => [
        f.id(),
        f.name(),
        f.slug(),
      ]),
      f.images()(({ f }) => [
        f.id(),
        f.url(),
        f.alt(),
        f.isPrimary(),
        f.order(),
      ]),
      f.attributes()(({ f }) => [
        f.id(),
        f.name(),
        f.value(),
      ]),
      f.averageRating(),
      f.reviewCount(),
    ],
    (selection): ProductModel => ({
      id: selection.id,
      name: selection.name,
      description: selection.description,
      price: selection.price,
      discountedPrice: selection.discountedPrice,
      sku: selection.sku,
      stockQuantity: selection.stockQuantity,
      category: {
        id: selection.category.id,
        name: selection.category.name,
        slug: selection.category.slug,
      },
      brand: {
        id: selection.brand.id,
        name: selection.brand.name,
        slug: selection.brand.slug,
      },
      images: selection.images.map((img) => ({
        id: img.id,
        url: img.url,
        alt: img.alt,
        isPrimary: img.isPrimary,
        order: img.order,
      })),
      attributes: selection.attributes.map((attr) => ({
        id: attr.id,
        name: attr.name,
        value: attr.value,
      })),
      averageRating: selection.averageRating,
      reviewCount: selection.reviewCount,
    }),
  ),
);

export const productListSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [
        $("categoryId").scalar("ID:?"),
        $("brandId").scalar("ID:?"),
        $("limit").scalar("Int:?"),
        $("offset").scalar("Int:?"),
      ],
    },
    ({ f, $ }) => [
      f.products({ categoryId: $.categoryId, brandId: $.brandId, priceRange: null, limit: $.limit, offset: $.offset })(({ f }) => [
        f.edges()(({ f }) => [
          f.node()(() => [
            productModel.fragment(),
          ]),
          f.cursor(),
        ]),
        f.pageInfo()(({ f }) => [
          f.hasNextPage(),
          f.hasPreviousPage(),
          f.startCursor(),
          f.endCursor(),
        ]),
        f.totalCount(),
      ]),
    ],
    ({ select }) => select(["$.products"], (result) => result.map((data) => ({
      products: data.edges.map((edge) => productModel.normalize(edge.node)),
      pageInfo: data.pageInfo,
      totalCount: data.totalCount,
    }))),
  ),
);

export const productDetailSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [$("id").scalar("ID:!")],
    },
    ({ f, $ }) => [
      f.product({ id: $.id })(() => [
        productModel.fragment(),
      ]),
    ],
    ({ select }) => select(["$.product"], (result) => result.map((data) => (data ? productModel.normalize(data) : null))),
  ),
);

export const productSearchSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [
        $("query").scalar("String:!"),
        $("limit").scalar("Int:?"),
        $("offset").scalar("Int:?"),
      ],
    },
    ({ f, $ }) => [
      f.searchProducts({ query: $.query, limit: $.limit, offset: $.offset })(() => [
        productModel.fragment(),
      ]),
    ],
    ({ select }) => select(["$.searchProducts"], (result) => result.map((data) => data.map((product) => productModel.normalize(product)))),
  ),
);

export const createProductSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: [
        $("name").scalar("String:!"),
        $("description").scalar("String:?"),
        $("price").scalar("Float:!"),
        $("sku").scalar("String:!"),
        $("stockQuantity").scalar("Int:!"),
        $("categoryId").scalar("ID:!"),
        $("brandId").scalar("ID:!"),
      ],
    },
    ({ f, $ }) => [
      f.createProduct({
        input: {
          name: $.name,
          description: $.description,
          price: $.price,
          sku: $.sku,
          stockQuantity: $.stockQuantity,
          categoryId: $.categoryId,
          brandId: $.brandId,
        },
      })(() => [
        productModel.fragment(),
      ]),
    ],
    ({ select }) => select(["$.createProduct"], (result) => result.map((data) => productModel.normalize(data))),
  ),
);
