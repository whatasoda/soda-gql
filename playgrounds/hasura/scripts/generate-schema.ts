#!/usr/bin/env bun
/**
 * Generates SQL migrations for ~100 tables with various relation patterns.
 * Domain: E-Commerce + SNS + CMS (avoiding project management domain)
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface Column {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
}

interface ForeignKey {
  column: string;
  references: { table: string; column: string };
}

interface TableDef {
  name: string;
  columns: Column[];
  foreignKeys?: ForeignKey[];
  selfRef?: { column: string; nullable: boolean };
}

const BASE_COLUMNS: Column[] = [
  { name: "id", type: "uuid", default: "gen_random_uuid()" },
  { name: "created_at", type: "timestamptz", default: "now()" },
  { name: "updated_at", type: "timestamptz", default: "now()" },
  { name: "deleted_at", type: "timestamptz", nullable: true },
];

// EC Domain - Core (20 tables)
const EC_CORE_TABLES: TableDef[] = [
  {
    name: "stores",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "slug", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "is_active", type: "boolean", default: "true" },
    ],
  },
  {
    name: "customers",
    columns: [
      ...BASE_COLUMNS,
      { name: "email", type: "text" },
      { name: "first_name", type: "text" },
      { name: "last_name", type: "text" },
      { name: "phone", type: "text", nullable: true },
    ],
    foreignKeys: [{ column: "store_id", references: { table: "stores", column: "id" } }],
  },
  {
    name: "customer_addresses",
    columns: [
      ...BASE_COLUMNS,
      { name: "label", type: "text" },
      { name: "street", type: "text" },
      { name: "city", type: "text" },
      { name: "state", type: "text", nullable: true },
      { name: "postal_code", type: "text" },
      { name: "is_default", type: "boolean", default: "false" },
    ],
    foreignKeys: [
      {
        column: "customer_id",
        references: { table: "customers", column: "id" },
      },
      {
        column: "country_id",
        references: { table: "countries", column: "id" },
      },
    ],
  },
  {
    name: "products",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "slug", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "base_price", type: "numeric(12,2)" },
      { name: "is_published", type: "boolean", default: "false" },
    ],
    foreignKeys: [
      { column: "store_id", references: { table: "stores", column: "id" } },
      { column: "brand_id", references: { table: "brands", column: "id" } },
    ],
  },
  {
    name: "product_variants",
    columns: [
      ...BASE_COLUMNS,
      { name: "sku", type: "text" },
      { name: "price", type: "numeric(12,2)" },
      { name: "stock_quantity", type: "integer", default: "0" },
    ],
    foreignKeys: [
      { column: "product_id", references: { table: "products", column: "id" } },
      { column: "color_id", references: { table: "colors", column: "id" } },
      { column: "size_id", references: { table: "sizes", column: "id" } },
    ],
  },
  {
    name: "product_images",
    columns: [
      ...BASE_COLUMNS,
      { name: "url", type: "text" },
      { name: "alt_text", type: "text", nullable: true },
      { name: "sort_order", type: "integer", default: "0" },
      { name: "is_primary", type: "boolean", default: "false" },
    ],
    foreignKeys: [
      { column: "product_id", references: { table: "products", column: "id" } },
      {
        column: "variant_id",
        references: { table: "product_variants", column: "id" },
      },
    ],
  },
  {
    name: "carts",
    columns: [
      ...BASE_COLUMNS,
      { name: "session_id", type: "text", nullable: true },
      { name: "expires_at", type: "timestamptz", nullable: true },
    ],
    foreignKeys: [
      {
        column: "customer_id",
        references: { table: "customers", column: "id" },
      },
    ],
  },
  {
    name: "cart_items",
    columns: [
      ...BASE_COLUMNS,
      { name: "quantity", type: "integer", default: "1" },
      { name: "unit_price", type: "numeric(12,2)" },
    ],
    foreignKeys: [
      { column: "cart_id", references: { table: "carts", column: "id" } },
      {
        column: "variant_id",
        references: { table: "product_variants", column: "id" },
      },
    ],
  },
  {
    name: "orders",
    columns: [
      ...BASE_COLUMNS,
      { name: "order_number", type: "text" },
      { name: "total_amount", type: "numeric(12,2)" },
      { name: "notes", type: "text", nullable: true },
    ],
    foreignKeys: [
      {
        column: "customer_id",
        references: { table: "customers", column: "id" },
      },
      { column: "store_id", references: { table: "stores", column: "id" } },
      {
        column: "status_id",
        references: { table: "order_statuses", column: "id" },
      },
      {
        column: "shipping_address_id",
        references: { table: "customer_addresses", column: "id" },
      },
      {
        column: "billing_address_id",
        references: { table: "customer_addresses", column: "id" },
      },
    ],
  },
  {
    name: "order_items",
    columns: [
      ...BASE_COLUMNS,
      { name: "quantity", type: "integer" },
      { name: "unit_price", type: "numeric(12,2)" },
      { name: "total_price", type: "numeric(12,2)" },
    ],
    foreignKeys: [
      { column: "order_id", references: { table: "orders", column: "id" } },
      {
        column: "variant_id",
        references: { table: "product_variants", column: "id" },
      },
    ],
  },
  {
    name: "payments",
    columns: [
      ...BASE_COLUMNS,
      { name: "amount", type: "numeric(12,2)" },
      { name: "transaction_id", type: "text", nullable: true },
      { name: "paid_at", type: "timestamptz", nullable: true },
    ],
    foreignKeys: [
      { column: "order_id", references: { table: "orders", column: "id" } },
      {
        column: "method_id",
        references: { table: "payment_methods", column: "id" },
      },
      {
        column: "status_id",
        references: { table: "payment_statuses", column: "id" },
      },
    ],
  },
  {
    name: "shipments",
    columns: [
      ...BASE_COLUMNS,
      { name: "tracking_number", type: "text", nullable: true },
      { name: "shipped_at", type: "timestamptz", nullable: true },
      { name: "delivered_at", type: "timestamptz", nullable: true },
    ],
    foreignKeys: [
      { column: "order_id", references: { table: "orders", column: "id" } },
      {
        column: "carrier_id",
        references: { table: "shipping_carriers", column: "id" },
      },
      {
        column: "status_id",
        references: { table: "shipment_statuses", column: "id" },
      },
    ],
  },
  {
    name: "reviews",
    columns: [
      ...BASE_COLUMNS,
      { name: "rating", type: "integer" },
      { name: "title", type: "text", nullable: true },
      { name: "body", type: "text", nullable: true },
      { name: "is_verified", type: "boolean", default: "false" },
    ],
    foreignKeys: [
      { column: "product_id", references: { table: "products", column: "id" } },
      {
        column: "customer_id",
        references: { table: "customers", column: "id" },
      },
      {
        column: "order_item_id",
        references: { table: "order_items", column: "id" },
      },
    ],
  },
  {
    name: "wishlists",
    columns: [...BASE_COLUMNS, { name: "name", type: "text", default: "'Default'" }],
    foreignKeys: [
      {
        column: "customer_id",
        references: { table: "customers", column: "id" },
      },
    ],
  },
  {
    name: "wishlist_items",
    columns: [...BASE_COLUMNS, { name: "added_at", type: "timestamptz", default: "now()" }],
    foreignKeys: [
      {
        column: "wishlist_id",
        references: { table: "wishlists", column: "id" },
      },
      { column: "product_id", references: { table: "products", column: "id" } },
    ],
  },
  {
    name: "coupons",
    columns: [
      ...BASE_COLUMNS,
      { name: "code", type: "text" },
      { name: "discount_type", type: "text" },
      { name: "discount_value", type: "numeric(12,2)" },
      { name: "min_order_amount", type: "numeric(12,2)", nullable: true },
      { name: "max_uses", type: "integer", nullable: true },
      { name: "used_count", type: "integer", default: "0" },
      { name: "starts_at", type: "timestamptz" },
      { name: "expires_at", type: "timestamptz", nullable: true },
    ],
    foreignKeys: [{ column: "store_id", references: { table: "stores", column: "id" } }],
  },
  {
    name: "order_coupons",
    columns: [...BASE_COLUMNS, { name: "discount_amount", type: "numeric(12,2)" }],
    foreignKeys: [
      { column: "order_id", references: { table: "orders", column: "id" } },
      { column: "coupon_id", references: { table: "coupons", column: "id" } },
    ],
  },
  {
    name: "inventory_locations",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "address", type: "text", nullable: true },
      { name: "is_active", type: "boolean", default: "true" },
    ],
    foreignKeys: [{ column: "store_id", references: { table: "stores", column: "id" } }],
  },
  {
    name: "inventory_levels",
    columns: [
      ...BASE_COLUMNS,
      { name: "quantity", type: "integer", default: "0" },
      { name: "reserved", type: "integer", default: "0" },
    ],
    foreignKeys: [
      {
        column: "variant_id",
        references: { table: "product_variants", column: "id" },
      },
      {
        column: "location_id",
        references: { table: "inventory_locations", column: "id" },
      },
    ],
  },
  {
    name: "return_requests",
    columns: [...BASE_COLUMNS, { name: "reason", type: "text" }, { name: "notes", type: "text", nullable: true }],
    foreignKeys: [
      { column: "order_id", references: { table: "orders", column: "id" } },
      {
        column: "status_id",
        references: { table: "return_statuses", column: "id" },
      },
    ],
  },
];

// EC Domain - Master (10 tables)
const EC_MASTER_TABLES: TableDef[] = [
  {
    name: "brands",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "slug", type: "text" },
      { name: "logo_url", type: "text", nullable: true },
    ],
  },
  {
    name: "colors",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "hex_code", type: "text" },
      { name: "sort_order", type: "integer", default: "0" },
    ],
  },
  {
    name: "sizes",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "code", type: "text" },
      { name: "sort_order", type: "integer", default: "0" },
    ],
  },
  {
    name: "currencies",
    columns: [
      ...BASE_COLUMNS,
      { name: "code", type: "text" },
      { name: "name", type: "text" },
      { name: "symbol", type: "text" },
      { name: "decimal_places", type: "integer", default: "2" },
    ],
  },
  {
    name: "countries",
    columns: [
      ...BASE_COLUMNS,
      { name: "code", type: "text" },
      { name: "name", type: "text" },
      { name: "is_shipping_enabled", type: "boolean", default: "true" },
    ],
  },
  {
    name: "order_statuses",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "code", type: "text" },
      { name: "sort_order", type: "integer", default: "0" },
      { name: "is_final", type: "boolean", default: "false" },
    ],
  },
  {
    name: "payment_methods",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "code", type: "text" },
      { name: "is_active", type: "boolean", default: "true" },
    ],
  },
  {
    name: "payment_statuses",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "code", type: "text" },
      { name: "sort_order", type: "integer", default: "0" },
    ],
  },
  {
    name: "shipping_carriers",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "code", type: "text" },
      { name: "tracking_url_template", type: "text", nullable: true },
    ],
  },
  {
    name: "shipment_statuses",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "code", type: "text" },
      { name: "sort_order", type: "integer", default: "0" },
    ],
  },
  {
    name: "return_statuses",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "code", type: "text" },
      { name: "sort_order", type: "integer", default: "0" },
    ],
  },
];

// SNS Domain (20 tables)
const SNS_TABLES: TableDef[] = [
  {
    name: "users",
    columns: [
      ...BASE_COLUMNS,
      { name: "username", type: "text" },
      { name: "email", type: "text" },
      { name: "display_name", type: "text" },
      { name: "bio", type: "text", nullable: true },
      { name: "avatar_url", type: "text", nullable: true },
      { name: "is_verified", type: "boolean", default: "false" },
    ],
  },
  {
    name: "user_profiles",
    columns: [
      ...BASE_COLUMNS,
      { name: "website", type: "text", nullable: true },
      { name: "location", type: "text", nullable: true },
      { name: "birthday", type: "date", nullable: true },
      { name: "is_private", type: "boolean", default: "false" },
    ],
    foreignKeys: [{ column: "user_id", references: { table: "users", column: "id" } }],
  },
  {
    name: "posts",
    columns: [
      ...BASE_COLUMNS,
      { name: "content", type: "text" },
      { name: "is_published", type: "boolean", default: "true" },
      { name: "published_at", type: "timestamptz", nullable: true },
      { name: "view_count", type: "bigint", default: "0" },
    ],
    foreignKeys: [{ column: "author_id", references: { table: "users", column: "id" } }],
    selfRef: { column: "reply_to_id", nullable: true },
  },
  {
    name: "post_media",
    columns: [
      ...BASE_COLUMNS,
      { name: "media_type", type: "text" },
      { name: "url", type: "text" },
      { name: "thumbnail_url", type: "text", nullable: true },
      { name: "alt_text", type: "text", nullable: true },
      { name: "sort_order", type: "integer", default: "0" },
    ],
    foreignKeys: [{ column: "post_id", references: { table: "posts", column: "id" } }],
  },
  {
    name: "likes",
    columns: [...BASE_COLUMNS],
    foreignKeys: [
      { column: "user_id", references: { table: "users", column: "id" } },
      { column: "post_id", references: { table: "posts", column: "id" } },
    ],
  },
  {
    name: "bookmarks",
    columns: [...BASE_COLUMNS],
    foreignKeys: [
      { column: "user_id", references: { table: "users", column: "id" } },
      { column: "post_id", references: { table: "posts", column: "id" } },
    ],
  },
  {
    name: "follows",
    columns: [...BASE_COLUMNS, { name: "is_approved", type: "boolean", default: "true" }],
    foreignKeys: [
      { column: "follower_id", references: { table: "users", column: "id" } },
      { column: "following_id", references: { table: "users", column: "id" } },
    ],
  },
  {
    name: "blocks",
    columns: [...BASE_COLUMNS],
    foreignKeys: [
      { column: "blocker_id", references: { table: "users", column: "id" } },
      { column: "blocked_id", references: { table: "users", column: "id" } },
    ],
  },
  {
    name: "conversations",
    columns: [
      ...BASE_COLUMNS,
      { name: "title", type: "text", nullable: true },
      { name: "is_group", type: "boolean", default: "false" },
    ],
  },
  {
    name: "conversation_participants",
    columns: [
      ...BASE_COLUMNS,
      { name: "joined_at", type: "timestamptz", default: "now()" },
      { name: "left_at", type: "timestamptz", nullable: true },
      { name: "is_admin", type: "boolean", default: "false" },
    ],
    foreignKeys: [
      {
        column: "conversation_id",
        references: { table: "conversations", column: "id" },
      },
      { column: "user_id", references: { table: "users", column: "id" } },
    ],
  },
  {
    name: "messages",
    columns: [...BASE_COLUMNS, { name: "content", type: "text" }, { name: "read_at", type: "timestamptz", nullable: true }],
    foreignKeys: [
      {
        column: "conversation_id",
        references: { table: "conversations", column: "id" },
      },
      { column: "sender_id", references: { table: "users", column: "id" } },
    ],
    selfRef: { column: "reply_to_id", nullable: true },
  },
  {
    name: "message_reactions",
    columns: [...BASE_COLUMNS, { name: "emoji", type: "text" }],
    foreignKeys: [
      { column: "message_id", references: { table: "messages", column: "id" } },
      { column: "user_id", references: { table: "users", column: "id" } },
    ],
  },
  {
    name: "notifications",
    columns: [
      ...BASE_COLUMNS,
      { name: "type", type: "text" },
      { name: "title", type: "text" },
      { name: "body", type: "text", nullable: true },
      { name: "data", type: "jsonb", nullable: true },
      { name: "read_at", type: "timestamptz", nullable: true },
    ],
    foreignKeys: [
      { column: "user_id", references: { table: "users", column: "id" } },
      { column: "actor_id", references: { table: "users", column: "id" } },
    ],
  },
  {
    name: "hashtags",
    columns: [...BASE_COLUMNS, { name: "name", type: "text" }, { name: "post_count", type: "bigint", default: "0" }],
  },
  {
    name: "post_hashtags",
    columns: [...BASE_COLUMNS],
    foreignKeys: [
      { column: "post_id", references: { table: "posts", column: "id" } },
      { column: "hashtag_id", references: { table: "hashtags", column: "id" } },
    ],
  },
  {
    name: "mentions",
    columns: [...BASE_COLUMNS],
    foreignKeys: [
      { column: "post_id", references: { table: "posts", column: "id" } },
      { column: "user_id", references: { table: "users", column: "id" } },
    ],
  },
  {
    name: "reports",
    columns: [
      ...BASE_COLUMNS,
      { name: "reason", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "resolved_at", type: "timestamptz", nullable: true },
    ],
    foreignKeys: [
      { column: "reporter_id", references: { table: "users", column: "id" } },
      { column: "post_id", references: { table: "posts", column: "id" } },
      {
        column: "status_id",
        references: { table: "report_statuses", column: "id" },
      },
    ],
  },
  {
    name: "report_statuses",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "code", type: "text" },
      { name: "sort_order", type: "integer", default: "0" },
    ],
  },
  {
    name: "user_settings",
    columns: [
      ...BASE_COLUMNS,
      { name: "notification_email", type: "boolean", default: "true" },
      { name: "notification_push", type: "boolean", default: "true" },
      { name: "notification_sms", type: "boolean", default: "false" },
      { name: "theme", type: "text", default: "'system'" },
      { name: "language", type: "text", default: "'en'" },
    ],
    foreignKeys: [{ column: "user_id", references: { table: "users", column: "id" } }],
  },
  {
    name: "user_sessions",
    columns: [
      ...BASE_COLUMNS,
      { name: "token", type: "text" },
      { name: "device_info", type: "text", nullable: true },
      { name: "ip_address", type: "text", nullable: true },
      { name: "last_active_at", type: "timestamptz", default: "now()" },
      { name: "expires_at", type: "timestamptz" },
    ],
    foreignKeys: [{ column: "user_id", references: { table: "users", column: "id" } }],
  },
];

// CMS Domain (20 tables)
const CMS_TABLES: TableDef[] = [
  {
    name: "sites",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "domain", type: "text" },
      { name: "is_published", type: "boolean", default: "false" },
    ],
  },
  {
    name: "authors",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "email", type: "text" },
      { name: "bio", type: "text", nullable: true },
      { name: "avatar_url", type: "text", nullable: true },
    ],
    foreignKeys: [{ column: "site_id", references: { table: "sites", column: "id" } }],
  },
  {
    name: "pages",
    columns: [
      ...BASE_COLUMNS,
      { name: "title", type: "text" },
      { name: "slug", type: "text" },
      { name: "content", type: "text", nullable: true },
      { name: "meta_title", type: "text", nullable: true },
      { name: "meta_description", type: "text", nullable: true },
      { name: "is_published", type: "boolean", default: "false" },
      { name: "published_at", type: "timestamptz", nullable: true },
      { name: "sort_order", type: "integer", default: "0" },
    ],
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
      {
        column: "template_id",
        references: { table: "page_templates", column: "id" },
      },
    ],
    selfRef: { column: "parent_id", nullable: true },
  },
  {
    name: "page_templates",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "slug", type: "text" },
      { name: "schema", type: "jsonb", nullable: true },
    ],
    foreignKeys: [{ column: "site_id", references: { table: "sites", column: "id" } }],
  },
  {
    name: "page_versions",
    columns: [
      ...BASE_COLUMNS,
      { name: "version_number", type: "integer" },
      { name: "content", type: "text" },
      { name: "published_at", type: "timestamptz", nullable: true },
    ],
    foreignKeys: [
      { column: "page_id", references: { table: "pages", column: "id" } },
      { column: "author_id", references: { table: "authors", column: "id" } },
    ],
  },
  {
    name: "articles",
    columns: [
      ...BASE_COLUMNS,
      { name: "title", type: "text" },
      { name: "slug", type: "text" },
      { name: "excerpt", type: "text", nullable: true },
      { name: "content", type: "text" },
      { name: "featured_image_url", type: "text", nullable: true },
      { name: "is_featured", type: "boolean", default: "false" },
      { name: "is_published", type: "boolean", default: "false" },
      { name: "published_at", type: "timestamptz", nullable: true },
      { name: "view_count", type: "bigint", default: "0" },
    ],
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
      { column: "author_id", references: { table: "authors", column: "id" } },
    ],
  },
  {
    name: "article_categories",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "slug", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "sort_order", type: "integer", default: "0" },
    ],
    foreignKeys: [{ column: "site_id", references: { table: "sites", column: "id" } }],
    selfRef: { column: "parent_id", nullable: true },
  },
  {
    name: "article_category_assignments",
    columns: [...BASE_COLUMNS],
    foreignKeys: [
      { column: "article_id", references: { table: "articles", column: "id" } },
      {
        column: "category_id",
        references: { table: "article_categories", column: "id" },
      },
    ],
  },
  {
    name: "tags",
    columns: [...BASE_COLUMNS, { name: "name", type: "text" }, { name: "slug", type: "text" }],
    foreignKeys: [{ column: "site_id", references: { table: "sites", column: "id" } }],
  },
  {
    name: "article_tags",
    columns: [...BASE_COLUMNS],
    foreignKeys: [
      { column: "article_id", references: { table: "articles", column: "id" } },
      { column: "tag_id", references: { table: "tags", column: "id" } },
    ],
  },
  {
    name: "comments",
    columns: [
      ...BASE_COLUMNS,
      { name: "author_name", type: "text" },
      { name: "author_email", type: "text" },
      { name: "content", type: "text" },
      { name: "is_approved", type: "boolean", default: "false" },
    ],
    foreignKeys: [{ column: "article_id", references: { table: "articles", column: "id" } }],
    selfRef: { column: "parent_id", nullable: true },
  },
  {
    name: "media_files",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "file_name", type: "text" },
      { name: "mime_type", type: "text" },
      { name: "size_bytes", type: "bigint" },
      { name: "url", type: "text" },
      { name: "alt_text", type: "text", nullable: true },
    ],
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
      {
        column: "folder_id",
        references: { table: "media_folders", column: "id" },
      },
    ],
  },
  {
    name: "media_folders",
    columns: [...BASE_COLUMNS, { name: "name", type: "text" }, { name: "path", type: "text" }],
    foreignKeys: [{ column: "site_id", references: { table: "sites", column: "id" } }],
    selfRef: { column: "parent_id", nullable: true },
  },
  {
    name: "menus",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "slug", type: "text" },
      { name: "location", type: "text", nullable: true },
    ],
    foreignKeys: [{ column: "site_id", references: { table: "sites", column: "id" } }],
  },
  {
    name: "menu_items",
    columns: [
      ...BASE_COLUMNS,
      { name: "label", type: "text" },
      { name: "url", type: "text", nullable: true },
      { name: "target", type: "text", default: "'_self'" },
      { name: "sort_order", type: "integer", default: "0" },
    ],
    foreignKeys: [
      { column: "menu_id", references: { table: "menus", column: "id" } },
      { column: "page_id", references: { table: "pages", column: "id" } },
    ],
    selfRef: { column: "parent_id", nullable: true },
  },
  {
    name: "forms",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "slug", type: "text" },
      { name: "schema", type: "jsonb" },
      { name: "success_message", type: "text", nullable: true },
    ],
    foreignKeys: [{ column: "site_id", references: { table: "sites", column: "id" } }],
  },
  {
    name: "form_submissions",
    columns: [
      ...BASE_COLUMNS,
      { name: "data", type: "jsonb" },
      { name: "ip_address", type: "text", nullable: true },
      { name: "user_agent", type: "text", nullable: true },
    ],
    foreignKeys: [{ column: "form_id", references: { table: "forms", column: "id" } }],
  },
  {
    name: "redirects",
    columns: [
      ...BASE_COLUMNS,
      { name: "from_path", type: "text" },
      { name: "to_path", type: "text" },
      { name: "status_code", type: "integer", default: "301" },
      { name: "is_active", type: "boolean", default: "true" },
    ],
    foreignKeys: [{ column: "site_id", references: { table: "sites", column: "id" } }],
  },
  {
    name: "seo_settings",
    columns: [
      ...BASE_COLUMNS,
      { name: "default_title", type: "text", nullable: true },
      { name: "title_template", type: "text", nullable: true },
      { name: "default_description", type: "text", nullable: true },
      { name: "og_image_url", type: "text", nullable: true },
      { name: "robots_txt", type: "text", nullable: true },
    ],
    foreignKeys: [{ column: "site_id", references: { table: "sites", column: "id" } }],
  },
  {
    name: "analytics_events",
    columns: [
      ...BASE_COLUMNS,
      { name: "event_type", type: "text" },
      { name: "page_path", type: "text" },
      { name: "referrer", type: "text", nullable: true },
      { name: "user_agent", type: "text", nullable: true },
      { name: "ip_address", type: "text", nullable: true },
      { name: "metadata", type: "jsonb", nullable: true },
    ],
    foreignKeys: [{ column: "site_id", references: { table: "sites", column: "id" } }],
  },
];

// Junction tables for M:N (15 tables)
const JUNCTION_TABLES: TableDef[] = [
  {
    name: "product_categories",
    columns: [...BASE_COLUMNS],
    foreignKeys: [
      { column: "product_id", references: { table: "products", column: "id" } },
      {
        column: "category_id",
        references: { table: "ec_categories", column: "id" },
      },
    ],
  },
  {
    name: "ec_categories",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "slug", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "image_url", type: "text", nullable: true },
      { name: "sort_order", type: "integer", default: "0" },
    ],
    foreignKeys: [{ column: "store_id", references: { table: "stores", column: "id" } }],
    selfRef: { column: "parent_id", nullable: true },
  },
  {
    name: "store_payment_methods",
    columns: [
      ...BASE_COLUMNS,
      { name: "is_enabled", type: "boolean", default: "true" },
      { name: "config", type: "jsonb", nullable: true },
    ],
    foreignKeys: [
      { column: "store_id", references: { table: "stores", column: "id" } },
      {
        column: "payment_method_id",
        references: { table: "payment_methods", column: "id" },
      },
    ],
  },
  {
    name: "store_shipping_carriers",
    columns: [
      ...BASE_COLUMNS,
      { name: "is_enabled", type: "boolean", default: "true" },
      { name: "config", type: "jsonb", nullable: true },
    ],
    foreignKeys: [
      { column: "store_id", references: { table: "stores", column: "id" } },
      {
        column: "carrier_id",
        references: { table: "shipping_carriers", column: "id" },
      },
    ],
  },
  {
    name: "store_currencies",
    columns: [
      ...BASE_COLUMNS,
      { name: "is_default", type: "boolean", default: "false" },
      { name: "exchange_rate", type: "numeric(12,6)", default: "1.0" },
    ],
    foreignKeys: [
      { column: "store_id", references: { table: "stores", column: "id" } },
      {
        column: "currency_id",
        references: { table: "currencies", column: "id" },
      },
    ],
  },
  {
    name: "related_products",
    columns: [
      ...BASE_COLUMNS,
      { name: "relationship_type", type: "text", default: "'related'" },
      { name: "sort_order", type: "integer", default: "0" },
    ],
    foreignKeys: [
      { column: "product_id", references: { table: "products", column: "id" } },
      {
        column: "related_product_id",
        references: { table: "products", column: "id" },
      },
    ],
  },
  {
    name: "user_roles",
    columns: [...BASE_COLUMNS],
    foreignKeys: [
      { column: "user_id", references: { table: "users", column: "id" } },
      { column: "role_id", references: { table: "roles", column: "id" } },
    ],
  },
  {
    name: "roles",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "code", type: "text" },
      { name: "description", type: "text", nullable: true },
    ],
  },
  {
    name: "role_permissions",
    columns: [...BASE_COLUMNS],
    foreignKeys: [
      { column: "role_id", references: { table: "roles", column: "id" } },
      {
        column: "permission_id",
        references: { table: "permissions", column: "id" },
      },
    ],
  },
  {
    name: "permissions",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "code", type: "text" },
      { name: "description", type: "text", nullable: true },
    ],
  },
  {
    name: "author_articles",
    columns: [...BASE_COLUMNS, { name: "is_primary", type: "boolean", default: "false" }],
    foreignKeys: [
      { column: "author_id", references: { table: "authors", column: "id" } },
      { column: "article_id", references: { table: "articles", column: "id" } },
    ],
  },
  {
    name: "site_authors",
    columns: [...BASE_COLUMNS, { name: "is_admin", type: "boolean", default: "false" }],
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
      { column: "author_id", references: { table: "authors", column: "id" } },
    ],
  },
  {
    name: "customer_stores",
    columns: [...BASE_COLUMNS, { name: "is_favorite", type: "boolean", default: "false" }],
    foreignKeys: [
      {
        column: "customer_id",
        references: { table: "customers", column: "id" },
      },
      { column: "store_id", references: { table: "stores", column: "id" } },
    ],
  },
  {
    name: "product_collections",
    columns: [...BASE_COLUMNS, { name: "sort_order", type: "integer", default: "0" }],
    foreignKeys: [
      { column: "product_id", references: { table: "products", column: "id" } },
      {
        column: "collection_id",
        references: { table: "collections", column: "id" },
      },
    ],
  },
  {
    name: "collections",
    columns: [
      ...BASE_COLUMNS,
      { name: "name", type: "text" },
      { name: "slug", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "image_url", type: "text", nullable: true },
      { name: "is_published", type: "boolean", default: "false" },
    ],
    foreignKeys: [{ column: "store_id", references: { table: "stores", column: "id" } }],
  },
];

// Deep nesting chain (5 tables)
const DEEP_NESTING_TABLES: TableDef[] = [
  {
    name: "regions",
    columns: [...BASE_COLUMNS, { name: "name", type: "text" }, { name: "code", type: "text" }],
  },
  {
    name: "districts",
    columns: [...BASE_COLUMNS, { name: "name", type: "text" }, { name: "code", type: "text" }],
    foreignKeys: [{ column: "region_id", references: { table: "regions", column: "id" } }],
  },
  {
    name: "cities",
    columns: [...BASE_COLUMNS, { name: "name", type: "text" }, { name: "postal_code_prefix", type: "text", nullable: true }],
    foreignKeys: [
      {
        column: "district_id",
        references: { table: "districts", column: "id" },
      },
    ],
  },
  {
    name: "neighborhoods",
    columns: [...BASE_COLUMNS, { name: "name", type: "text" }, { name: "population", type: "integer", nullable: true }],
    foreignKeys: [{ column: "city_id", references: { table: "cities", column: "id" } }],
  },
  {
    name: "streets",
    columns: [...BASE_COLUMNS, { name: "name", type: "text" }, { name: "postal_code", type: "text", nullable: true }],
    foreignKeys: [
      {
        column: "neighborhood_id",
        references: { table: "neighborhoods", column: "id" },
      },
    ],
  },
];

// Combine all tables
const ALL_TABLES: TableDef[] = [
  // Master tables first (no foreign keys)
  ...EC_MASTER_TABLES,
  { ...DEEP_NESTING_TABLES[0] }, // regions
  ...SNS_TABLES.filter((t) => t.name === "users" || t.name === "report_statuses"),
  ...CMS_TABLES.filter((t) => t.name === "sites"),
  ...JUNCTION_TABLES.filter((t) => t.name === "roles" || t.name === "permissions"),
  // Then dependent tables
  { ...DEEP_NESTING_TABLES[1] }, // districts
  { ...DEEP_NESTING_TABLES[2] }, // cities
  { ...DEEP_NESTING_TABLES[3] }, // neighborhoods
  { ...DEEP_NESTING_TABLES[4] }, // streets
  ...EC_CORE_TABLES,
  ...SNS_TABLES.filter((t) => t.name !== "users" && t.name !== "report_statuses"),
  ...CMS_TABLES.filter((t) => t.name !== "sites"),
  ...JUNCTION_TABLES.filter((t) => t.name !== "roles" && t.name !== "permissions"),
];

function generateColumnSQL(col: Column): string {
  let sql = `"${col.name}" ${col.type}`;
  if (!col.nullable && col.name !== "id") {
    sql += " NOT NULL";
  }
  if (col.default !== undefined) {
    sql += ` DEFAULT ${col.default}`;
  }
  return sql;
}

function generateCreateTableSQL(table: TableDef): string {
  const lines: string[] = [];
  lines.push(`CREATE TABLE IF NOT EXISTS "${table.name}" (`);

  const columnDefs: string[] = [];

  // Add columns
  for (const col of table.columns) {
    columnDefs.push(`  ${generateColumnSQL(col)}`);
  }

  // Add foreign key columns
  if (table.foreignKeys) {
    for (const fk of table.foreignKeys) {
      columnDefs.push(`  "${fk.column}" uuid`);
    }
  }

  // Add self-referential column
  if (table.selfRef) {
    columnDefs.push(`  "${table.selfRef.column}" uuid`);
  }

  // Primary key
  columnDefs.push('  PRIMARY KEY ("id")');

  lines.push(columnDefs.join(",\n"));
  lines.push(");");

  return lines.join("\n");
}

function generateForeignKeySQL(table: TableDef): string[] {
  const statements: string[] = [];

  // Add foreign key constraints
  if (table.foreignKeys) {
    for (const fk of table.foreignKeys) {
      statements.push(
        `ALTER TABLE "${table.name}" ADD CONSTRAINT "fk_${table.name}_${fk.column}" ` +
          `FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references.table}" ("${fk.references.column}");`,
      );
    }
  }

  // Add self-referential constraint
  if (table.selfRef) {
    statements.push(
      `ALTER TABLE "${table.name}" ADD CONSTRAINT "fk_${table.name}_${table.selfRef.column}" ` +
        `FOREIGN KEY ("${table.selfRef.column}") REFERENCES "${table.name}" ("id");`,
    );
  }

  return statements;
}

async function main() {
  const migrationsDir = join(import.meta.dirname, "..", "hasura", "migrations", "default");
  const timestamp = "20240101000000";
  const migrationDir = join(migrationsDir, `${timestamp}_init`);

  await mkdir(migrationDir, { recursive: true });

  const upSQL: string[] = [];
  const downSQL: string[] = [];

  // Phase 1: Create all tables (without foreign keys)
  upSQL.push("-- Phase 1: Create all tables");
  for (const table of ALL_TABLES) {
    upSQL.push(generateCreateTableSQL(table));
    upSQL.push("");
  }

  // Phase 2: Add all foreign key constraints
  upSQL.push("-- Phase 2: Add foreign key constraints");
  for (const table of ALL_TABLES) {
    const fkStatements = generateForeignKeySQL(table);
    for (const stmt of fkStatements) {
      upSQL.push(stmt);
    }
  }

  // Generate DROP statements (reverse order)
  for (const table of [...ALL_TABLES].reverse()) {
    downSQL.push(`DROP TABLE IF EXISTS "${table.name}" CASCADE;`);
  }

  await writeFile(join(migrationDir, "up.sql"), upSQL.join("\n"));
  await writeFile(join(migrationDir, "down.sql"), downSQL.join("\n"));

  console.log(`Generated migration with ${ALL_TABLES.length} tables`);
  console.log(`Migration directory: ${migrationDir}`);
}

main().catch(console.error);
