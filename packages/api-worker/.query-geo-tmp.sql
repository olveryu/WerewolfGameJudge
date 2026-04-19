SELECT id, display_name, is_anonymous, last_country, last_colo, created_at, updated_at
FROM users
WHERE created_at BETWEEN '2026-04-19T01:00:00' AND '2026-04-19T03:00:00'
   OR created_at BETWEEN '2026-04-19T09:00:00' AND '2026-04-19T11:00:00'
ORDER BY created_at DESC
LIMIT 30;
