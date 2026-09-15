CREATE TABLE `chess_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`white_token` text NOT NULL,
	`black_token` text,
	`game` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`pool` text NOT NULL,
	`last_request` text,
	`rematch` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
