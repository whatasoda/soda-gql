#!/usr/bin/env bun
/**
 * Generates Hasura metadata for table tracking and relationships.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface ForeignKey {
  column: string;
  references: { table: string; column: string };
}

interface TableMeta {
  name: string;
  foreignKeys?: ForeignKey[];
  selfRef?: { column: string; nullable: boolean };
}

// Same table definitions as generate-schema.ts (simplified for metadata)
const TABLES: TableMeta[] = [
  // EC Master
  { name: "brands" },
  { name: "colors" },
  { name: "sizes" },
  { name: "currencies" },
  { name: "countries" },
  { name: "order_statuses" },
  { name: "payment_methods" },
  { name: "payment_statuses" },
  { name: "shipping_carriers" },
  { name: "shipment_statuses" },
  { name: "return_statuses" },

  // Deep nesting
  { name: "regions" },
  {
    name: "districts",
    foreignKeys: [
      { column: "region_id", references: { table: "regions", column: "id" } },
    ],
  },
  {
    name: "cities",
    foreignKeys: [
      {
        column: "district_id",
        references: { table: "districts", column: "id" },
      },
    ],
  },
  {
    name: "neighborhoods",
    foreignKeys: [
      { column: "city_id", references: { table: "cities", column: "id" } },
    ],
  },
  {
    name: "streets",
    foreignKeys: [
      {
        column: "neighborhood_id",
        references: { table: "neighborhoods", column: "id" },
      },
    ],
  },

  // SNS base
  { name: "users" },
  { name: "report_statuses" },

  // CMS base
  { name: "sites" },

  // Junction base
  { name: "roles" },
  { name: "permissions" },

  // EC Core
  { name: "stores" },
  {
    name: "customers",
    foreignKeys: [
      { column: "store_id", references: { table: "stores", column: "id" } },
    ],
  },
  {
    name: "customer_addresses",
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
    foreignKeys: [
      { column: "store_id", references: { table: "stores", column: "id" } },
      { column: "brand_id", references: { table: "brands", column: "id" } },
    ],
  },
  {
    name: "product_variants",
    foreignKeys: [
      { column: "product_id", references: { table: "products", column: "id" } },
      { column: "color_id", references: { table: "colors", column: "id" } },
      { column: "size_id", references: { table: "sizes", column: "id" } },
    ],
  },
  {
    name: "product_images",
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
    foreignKeys: [
      {
        column: "customer_id",
        references: { table: "customers", column: "id" },
      },
    ],
  },
  {
    name: "cart_items",
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
    foreignKeys: [
      {
        column: "customer_id",
        references: { table: "customers", column: "id" },
      },
    ],
  },
  {
    name: "wishlist_items",
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
    foreignKeys: [
      { column: "store_id", references: { table: "stores", column: "id" } },
    ],
  },
  {
    name: "order_coupons",
    foreignKeys: [
      { column: "order_id", references: { table: "orders", column: "id" } },
      { column: "coupon_id", references: { table: "coupons", column: "id" } },
    ],
  },
  {
    name: "inventory_locations",
    foreignKeys: [
      { column: "store_id", references: { table: "stores", column: "id" } },
    ],
  },
  {
    name: "inventory_levels",
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
    foreignKeys: [
      { column: "order_id", references: { table: "orders", column: "id" } },
      {
        column: "status_id",
        references: { table: "return_statuses", column: "id" },
      },
    ],
  },

  // SNS
  {
    name: "user_profiles",
    foreignKeys: [
      { column: "user_id", references: { table: "users", column: "id" } },
    ],
  },
  {
    name: "posts",
    foreignKeys: [
      { column: "author_id", references: { table: "users", column: "id" } },
    ],
    selfRef: { column: "reply_to_id", nullable: true },
  },
  {
    name: "post_media",
    foreignKeys: [
      { column: "post_id", references: { table: "posts", column: "id" } },
    ],
  },
  {
    name: "likes",
    foreignKeys: [
      { column: "user_id", references: { table: "users", column: "id" } },
      { column: "post_id", references: { table: "posts", column: "id" } },
    ],
  },
  {
    name: "bookmarks",
    foreignKeys: [
      { column: "user_id", references: { table: "users", column: "id" } },
      { column: "post_id", references: { table: "posts", column: "id" } },
    ],
  },
  {
    name: "follows",
    foreignKeys: [
      { column: "follower_id", references: { table: "users", column: "id" } },
      { column: "following_id", references: { table: "users", column: "id" } },
    ],
  },
  {
    name: "blocks",
    foreignKeys: [
      { column: "blocker_id", references: { table: "users", column: "id" } },
      { column: "blocked_id", references: { table: "users", column: "id" } },
    ],
  },
  { name: "conversations" },
  {
    name: "conversation_participants",
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
    foreignKeys: [
      { column: "message_id", references: { table: "messages", column: "id" } },
      { column: "user_id", references: { table: "users", column: "id" } },
    ],
  },
  {
    name: "notifications",
    foreignKeys: [
      { column: "user_id", references: { table: "users", column: "id" } },
      { column: "actor_id", references: { table: "users", column: "id" } },
    ],
  },
  { name: "hashtags" },
  {
    name: "post_hashtags",
    foreignKeys: [
      { column: "post_id", references: { table: "posts", column: "id" } },
      { column: "hashtag_id", references: { table: "hashtags", column: "id" } },
    ],
  },
  {
    name: "mentions",
    foreignKeys: [
      { column: "post_id", references: { table: "posts", column: "id" } },
      { column: "user_id", references: { table: "users", column: "id" } },
    ],
  },
  {
    name: "reports",
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
    name: "user_settings",
    foreignKeys: [
      { column: "user_id", references: { table: "users", column: "id" } },
    ],
  },
  {
    name: "user_sessions",
    foreignKeys: [
      { column: "user_id", references: { table: "users", column: "id" } },
    ],
  },

  // CMS
  {
    name: "authors",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
    ],
  },
  {
    name: "page_templates",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
    ],
  },
  {
    name: "pages",
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
    name: "page_versions",
    foreignKeys: [
      { column: "page_id", references: { table: "pages", column: "id" } },
      { column: "author_id", references: { table: "authors", column: "id" } },
    ],
  },
  {
    name: "articles",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
      { column: "author_id", references: { table: "authors", column: "id" } },
    ],
  },
  {
    name: "article_categories",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
    ],
    selfRef: { column: "parent_id", nullable: true },
  },
  {
    name: "article_category_assignments",
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
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
    ],
  },
  {
    name: "article_tags",
    foreignKeys: [
      { column: "article_id", references: { table: "articles", column: "id" } },
      { column: "tag_id", references: { table: "tags", column: "id" } },
    ],
  },
  {
    name: "comments",
    foreignKeys: [
      { column: "article_id", references: { table: "articles", column: "id" } },
    ],
    selfRef: { column: "parent_id", nullable: true },
  },
  {
    name: "media_folders",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
    ],
    selfRef: { column: "parent_id", nullable: true },
  },
  {
    name: "media_files",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
      {
        column: "folder_id",
        references: { table: "media_folders", column: "id" },
      },
    ],
  },
  {
    name: "menus",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
    ],
  },
  {
    name: "menu_items",
    foreignKeys: [
      { column: "menu_id", references: { table: "menus", column: "id" } },
      { column: "page_id", references: { table: "pages", column: "id" } },
    ],
    selfRef: { column: "parent_id", nullable: true },
  },
  {
    name: "forms",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
    ],
  },
  {
    name: "form_submissions",
    foreignKeys: [
      { column: "form_id", references: { table: "forms", column: "id" } },
    ],
  },
  {
    name: "redirects",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
    ],
  },
  {
    name: "seo_settings",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
    ],
  },
  {
    name: "analytics_events",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
    ],
  },

  // Junction tables
  {
    name: "ec_categories",
    foreignKeys: [
      { column: "store_id", references: { table: "stores", column: "id" } },
    ],
    selfRef: { column: "parent_id", nullable: true },
  },
  {
    name: "product_categories",
    foreignKeys: [
      { column: "product_id", references: { table: "products", column: "id" } },
      {
        column: "category_id",
        references: { table: "ec_categories", column: "id" },
      },
    ],
  },
  {
    name: "store_payment_methods",
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
    foreignKeys: [
      { column: "user_id", references: { table: "users", column: "id" } },
      { column: "role_id", references: { table: "roles", column: "id" } },
    ],
  },
  {
    name: "role_permissions",
    foreignKeys: [
      { column: "role_id", references: { table: "roles", column: "id" } },
      {
        column: "permission_id",
        references: { table: "permissions", column: "id" },
      },
    ],
  },
  {
    name: "author_articles",
    foreignKeys: [
      { column: "author_id", references: { table: "authors", column: "id" } },
      { column: "article_id", references: { table: "articles", column: "id" } },
    ],
  },
  {
    name: "site_authors",
    foreignKeys: [
      { column: "site_id", references: { table: "sites", column: "id" } },
      { column: "author_id", references: { table: "authors", column: "id" } },
    ],
  },
  {
    name: "customer_stores",
    foreignKeys: [
      {
        column: "customer_id",
        references: { table: "customers", column: "id" },
      },
      { column: "store_id", references: { table: "stores", column: "id" } },
    ],
  },
  {
    name: "collections",
    foreignKeys: [
      { column: "store_id", references: { table: "stores", column: "id" } },
    ],
  },
  {
    name: "product_collections",
    foreignKeys: [
      { column: "product_id", references: { table: "products", column: "id" } },
      {
        column: "collection_id",
        references: { table: "collections", column: "id" },
      },
    ],
  },
];

// Build reverse relationship map
function buildReverseRelationships(): Map<
  string,
  { fromTable: string; column: string }[]
> {
  const map = new Map<string, { fromTable: string; column: string }[]>();

  for (const table of TABLES) {
    if (table.foreignKeys) {
      for (const fk of table.foreignKeys) {
        const targetTable = fk.references.table;
        if (!map.has(targetTable)) {
          map.set(targetTable, []);
        }
        map
          .get(targetTable)
          ?.push({ fromTable: table.name, column: fk.column });
      }
    }
    if (table.selfRef) {
      if (!map.has(table.name)) {
        map.set(table.name, []);
      }
      map
        .get(table.name)
        ?.push({ fromTable: table.name, column: table.selfRef.column });
    }
  }

  return map;
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function getRelationshipName(column: string): string {
  // Remove _id suffix and convert to camelCase
  const name = column.replace(/_id$/, "");
  return snakeToCamel(name);
}

function getArrayRelationshipName(fromTable: string, column: string): string {
  // For array relationships, use plural form or table name
  if (column.endsWith("_id")) {
    // If column is like "customer_id", the relationship is already named by the table
    return snakeToCamel(fromTable);
  }
  return snakeToCamel(fromTable);
}

interface TableYaml {
  table: { name: string; schema: string };
  object_relationships?: Array<{
    name: string;
    using: { foreign_key_constraint_on: string };
  }>;
  array_relationships?: Array<{
    name: string;
    using: {
      foreign_key_constraint_on: {
        column: string;
        table: { name: string; schema: string };
      };
    };
  }>;
}

async function main() {
  const metadataDir = join(import.meta.dirname, "..", "hasura", "metadata");
  const tablesDir = join(metadataDir, "databases", "default", "tables");

  await mkdir(tablesDir, { recursive: true });

  const reverseRels = buildReverseRelationships();
  const tableYamls: string[] = [];

  for (const table of TABLES) {
    const yaml: TableYaml = {
      table: { name: table.name, schema: "public" },
    };

    // Object relationships (foreign keys pointing outward)
    const objectRels: TableYaml["object_relationships"] = [];

    if (table.foreignKeys) {
      for (const fk of table.foreignKeys) {
        objectRels.push({
          name: getRelationshipName(fk.column),
          using: { foreign_key_constraint_on: fk.column },
        });
      }
    }

    if (table.selfRef) {
      objectRels.push({
        name: getRelationshipName(table.selfRef.column),
        using: { foreign_key_constraint_on: table.selfRef.column },
      });
    }

    if (objectRels.length > 0) {
      yaml.object_relationships = objectRels;
    }

    // Array relationships (foreign keys pointing inward)
    const arrayRels: TableYaml["array_relationships"] = [];
    const incomingRels = reverseRels.get(table.name) || [];

    for (const rel of incomingRels) {
      // Skip self-referential that's already handled as object relationship
      if (rel.fromTable === table.name) {
        // Add children relationship for self-ref
        arrayRels.push({
          name: "children",
          using: {
            foreign_key_constraint_on: {
              column: rel.column,
              table: { name: rel.fromTable, schema: "public" },
            },
          },
        });
      } else {
        arrayRels.push({
          name: getArrayRelationshipName(rel.fromTable, rel.column),
          using: {
            foreign_key_constraint_on: {
              column: rel.column,
              table: { name: rel.fromTable, schema: "public" },
            },
          },
        });
      }
    }

    if (arrayRels.length > 0) {
      yaml.array_relationships = arrayRels;
    }

    // Convert to YAML string
    tableYamls.push(toYaml(yaml));

    // Write individual table file
    await writeFile(join(tablesDir, `public_${table.name}.yaml`), toYaml(yaml));
  }

  // Write tables.yaml index
  const tablesIndex = TABLES.map(
    (t) => `- "!include public_${t.name}.yaml"`
  ).join("\n");
  await writeFile(join(tablesDir, "tables.yaml"), `${tablesIndex}\n`);

  // Write version.yaml
  await writeFile(join(metadataDir, "version.yaml"), "version: 3\n");

  // Write databases.yaml
  const databasesYaml = `- name: default
  kind: postgres
  configuration:
    connection_info:
      database_url:
        from_env: HASURA_GRAPHQL_DATABASE_URL
      isolation_level: read-committed
      use_prepared_statements: false
  tables: "!include databases/default/tables/tables.yaml"
`;
  await writeFile(join(metadataDir, "databases.yaml"), databasesYaml);

  console.log(`Generated metadata for ${TABLES.length} tables`);
  console.log(`Metadata directory: ${metadataDir}`);
}

function toYaml(obj: TableYaml, indent = 0): string {
  const spaces = "  ".repeat(indent);
  const lines: string[] = [];

  // table
  lines.push(`${spaces}table:`);
  lines.push(`${spaces}  name: ${obj.table.name}`);
  lines.push(`${spaces}  schema: ${obj.table.schema}`);

  // object_relationships
  if (obj.object_relationships && obj.object_relationships.length > 0) {
    lines.push(`${spaces}object_relationships:`);
    for (const rel of obj.object_relationships) {
      lines.push(`${spaces}  - name: ${rel.name}`);
      lines.push(`${spaces}    using:`);
      lines.push(
        `${spaces}      foreign_key_constraint_on: ${rel.using.foreign_key_constraint_on}`
      );
    }
  }

  // array_relationships
  if (obj.array_relationships && obj.array_relationships.length > 0) {
    lines.push(`${spaces}array_relationships:`);
    for (const rel of obj.array_relationships) {
      lines.push(`${spaces}  - name: ${rel.name}`);
      lines.push(`${spaces}    using:`);
      lines.push(`${spaces}      foreign_key_constraint_on:`);
      lines.push(
        `${spaces}        column: ${rel.using.foreign_key_constraint_on.column}`
      );
      lines.push(`${spaces}        table:`);
      lines.push(
        `${spaces}          name: ${rel.using.foreign_key_constraint_on.table.name}`
      );
      lines.push(
        `${spaces}          schema: ${rel.using.foreign_key_constraint_on.table.schema}`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

main().catch(console.error);
