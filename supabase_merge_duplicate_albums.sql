-- Merge duplicate albums rows (same title + artist → one canonical row).
-- Root cause: multiple albums.id for the same release → logs/collections point at
-- a row with no cover_art_url while backfill updates a different row.
--
-- Canonical row per group: prefers a row that already has cover_art_url, else lowest id.
-- Run in Supabase SQL Editor. BACK UP first or run preview only.
--
-- PREVIEW ONLY (no writes): run section 1 and inspect counts.
-- FULL MERGE: run 1 → 6 in order.

-- =============================================================================
-- 1) PREVIEW: duplicate groups and how many rows would be merged
-- =============================================================================
-- SELECT lower(trim(title)) AS t, lower(trim(artist)) AS a,
--        count(*) AS row_count,
--        array_agg(id ORDER BY CASE WHEN cover_art_url IS NOT NULL AND trim(cover_art_url) <> '' THEN 0 ELSE 1 END, id) AS ids
-- FROM albums
-- GROUP BY 1, 2
-- HAVING count(*) > 1
-- ORDER BY count(*) DESC;

-- =============================================================================
-- 2) Build mapping: duplicate_id → canonical_id (run once)
-- =============================================================================
CREATE TEMP TABLE IF NOT EXISTS album_merge_map (
  duplicate_id uuid PRIMARY KEY,
  canonical_id uuid NOT NULL
);

TRUNCATE album_merge_map;

INSERT INTO album_merge_map (duplicate_id, canonical_id)
WITH ranked AS (
  SELECT
    id,
    lower(trim(title)) AS t,
    lower(trim(artist)) AS a,
    CASE WHEN cover_art_url IS NOT NULL AND trim(cover_art_url) <> '' THEN 0 ELSE 1 END AS sort_cover
  FROM albums
),
canonical_pick AS (
  SELECT DISTINCT ON (t, a)
    id AS canonical_id,
    t,
    a
  FROM ranked
  ORDER BY t, a, sort_cover, id
)
SELECT r.id, c.canonical_id
FROM ranked r
JOIN canonical_pick c ON r.t = c.t AND r.a = c.a
WHERE r.id <> c.canonical_id;

-- If empty, no duplicates to merge — stop here.
-- SELECT count(*) FROM album_merge_map;

-- =============================================================================
-- 3) Repoint all album_id FKs to canonical_id
-- =============================================================================

-- album_logs
UPDATE album_logs al
SET album_id = m.canonical_id
FROM album_merge_map m
WHERE al.album_id = m.duplicate_id;

-- collections
UPDATE collections c
SET album_id = m.canonical_id
FROM album_merge_map m
WHERE c.album_id = m.duplicate_id;

-- profile_favorites (if table uses album_id)
UPDATE profile_favorites pf
SET album_id = m.canonical_id
FROM album_merge_map m
WHERE pf.album_id = m.duplicate_id;

-- list_items
UPDATE list_items li
SET album_id = m.canonical_id
FROM album_merge_map m
WHERE li.album_id = m.duplicate_id;

-- listen_list
UPDATE listen_list ll
SET album_id = m.canonical_id
FROM album_merge_map m
WHERE ll.album_id = m.duplicate_id;

-- Add any other tables with album_id → albums(id) below, same pattern.

-- =============================================================================
-- 4) Deduplicate child rows that now violate unique constraints
-- =============================================================================

-- listen_list: unique(user_id, album_id) — keep one row per pair
DELETE FROM listen_list a
USING listen_list b
WHERE a.user_id = b.user_id
  AND a.album_id = b.album_id
  AND a.ctid > b.ctid;

-- collections: if unique(user_id, album_id) exists, dedupe
DELETE FROM collections a
USING collections b
WHERE a.user_id = b.user_id
  AND a.album_id = b.album_id
  AND a.ctid > b.ctid;

-- profile_favorites: often unique(user_id, position) — if two rows same position after merge, dedupe by position+user
-- If your schema differs, adjust or skip.
DELETE FROM profile_favorites a
USING profile_favorites b
WHERE a.user_id = b.user_id
  AND a.album_id = b.album_id
  AND a.ctid > b.ctid;

-- list_items: same list + same album twice — keep lowest id or position
DELETE FROM list_items a
USING list_items b
WHERE a.list_id = b.list_id
  AND a.album_id = b.album_id
  AND a.ctid > b.ctid;

-- =============================================================================
-- 5) Merge cover_art_url onto canonical if still empty
-- =============================================================================
UPDATE albums c
SET cover_art_url = s.cover_art_url
FROM (
  SELECT DISTINCT ON (canonical_id) canonical_id, cover_art_url
  FROM album_merge_map m
  JOIN albums a ON a.id = m.duplicate_id
  WHERE a.cover_art_url IS NOT NULL AND trim(a.cover_art_url) <> ''
  ORDER BY canonical_id, a.id
) s
WHERE c.id = s.canonical_id
  AND (c.cover_art_url IS NULL OR trim(c.cover_art_url) = '');

-- =============================================================================
-- 6) Delete duplicate album rows (no FKs should point at them now)
-- =============================================================================
DELETE FROM albums
WHERE id IN (SELECT duplicate_id FROM album_merge_map);

-- Optional: drop temp table (session ends anyway)
-- DROP TABLE album_merge_map;
