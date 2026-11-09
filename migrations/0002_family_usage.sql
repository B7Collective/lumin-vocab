-- Track each family's record count and stored size, so limits are checked without scanning every record.
ALTER TABLE families ADD COLUMN n INTEGER NOT NULL DEFAULT 0;
ALTER TABLE families ADD COLUMN bytes INTEGER NOT NULL DEFAULT 0;
UPDATE families SET
  n = (SELECT COUNT(*) FROM records r WHERE r.fam = families.fam),
  bytes = (SELECT COALESCE(SUM(length(r.c)), 0) FROM records r WHERE r.fam = families.fam);
