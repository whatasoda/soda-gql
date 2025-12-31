-- Phase 1: Create all tables
CREATE TABLE IF NOT EXISTS "brands" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo_url" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "colors" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "hex_code" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sizes" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "currencies" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "symbol" text NOT NULL,
  "decimal_places" integer NOT NULL DEFAULT 2,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "countries" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "is_shipping_enabled" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_statuses" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_final" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payment_statuses" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shipping_carriers" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "tracking_url_template" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shipment_statuses" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "return_statuses" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "regions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "username" text NOT NULL,
  "email" text NOT NULL,
  "display_name" text NOT NULL,
  "bio" text,
  "avatar_url" text,
  "is_verified" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "report_statuses" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sites" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "domain" text NOT NULL,
  "is_published" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "roles" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "description" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "description" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "districts" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "region_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cities" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "postal_code_prefix" text,
  "district_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "neighborhoods" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "population" integer,
  "city_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "streets" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "postal_code" text,
  "neighborhood_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stores" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "customers" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "email" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "phone" text,
  "store_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "customer_addresses" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "label" text NOT NULL,
  "street" text NOT NULL,
  "city" text NOT NULL,
  "state" text,
  "postal_code" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "customer_id" uuid,
  "country_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "base_price" numeric(12,2) NOT NULL,
  "is_published" boolean NOT NULL DEFAULT false,
  "store_id" uuid,
  "brand_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "sku" text NOT NULL,
  "price" numeric(12,2) NOT NULL,
  "stock_quantity" integer NOT NULL DEFAULT 0,
  "product_id" uuid,
  "color_id" uuid,
  "size_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_images" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "url" text NOT NULL,
  "alt_text" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_primary" boolean NOT NULL DEFAULT false,
  "product_id" uuid,
  "variant_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "carts" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "session_id" text,
  "expires_at" timestamptz,
  "customer_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cart_items" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_price" numeric(12,2) NOT NULL,
  "cart_id" uuid,
  "variant_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "order_number" text NOT NULL,
  "total_amount" numeric(12,2) NOT NULL,
  "notes" text,
  "customer_id" uuid,
  "store_id" uuid,
  "status_id" uuid,
  "shipping_address_id" uuid,
  "billing_address_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_items" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "quantity" integer NOT NULL,
  "unit_price" numeric(12,2) NOT NULL,
  "total_price" numeric(12,2) NOT NULL,
  "order_id" uuid,
  "variant_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "amount" numeric(12,2) NOT NULL,
  "transaction_id" text,
  "paid_at" timestamptz,
  "order_id" uuid,
  "method_id" uuid,
  "status_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shipments" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "tracking_number" text,
  "shipped_at" timestamptz,
  "delivered_at" timestamptz,
  "order_id" uuid,
  "carrier_id" uuid,
  "status_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reviews" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "rating" integer NOT NULL,
  "title" text,
  "body" text,
  "is_verified" boolean NOT NULL DEFAULT false,
  "product_id" uuid,
  "customer_id" uuid,
  "order_item_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "wishlists" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL DEFAULT 'Default',
  "customer_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "wishlist_items" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  "wishlist_id" uuid,
  "product_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "coupons" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "code" text NOT NULL,
  "discount_type" text NOT NULL,
  "discount_value" numeric(12,2) NOT NULL,
  "min_order_amount" numeric(12,2),
  "max_uses" integer,
  "used_count" integer NOT NULL DEFAULT 0,
  "starts_at" timestamptz NOT NULL,
  "expires_at" timestamptz,
  "store_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_coupons" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "discount_amount" numeric(12,2) NOT NULL,
  "order_id" uuid,
  "coupon_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_locations" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "address" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "store_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_levels" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "quantity" integer NOT NULL DEFAULT 0,
  "reserved" integer NOT NULL DEFAULT 0,
  "variant_id" uuid,
  "location_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "return_requests" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "reason" text NOT NULL,
  "notes" text,
  "order_id" uuid,
  "status_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "website" text,
  "location" text,
  "birthday" date,
  "is_private" boolean NOT NULL DEFAULT false,
  "user_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "content" text NOT NULL,
  "is_published" boolean NOT NULL DEFAULT true,
  "published_at" timestamptz,
  "view_count" bigint NOT NULL DEFAULT 0,
  "author_id" uuid,
  "reply_to_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "post_media" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "media_type" text NOT NULL,
  "url" text NOT NULL,
  "thumbnail_url" text,
  "alt_text" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "post_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "likes" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "user_id" uuid,
  "post_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bookmarks" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "user_id" uuid,
  "post_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "follows" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "is_approved" boolean NOT NULL DEFAULT true,
  "follower_id" uuid,
  "following_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "blocks" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "blocker_id" uuid,
  "blocked_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "title" text,
  "is_group" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "conversation_participants" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "left_at" timestamptz,
  "is_admin" boolean NOT NULL DEFAULT false,
  "conversation_id" uuid,
  "user_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "content" text NOT NULL,
  "read_at" timestamptz,
  "conversation_id" uuid,
  "sender_id" uuid,
  "reply_to_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "message_reactions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "emoji" text NOT NULL,
  "message_id" uuid,
  "user_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "data" jsonb,
  "read_at" timestamptz,
  "user_id" uuid,
  "actor_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hashtags" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "post_count" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "post_hashtags" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "post_id" uuid,
  "hashtag_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "mentions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "post_id" uuid,
  "user_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reports" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "reason" text NOT NULL,
  "description" text,
  "resolved_at" timestamptz,
  "reporter_id" uuid,
  "post_id" uuid,
  "status_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_settings" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "notification_email" boolean NOT NULL DEFAULT true,
  "notification_push" boolean NOT NULL DEFAULT true,
  "notification_sms" boolean NOT NULL DEFAULT false,
  "theme" text NOT NULL DEFAULT 'system',
  "language" text NOT NULL DEFAULT 'en',
  "user_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "token" text NOT NULL,
  "device_info" text,
  "ip_address" text,
  "last_active_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "user_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "authors" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "bio" text,
  "avatar_url" text,
  "site_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pages" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "content" text,
  "meta_title" text,
  "meta_description" text,
  "is_published" boolean NOT NULL DEFAULT false,
  "published_at" timestamptz,
  "sort_order" integer NOT NULL DEFAULT 0,
  "site_id" uuid,
  "template_id" uuid,
  "parent_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "page_templates" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "schema" jsonb,
  "site_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "page_versions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "version_number" integer NOT NULL,
  "content" text NOT NULL,
  "published_at" timestamptz,
  "page_id" uuid,
  "author_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "articles" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "excerpt" text,
  "content" text NOT NULL,
  "featured_image_url" text,
  "is_featured" boolean NOT NULL DEFAULT false,
  "is_published" boolean NOT NULL DEFAULT false,
  "published_at" timestamptz,
  "view_count" bigint NOT NULL DEFAULT 0,
  "site_id" uuid,
  "author_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "article_categories" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "site_id" uuid,
  "parent_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "article_category_assignments" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "article_id" uuid,
  "category_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tags" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "site_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "article_tags" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "article_id" uuid,
  "tag_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "comments" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "author_name" text NOT NULL,
  "author_email" text NOT NULL,
  "content" text NOT NULL,
  "is_approved" boolean NOT NULL DEFAULT false,
  "article_id" uuid,
  "parent_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "media_files" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "url" text NOT NULL,
  "alt_text" text,
  "site_id" uuid,
  "folder_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "media_folders" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "path" text NOT NULL,
  "site_id" uuid,
  "parent_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "menus" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "location" text,
  "site_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "menu_items" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "label" text NOT NULL,
  "url" text,
  "target" text NOT NULL DEFAULT '_self',
  "sort_order" integer NOT NULL DEFAULT 0,
  "menu_id" uuid,
  "page_id" uuid,
  "parent_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "forms" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "schema" jsonb NOT NULL,
  "success_message" text,
  "site_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "form_submissions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "data" jsonb NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "form_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "redirects" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "from_path" text NOT NULL,
  "to_path" text NOT NULL,
  "status_code" integer NOT NULL DEFAULT 301,
  "is_active" boolean NOT NULL DEFAULT true,
  "site_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seo_settings" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "default_title" text,
  "title_template" text,
  "default_description" text,
  "og_image_url" text,
  "robots_txt" text,
  "site_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "event_type" text NOT NULL,
  "page_path" text NOT NULL,
  "referrer" text,
  "user_agent" text,
  "ip_address" text,
  "metadata" jsonb,
  "site_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_categories" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "product_id" uuid,
  "category_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ec_categories" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "image_url" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "store_id" uuid,
  "parent_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "store_payment_methods" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "config" jsonb,
  "store_id" uuid,
  "payment_method_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "store_shipping_carriers" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "config" jsonb,
  "store_id" uuid,
  "carrier_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "store_currencies" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "is_default" boolean NOT NULL DEFAULT false,
  "exchange_rate" numeric(12,6) NOT NULL DEFAULT 1.0,
  "store_id" uuid,
  "currency_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "related_products" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "relationship_type" text NOT NULL DEFAULT 'related',
  "sort_order" integer NOT NULL DEFAULT 0,
  "product_id" uuid,
  "related_product_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "user_id" uuid,
  "role_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "role_id" uuid,
  "permission_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "author_articles" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "is_primary" boolean NOT NULL DEFAULT false,
  "author_id" uuid,
  "article_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "site_authors" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "is_admin" boolean NOT NULL DEFAULT false,
  "site_id" uuid,
  "author_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "customer_stores" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "is_favorite" boolean NOT NULL DEFAULT false,
  "customer_id" uuid,
  "store_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_collections" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "sort_order" integer NOT NULL DEFAULT 0,
  "product_id" uuid,
  "collection_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collections" (
  "id" uuid DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "image_url" text,
  "is_published" boolean NOT NULL DEFAULT false,
  "store_id" uuid,
  PRIMARY KEY ("id")
);

