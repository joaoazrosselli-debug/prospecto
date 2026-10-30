import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const discoveryBatches=sqliteTable('studio_discovery_batches',{
 id:text('id').primaryKey(),query:text('query').notNull(),results:text('results').notNull(),createdAt:text('created_at').notNull(),expiresAt:text('expires_at').notNull(),
},table=>[index('discovery_query_created').on(table.query,table.createdAt),index('discovery_expiry').on(table.expiresAt)]);
export const discoveryLimits=sqliteTable('studio_discovery_limits',{
 bucket:text('bucket').primaryKey(),count:integer('count').notNull(),expiresAt:text('expires_at').notNull(),
});
export const records = sqliteTable("studio_records", {
  key: text("key").primaryKey(), kind: text("kind").notNull(), data: text("data").notNull(),
  revision: integer("revision").notNull().default(1), updatedAt: text("updated_at").notNull(), updatedBy: text("updated_by").notNull(),
}, table => [index("records_kind").on(table.kind)]);
export const assets = sqliteTable("studio_assets", {
  id: text("id").primaryKey(),leadId: text("lead_id").notNull(),objectKey: text("object_key").notNull().unique(),
  name: text("name").notNull(),mime: text("mime").notNull(),size: integer("size").notNull(),
  role: text("role").notNull().default("gallery"),alt: text("alt").notNull().default(""),
  createdAt: text("created_at").notNull(),createdBy: text("created_by").notNull(),
}, table => [index("assets_lead").on(table.leadId)]);
export const members = sqliteTable("studio_members", {
  id:text("id").primaryKey(),name:text("name").notNull(),email:text("email").notNull(),lastSeen:text("last_seen").notNull(),
});
export const access = sqliteTable("studio_access", {
  email:text("email").primaryKey(),createdAt:text("created_at").notNull(),createdBy:text("created_by").notNull(),
});
export const codeDrafts=sqliteTable('studio_code_drafts',{
 leadId:text('lead_id').primaryKey(),files:text('files').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),
});
export const pageVersions=sqliteTable('studio_page_versions',{
 seq:integer('seq').primaryKey({autoIncrement:true}),id:text('id').notNull().unique(),leadId:text('lead_id').notNull(),kind:text('kind').notNull(),label:text('label').notNull(),files:text('files').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull(),
},table=>[index('page_versions_lead_seq').on(table.leadId,table.seq)]);
export const deliveryReviews=sqliteTable('studio_delivery_reviews',{
 seq:integer('seq').primaryKey({autoIncrement:true}),id:text('id').notNull().unique(),leadId:text('lead_id').notNull(),scope:text('scope').notNull(),fingerprint:text('fingerprint').notNull(),data:text('data').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull(),
},table=>[index('delivery_reviews_lead_scope_seq').on(table.leadId,table.scope,table.seq)]);
