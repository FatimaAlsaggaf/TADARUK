import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const branchesTable = pgTable("tadaruk_branches", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("restaurant-demo"),
  name: text("name").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull().default(""),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembersTable = pgTable("tadaruk_team_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("restaurant-demo"),
  name: text("name").notNull(),
  role: text("role").notNull(),
  initials: text("initials").notNull(),
  branchId: text("branch_id"),
  specialization: text("specialization"),
  available: boolean("available").notNull().default(true),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketsTable = pgTable("tadaruk_tickets", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("restaurant-demo"),
  number: text("number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull(),
  specialization: text("specialization").notNull(),
  location: text("location").notNull(),
  status: text("status").notNull().default("new"),
  reporterId: text("reporter_id").notNull(),
  branchId: text("branch_id").notNull(),
  technicianId: text("technician_id"),
  imageUrl: text("image_url"),
  repairNotes: text("repair_notes"),
  cause: text("cause"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketEventsTable = pgTable("tadaruk_ticket_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().default("restaurant-demo"),
  ticketId: text("ticket_id").notNull(),
  label: text("label").notNull(),
  actorId: text("actor_id").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BranchRecord = typeof branchesTable.$inferSelect;
export type TeamMemberRecord = typeof teamMembersTable.$inferSelect;
export type TicketRecord = typeof ticketsTable.$inferSelect;
export type TicketEventRecord = typeof ticketEventsTable.$inferSelect;

