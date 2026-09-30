import { pgTable, text, integer, timestamp, primaryKey, jsonb } from "drizzle-orm/pg-core";
import type { VoicedChord } from "@/lib/progression/voicing";

export const savedProgressions = pgTable("saved_progressions", {
    id: text("id").notNull(),
    userId: text("user_id").notNull(),
    chords: text("chords").array().notNull(),
    /**
     * Each chord with its notes. Stored in the `doc` column, which used to hold
     * a larger progression document; `readStoredChords` reads either shape,
     * and falls back to the symbols in `chords` (with no notes) for rows saved
     * before voicings existed.
     */
    voicings: jsonb("doc").$type<VoicedChord[]>(),
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
