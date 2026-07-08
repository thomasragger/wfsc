-- Terminal state for a preview whose generation exhausted all retries, so the
-- UI can show an error + retry instead of spinning on preview_generating.
alter type book_status add value if not exists 'preview_failed';
