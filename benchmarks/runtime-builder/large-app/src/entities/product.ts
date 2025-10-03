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
  model(
    {
      typename: "Product",
    },
    ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.description(),
      ...f.price(),
      ...f.discountedPrice(),
      ...f.sku(),
      ...f.stockQuantity(),
      ...f.category(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.slug(),
      })),
      ...f.brand(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.slug(),
      })),
      ...f.images(({ f }) => ({
        ...f.id(),
        ...f.url(),
        ...f.alt(),
        ...f.isPrimary(),
        ...f.order(),
      })),
      ...f.attributes(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.value(),
      })),
      ...f.averageRating(),
      ...f.reviewCount(),
    }),
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
