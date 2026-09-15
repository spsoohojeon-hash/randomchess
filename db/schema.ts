import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("chess_rooms", {
  code: text("code").primaryKey(),
  whiteToken: text("white_token").notNull(),
  blackToken: text("black_token"),
  game: text("game").notNull(),
  version: integer("version").notNull().default(0),
  pool: text("pool").notNull(),
  lastRequest: text("last_request"),
  rematch: text("rematch").notNull().default("[]"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
