# RAILWISE Norm Wiki Schema

This bundled library is a minimal demonstration corpus for M8-0. Production deployments should replace it with a project library generated from authorized source documents.

## Structure

- `raw/`: immutable MinerU or manually reviewed source markdown.
- `raw/manifest.jsonl`: append-only source ingestion manifest created before Wiki curation.
- `wiki/`: curated pages used by agents.
- `wiki/index.md`: navigation index.
- `wiki/log.md`: query and maintenance log.

## Citation Rule

All answers that rely on a standard clause must include `参照 [规范编号] 第 [章节号] 条`.

## Wiki Frontmatter

Ingested Wiki pages should include:

- `source_raw`: relative Raw markdown path.
- `norm_clause_id`: `<norm id> <clause id>` when the page claims a standard clause.
- `source_hash`: Raw text hash captured during ingest.
- `last_ingest_at`: ISO timestamp for the latest ingest.
- `supersededBy`: optional Wiki page path when a clause page is replaced by a newer page.

## Lint Rules

`tool_wiki_lint` checks traceability, index coverage, broken markdown links, projected wiki links, orphan pages, stale pages, and conflicting numeric claims for the same `norm_clause_id`. Project libraries should persist each run as `wiki/changes/lint-YYYY-MM-DD.md` for review.
