# Code Quality Rules

## General principles

- **No over-engineering**: don't add abstractions, helpers, or features beyond what the task requires.
- **No speculative code**: no `# TODO`, future-proofing wrappers, or "we might need this later" logic.
- **No comments that describe what the code does** — well-named identifiers do that. Only comment WHY when it's non-obvious (a quirk, a workaround, a hidden constraint).
- **No dead code**: remove unused imports, variables, and functions rather than commenting them out.

---

## Python (FastAPI backend)

### File size
- Max ~500 lines per Python file. If a file exceeds this, split it before adding more code.
- Routers should only contain HTTP handler functions — move business logic into `services/`.

### SQLAlchemy sessions
- Always use `with get_session() as session:` — never call `session.close()` manually.
- Never return a SQLAlchemy ORM object from a session block — convert to dict or dataclass first.
- One session per request handler; do not open nested sessions.

### Job runner pattern
- New background jobs go in `<server>/jobs/<job_type>.py` and extend the base Job class.
- Register jobs in `<server>/job_registry.py`, not in `main.py` or service files.
- App server jobs only go in `app_server/job_registry.py`; scraper jobs only in `scraper_server/job_registry.py`.

### Settings and encryption
- All persistent settings go through `services/settings_service.py` (`get_setting` / `set_setting`).
- Never read/write settings directly from the database — always use the service.
- Sensitive values (API keys, tokens) are encrypted at rest — `SETTINGS_ENCRYPTION_KEY` must be set.

### AI providers
- All LLM calls go through `ai/_llm.py` (`call_llm`) — never import the provider SDK directly in routers or services.
- Provider selection is managed by `ai/providers.py` — do not hardcode model names in routers.

### Error responses
- Use `JSONResponse({"error": "<message>"}, status_code=...)` — not `HTTPException` — so the dashboard interceptor can read `data.error`.
- 401 responses must be `{"error": "not authenticated"}` (the dashboard's Axios interceptor matches this exact string).

### Imports order (Python)
1. Standard library
2. Third-party (`fastapi`, `sqlalchemy`, `apscheduler`, …)
3. Internal packages (`config`, `database`, `ai`, `services`, `core`)

---

## TypeScript / React (Dashboard)

### File size
- Max 300 lines per `.tsx`/`.ts` file. Split large components into sub-components in the same folder.
- Page files (`src/pages/*.tsx`) should contain only the page component — extract sub-components to `src/components/`.

### React Query
- Use `useQuery` + `useMutation` from React Query for all API calls — no bare `useEffect` for data fetching.
- After a mutation always call `queryClient.invalidateQueries(...)` — never mutate the cache directly.
- Use `isError` + `error` from React Query — don't wrap queries in try/catch.

### API calls
- All API calls go through hooks in `dashboard/src/api/*.ts` — don't call Axios directly from components except for one-off bulk operations.
- When a page component must call Axios directly, import the correct client (`apiClient` or `scraperClient`) — see server-routing rules.

### Imports order (TypeScript)
1. React
2. Third-party (`@tanstack/react-query`, `axios`, `react-router`, …)
3. Store imports (`../store/…`)
4. API hooks (`../api/…`)
5. Component imports (`../components/…`)
6. Types

### Error handling
- Only handle errors at system boundaries (API calls, user input).
- Show user-facing errors via `toast` from `../store/toastStore` — the Axios interceptor already calls `toast.error` for most failures, so don't double-toast.
- Don't add error handling for things that can't fail (pure utils, internal helpers).

### Accessibility
- Interactive elements must have accessible names: `aria-label` on icon-only buttons.
- Use semantic HTML: `<button>` for actions, `<a>` for navigation.
- Never `outline: none` without a visible replacement focus style.

### Security
- All env vars use `VITE_` prefix — never hardcode API keys or URLs.
- Never use `dangerouslySetInnerHTML` without sanitizing first.
