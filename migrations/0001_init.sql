-- Lumin Vocab sync storage. Only hashed family ids and encrypted blobs.
CREATE TABLE IF NOT EXISTS families (
  fam TEXT PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  touched INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS records (
  fam TEXT NOT NULL,
  id TEXT NOT NULL,
  u INTEGER NOT NULL,
  d INTEGER NOT NULL DEFAULT 0,
  c TEXT NOT NULL,
  seq INTEGER NOT NULL,
  PRIMARY KEY (fam, id)
);
CREATE INDEX IF NOT EXISTS records_by_seq ON records (fam, seq);
