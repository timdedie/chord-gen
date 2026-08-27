import { pgTable, text, integer, timestamp, primaryKey, jsonb } from "drizzle-orm/pg-core";
import type { ProgressionDoc } from "@/lib/progression/types";

export const savedProgressions = pgTable("saved_progressions", {
    id: text("id").notNull(),
    userId: text("user_id").notNull(),
    chords: text("chords").array().notNull(),
    /**
     * The full progression document — key, tempo, per-chord duration and
     * voicing. Null for rows saved before the editor existed; `normalizeDoc`
     * rebuilds one from `chords` in that case, so `chords` stays the
     * denormalised view and never goes away.
     */
    doc: jsonb("doc").$type<ProgressionDoc>(),
    style: text("style").notNull(),
    prompt: text("prompt").notNull().default(""),
    savedAt: timestamp("saved_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.id, t.userId] })]);

export const premiumGenerations = pgTable("premium_generations", {
    userId: text("user_id").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD, UTC
    count: integer("count").notNull().default(0),
    usedAt: timestamp("used_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.date] })]);

export const apiUsage = pgTable("api_usage", {
    ip: text("ip").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD, UTC
    count: integer("count").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.ip, t.date] })]);