-- Phase 2: Add foreign key constraints
ALTER TABLE "districts" ADD CONSTRAINT "fk_districts_region_id" FOREIGN KEY ("region_id") REFERENCES "regions" ("id");
ALTER TABLE "cities" ADD CONSTRAINT "fk_cities_district_id" FOREIGN KEY ("district_id") REFERENCES "districts" ("id");
ALTER TABLE "neighborhoods" ADD CONSTRAINT "fk_neighborhoods_city_id" FOREIGN KEY ("city_id") REFERENCES "cities" ("id");
ALTER TABLE "streets" ADD CONSTRAINT "fk_streets_neighborhood_id" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods" ("id");
ALTER TABLE "customers" ADD CONSTRAINT "fk_customers_store_id" FOREIGN KEY ("store_id") REFERENCES "stores" ("id");
ALTER TABLE "customer_addresses" ADD CONSTRAINT "fk_customer_addresses_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");
ALTER TABLE "customer_addresses" ADD CONSTRAINT "fk_customer_addresses_country_id" FOREIGN KEY ("country_id") REFERENCES "countries" ("id");
ALTER TABLE "products" ADD CONSTRAINT "fk_products_store_id" FOREIGN KEY ("store_id") REFERENCES "stores" ("id");
ALTER TABLE "products" ADD CONSTRAINT "fk_products_brand_id" FOREIGN KEY ("brand_id") REFERENCES "brands" ("id");
ALTER TABLE "product_variants" ADD CONSTRAINT "fk_product_variants_product_id" FOREIGN KEY ("product_id") REFERENCES "products" ("id");
ALTER TABLE "product_variants" ADD CONSTRAINT "fk_product_variants_color_id" FOREIGN KEY ("color_id") REFERENCES "colors" ("id");
ALTER TABLE "product_variants" ADD CONSTRAINT "fk_product_variants_size_id" FOREIGN KEY ("size_id") REFERENCES "sizes" ("id");
ALTER TABLE "product_images" ADD CONSTRAINT "fk_product_images_product_id" FOREIGN KEY ("product_id") REFERENCES "products" ("id");
ALTER TABLE "product_images" ADD CONSTRAINT "fk_product_images_variant_id" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id");
ALTER TABLE "carts" ADD CONSTRAINT "fk_carts_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");
ALTER TABLE "cart_items" ADD CONSTRAINT "fk_cart_items_cart_id" FOREIGN KEY ("cart_id") REFERENCES "carts" ("id");
ALTER TABLE "cart_items" ADD CONSTRAINT "fk_cart_items_variant_id" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id");
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_store_id" FOREIGN KEY ("store_id") REFERENCES "stores" ("id");
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_status_id" FOREIGN KEY ("status_id") REFERENCES "order_statuses" ("id");
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_shipping_address_id" FOREIGN KEY ("shipping_address_id") REFERENCES "customer_addresses" ("id");
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_billing_address_id" FOREIGN KEY ("billing_address_id") REFERENCES "customer_addresses" ("id");
ALTER TABLE "order_items" ADD CONSTRAINT "fk_order_items_order_id" FOREIGN KEY ("order_id") REFERENCES "orders" ("id");
ALTER TABLE "order_items" ADD CONSTRAINT "fk_order_items_variant_id" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id");
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_order_id" FOREIGN KEY ("order_id") REFERENCES "orders" ("id");
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_method_id" FOREIGN KEY ("method_id") REFERENCES "payment_methods" ("id");
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_status_id" FOREIGN KEY ("status_id") REFERENCES "payment_statuses" ("id");
ALTER TABLE "shipments" ADD CONSTRAINT "fk_shipments_order_id" FOREIGN KEY ("order_id") REFERENCES "orders" ("id");
ALTER TABLE "shipments" ADD CONSTRAINT "fk_shipments_carrier_id" FOREIGN KEY ("carrier_id") REFERENCES "shipping_carriers" ("id");
ALTER TABLE "shipments" ADD CONSTRAINT "fk_shipments_status_id" FOREIGN KEY ("status_id") REFERENCES "shipment_statuses" ("id");
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_product_id" FOREIGN KEY ("product_id") REFERENCES "products" ("id");
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_order_item_id" FOREIGN KEY ("order_item_id") REFERENCES "order_items" ("id");
ALTER TABLE "wishlists" ADD CONSTRAINT "fk_wishlists_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");
ALTER TABLE "wishlist_items" ADD CONSTRAINT "fk_wishlist_items_wishlist_id" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists" ("id");
ALTER TABLE "wishlist_items" ADD CONSTRAINT "fk_wishlist_items_product_id" FOREIGN KEY ("product_id") REFERENCES "products" ("id");
ALTER TABLE "coupons" ADD CONSTRAINT "fk_coupons_store_id" FOREIGN KEY ("store_id") REFERENCES "stores" ("id");
ALTER TABLE "order_coupons" ADD CONSTRAINT "fk_order_coupons_order_id" FOREIGN KEY ("order_id") REFERENCES "orders" ("id");
ALTER TABLE "order_coupons" ADD CONSTRAINT "fk_order_coupons_coupon_id" FOREIGN KEY ("coupon_id") REFERENCES "coupons" ("id");
ALTER TABLE "inventory_locations" ADD CONSTRAINT "fk_inventory_locations_store_id" FOREIGN KEY ("store_id") REFERENCES "stores" ("id");
ALTER TABLE "inventory_levels" ADD CONSTRAINT "fk_inventory_levels_variant_id" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id");
ALTER TABLE "inventory_levels" ADD CONSTRAINT "fk_inventory_levels_location_id" FOREIGN KEY ("location_id") REFERENCES "inventory_locations" ("id");
ALTER TABLE "return_requests" ADD CONSTRAINT "fk_return_requests_order_id" FOREIGN KEY ("order_id") REFERENCES "orders" ("id");
ALTER TABLE "return_requests" ADD CONSTRAINT "fk_return_requests_status_id" FOREIGN KEY ("status_id") REFERENCES "return_statuses" ("id");
ALTER TABLE "user_profiles" ADD CONSTRAINT "fk_user_profiles_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id");
ALTER TABLE "posts" ADD CONSTRAINT "fk_posts_author_id" FOREIGN KEY ("author_id") REFERENCES "users" ("id");
ALTER TABLE "posts" ADD CONSTRAINT "fk_posts_reply_to_id" FOREIGN KEY ("reply_to_id") REFERENCES "posts" ("id");
ALTER TABLE "post_media" ADD CONSTRAINT "fk_post_media_post_id" FOREIGN KEY ("post_id") REFERENCES "posts" ("id");
ALTER TABLE "likes" ADD CONSTRAINT "fk_likes_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id");
ALTER TABLE "likes" ADD CONSTRAINT "fk_likes_post_id" FOREIGN KEY ("post_id") REFERENCES "posts" ("id");
ALTER TABLE "bookmarks" ADD CONSTRAINT "fk_bookmarks_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id");
ALTER TABLE "bookmarks" ADD CONSTRAINT "fk_bookmarks_post_id" FOREIGN KEY ("post_id") REFERENCES "posts" ("id");
ALTER TABLE "follows" ADD CONSTRAINT "fk_follows_follower_id" FOREIGN KEY ("follower_id") REFERENCES "users" ("id");
ALTER TABLE "follows" ADD CONSTRAINT "fk_follows_following_id" FOREIGN KEY ("following_id") REFERENCES "users" ("id");
ALTER TABLE "blocks" ADD CONSTRAINT "fk_blocks_blocker_id" FOREIGN KEY ("blocker_id") REFERENCES "users" ("id");
ALTER TABLE "blocks" ADD CONSTRAINT "fk_blocks_blocked_id" FOREIGN KEY ("blocked_id") REFERENCES "users" ("id");
ALTER TABLE "conversation_participants" ADD CONSTRAINT "fk_conversation_participants_conversation_id" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id");
ALTER TABLE "conversation_participants" ADD CONSTRAINT "fk_conversation_participants_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id");
ALTER TABLE "messages" ADD CONSTRAINT "fk_messages_conversation_id" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id");
ALTER TABLE "messages" ADD CONSTRAINT "fk_messages_sender_id" FOREIGN KEY ("sender_id") REFERENCES "users" ("id");
ALTER TABLE "messages" ADD CONSTRAINT "fk_messages_reply_to_id" FOREIGN KEY ("reply_to_id") REFERENCES "messages" ("id");
ALTER TABLE "message_reactions" ADD CONSTRAINT "fk_message_reactions_message_id" FOREIGN KEY ("message_id") REFERENCES "messages" ("id");
ALTER TABLE "message_reactions" ADD CONSTRAINT "fk_message_reactions_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id");
ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id");
ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications_actor_id" FOREIGN KEY ("actor_id") REFERENCES "users" ("id");
ALTER TABLE "post_hashtags" ADD CONSTRAINT "fk_post_hashtags_post_id" FOREIGN KEY ("post_id") REFERENCES "posts" ("id");
ALTER TABLE "post_hashtags" ADD CONSTRAINT "fk_post_hashtags_hashtag_id" FOREIGN KEY ("hashtag_id") REFERENCES "hashtags" ("id");
ALTER TABLE "mentions" ADD CONSTRAINT "fk_mentions_post_id" FOREIGN KEY ("post_id") REFERENCES "posts" ("id");
ALTER TABLE "mentions" ADD CONSTRAINT "fk_mentions_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id");
ALTER TABLE "reports" ADD CONSTRAINT "fk_reports_reporter_id" FOREIGN KEY ("reporter_id") REFERENCES "users" ("id");
ALTER TABLE "reports" ADD CONSTRAINT "fk_reports_post_id" FOREIGN KEY ("post_id") REFERENCES "posts" ("id");
ALTER TABLE "reports" ADD CONSTRAINT "fk_reports_status_id" FOREIGN KEY ("status_id") REFERENCES "report_statuses" ("id");
ALTER TABLE "user_settings" ADD CONSTRAINT "fk_user_settings_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id");
ALTER TABLE "user_sessions" ADD CONSTRAINT "fk_user_sessions_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id");
ALTER TABLE "authors" ADD CONSTRAINT "fk_authors_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "pages" ADD CONSTRAINT "fk_pages_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "pages" ADD CONSTRAINT "fk_pages_template_id" FOREIGN KEY ("template_id") REFERENCES "page_templates" ("id");
ALTER TABLE "pages" ADD CONSTRAINT "fk_pages_parent_id" FOREIGN KEY ("parent_id") REFERENCES "pages" ("id");
ALTER TABLE "page_templates" ADD CONSTRAINT "fk_page_templates_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "page_versions" ADD CONSTRAINT "fk_page_versions_page_id" FOREIGN KEY ("page_id") REFERENCES "pages" ("id");
ALTER TABLE "page_versions" ADD CONSTRAINT "fk_page_versions_author_id" FOREIGN KEY ("author_id") REFERENCES "authors" ("id");
ALTER TABLE "articles" ADD CONSTRAINT "fk_articles_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "articles" ADD CONSTRAINT "fk_articles_author_id" FOREIGN KEY ("author_id") REFERENCES "authors" ("id");
ALTER TABLE "article_categories" ADD CONSTRAINT "fk_article_categories_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "article_categories" ADD CONSTRAINT "fk_article_categories_parent_id" FOREIGN KEY ("parent_id") REFERENCES "article_categories" ("id");
ALTER TABLE "article_category_assignments" ADD CONSTRAINT "fk_article_category_assignments_article_id" FOREIGN KEY ("article_id") REFERENCES "articles" ("id");
ALTER TABLE "article_category_assignments" ADD CONSTRAINT "fk_article_category_assignments_category_id" FOREIGN KEY ("category_id") REFERENCES "article_categories" ("id");
ALTER TABLE "tags" ADD CONSTRAINT "fk_tags_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "article_tags" ADD CONSTRAINT "fk_article_tags_article_id" FOREIGN KEY ("article_id") REFERENCES "articles" ("id");
ALTER TABLE "article_tags" ADD CONSTRAINT "fk_article_tags_tag_id" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id");
ALTER TABLE "comments" ADD CONSTRAINT "fk_comments_article_id" FOREIGN KEY ("article_id") REFERENCES "articles" ("id");
ALTER TABLE "comments" ADD CONSTRAINT "fk_comments_parent_id" FOREIGN KEY ("parent_id") REFERENCES "comments" ("id");
ALTER TABLE "media_files" ADD CONSTRAINT "fk_media_files_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "media_files" ADD CONSTRAINT "fk_media_files_folder_id" FOREIGN KEY ("folder_id") REFERENCES "media_folders" ("id");
ALTER TABLE "media_folders" ADD CONSTRAINT "fk_media_folders_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "media_folders" ADD CONSTRAINT "fk_media_folders_parent_id" FOREIGN KEY ("parent_id") REFERENCES "media_folders" ("id");
ALTER TABLE "menus" ADD CONSTRAINT "fk_menus_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "menu_items" ADD CONSTRAINT "fk_menu_items_menu_id" FOREIGN KEY ("menu_id") REFERENCES "menus" ("id");
ALTER TABLE "menu_items" ADD CONSTRAINT "fk_menu_items_page_id" FOREIGN KEY ("page_id") REFERENCES "pages" ("id");
ALTER TABLE "menu_items" ADD CONSTRAINT "fk_menu_items_parent_id" FOREIGN KEY ("parent_id") REFERENCES "menu_items" ("id");
ALTER TABLE "forms" ADD CONSTRAINT "fk_forms_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "form_submissions" ADD CONSTRAINT "fk_form_submissions_form_id" FOREIGN KEY ("form_id") REFERENCES "forms" ("id");
ALTER TABLE "redirects" ADD CONSTRAINT "fk_redirects_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "seo_settings" ADD CONSTRAINT "fk_seo_settings_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "analytics_events" ADD CONSTRAINT "fk_analytics_events_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "product_categories" ADD CONSTRAINT "fk_product_categories_product_id" FOREIGN KEY ("product_id") REFERENCES "products" ("id");
ALTER TABLE "product_categories" ADD CONSTRAINT "fk_product_categories_category_id" FOREIGN KEY ("category_id") REFERENCES "ec_categories" ("id");
ALTER TABLE "ec_categories" ADD CONSTRAINT "fk_ec_categories_store_id" FOREIGN KEY ("store_id") REFERENCES "stores" ("id");
ALTER TABLE "ec_categories" ADD CONSTRAINT "fk_ec_categories_parent_id" FOREIGN KEY ("parent_id") REFERENCES "ec_categories" ("id");
ALTER TABLE "store_payment_methods" ADD CONSTRAINT "fk_store_payment_methods_store_id" FOREIGN KEY ("store_id") REFERENCES "stores" ("id");
ALTER TABLE "store_payment_methods" ADD CONSTRAINT "fk_store_payment_methods_payment_method_id" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods" ("id");
ALTER TABLE "store_shipping_carriers" ADD CONSTRAINT "fk_store_shipping_carriers_store_id" FOREIGN KEY ("store_id") REFERENCES "stores" ("id");
ALTER TABLE "store_shipping_carriers" ADD CONSTRAINT "fk_store_shipping_carriers_carrier_id" FOREIGN KEY ("carrier_id") REFERENCES "shipping_carriers" ("id");
ALTER TABLE "store_currencies" ADD CONSTRAINT "fk_store_currencies_store_id" FOREIGN KEY ("store_id") REFERENCES "stores" ("id");
ALTER TABLE "store_currencies" ADD CONSTRAINT "fk_store_currencies_currency_id" FOREIGN KEY ("currency_id") REFERENCES "currencies" ("id");
ALTER TABLE "related_products" ADD CONSTRAINT "fk_related_products_product_id" FOREIGN KEY ("product_id") REFERENCES "products" ("id");
ALTER TABLE "related_products" ADD CONSTRAINT "fk_related_products_related_product_id" FOREIGN KEY ("related_product_id") REFERENCES "products" ("id");
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id");
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_role_id" FOREIGN KEY ("role_id") REFERENCES "roles" ("id");
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions_role_id" FOREIGN KEY ("role_id") REFERENCES "roles" ("id");
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions_permission_id" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id");
ALTER TABLE "author_articles" ADD CONSTRAINT "fk_author_articles_author_id" FOREIGN KEY ("author_id") REFERENCES "authors" ("id");
ALTER TABLE "author_articles" ADD CONSTRAINT "fk_author_articles_article_id" FOREIGN KEY ("article_id") REFERENCES "articles" ("id");
ALTER TABLE "site_authors" ADD CONSTRAINT "fk_site_authors_site_id" FOREIGN KEY ("site_id") REFERENCES "sites" ("id");
ALTER TABLE "site_authors" ADD CONSTRAINT "fk_site_authors_author_id" FOREIGN KEY ("author_id") REFERENCES "authors" ("id");
ALTER TABLE "customer_stores" ADD CONSTRAINT "fk_customer_stores_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");
ALTER TABLE "customer_stores" ADD CONSTRAINT "fk_customer_stores_store_id" FOREIGN KEY ("store_id") REFERENCES "stores" ("id");
ALTER TABLE "product_collections" ADD CONSTRAINT "fk_product_collections_product_id" FOREIGN KEY ("product_id") REFERENCES "products" ("id");
ALTER TABLE "product_collections" ADD CONSTRAINT "fk_product_collections_collection_id" FOREIGN KEY ("collection_id") REFERENCES "collections" ("id");
ALTER TABLE "collections" ADD CONSTRAINT "fk_collections_store_id" FOREIGN KEY ("store_id") REFERENCES "stores" ("id");