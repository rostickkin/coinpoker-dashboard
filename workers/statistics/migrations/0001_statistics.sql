-- Only counters, random browser IDs and short-lived event replay protection.
CREATE TABLE project_totals (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 total_visits INTEGER NOT NULL DEFAULT 0,
 unique_visitors INTEGER NOT NULL DEFAULT 0,
 databases_loaded INTEGER NOT NULL DEFAULT 0,
 hands_processed INTEGER NOT NULL DEFAULT 0,
 files_imported INTEGER NOT NULL DEFAULT 0,
 data_processed INTEGER NOT NULL DEFAULT 0,
 started_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
) STRICT;

INSERT INTO project_totals (id, started_at, updated_at)
VALUES (1, unixepoch() * 1000, unixepoch() * 1000);

CREATE TABLE visitors (visitor_id TEXT PRIMARY KEY) STRICT;

CREATE TABLE usage_events (
 event_id TEXT PRIMARY KEY,
 visitor_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('visit', 'import')),
 hands INTEGER NOT NULL CHECK (hands >= 0),
 files INTEGER NOT NULL CHECK (files >= 0),
 bytes INTEGER NOT NULL CHECK (bytes >= 0),
 occurred_at INTEGER NOT NULL,
 received_at INTEGER NOT NULL,
 payload_hash TEXT NOT NULL
) STRICT;
CREATE INDEX usage_events_received ON usage_events (received_at);

CREATE TRIGGER count_new_visitor AFTER INSERT ON visitors BEGIN
 UPDATE project_totals SET unique_visitors = unique_visitors + 1 WHERE id = 1;
END;

-- Only a new event fires this trigger. Retries cannot increment any counters.
CREATE TRIGGER count_new_event AFTER INSERT ON usage_events BEGIN
 INSERT INTO visitors (visitor_id) VALUES (NEW.visitor_id) ON CONFLICT DO NOTHING;
 UPDATE project_totals SET
  total_visits = total_visits + (NEW.kind = 'visit'),
  databases_loaded = databases_loaded + (NEW.kind = 'import'),
  hands_processed = hands_processed + NEW.hands,
  files_imported = files_imported + NEW.files,
  data_processed = data_processed + NEW.bytes,
  updated_at = MAX(updated_at, NEW.received_at)
 WHERE id = 1;
END;
