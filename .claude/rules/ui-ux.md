# UI/UX Rules (Dashboard)

## Design system — use CSS variables, never raw values

The dashboard uses a dark-theme design system defined in `dashboard/src/index.css`. Always use CSS variables — never hardcode hex colors, font sizes in px, or spacing values.

### Color tokens

| Token | Usage |
|---|---|
| `--color-bg` | Page / app background |
| `--color-surface` | Cards, panels, modals |
| `--color-surface-raised` | Elevated cards, dropdowns |
| `--color-border` | Dividers, input borders |
| `--color-text` | Primary body text |
| `--color-text-muted` | Secondary text, labels, placeholders |
| `--color-accent` | Primary CTA, active states, links |
| `--color-accent-hover` | CTA hover |
| `--color-danger` | Destructive actions, error states |
| `--color-success` | Success states |
| `--color-warning` | Warning states |

- Never introduce new one-off colors — extend the token set if a new semantic color is needed.
- Status badge colors must use the existing `status-*` classes, not inline styles.

### Typography
- Use `rem` for font sizes — never `px`.
- Body: `1rem` base · `0.875rem` small labels · `0.8rem` captions/metadata.
- Headings: `clamp()` for responsive scale — never hardcode heading sizes.

### Spacing and layout
- Max content width: `1280px` with `margin-inline: auto`.
- Section padding: `clamp(24px, 4vw, 48px)`.
- Card padding: `clamp(12px, 2vw, 20px)`.
- Use `gap` for flex/grid spacing — never margin hacks between flex children.
- Always add `@media (max-width: 768px)` for layouts that change on mobile.

## Component conventions

### CSS files
- New CSS lives in a file beside the component: `EmailManager.css` imported in `EmailManager.tsx`.
- Do not add new styles to `src/index.css` — only global tokens, resets, and utility classes belong there.
- Before adding rules for an existing component, grep for duplicate selectors.

### Tables (data grids)
- Use the shared `<DataTable>` component — don't write raw `<table>` HTML in pages.
- Sortable columns use the existing sort icon pattern — don't invent new sort indicators.
- Pagination uses the shared `<Pagination>` component.

### Buttons
- Primary: `class="btn btn-primary"` — accent background, white text.
- Secondary / ghost: `class="btn btn-secondary"`.
- Destructive: `class="btn btn-danger"` — never use accent color for destructive actions.
- Disabled: `disabled` attribute + `opacity: 0.6; cursor: not-allowed` — do not change color.
- Icon-only buttons must have `aria-label`.

### Forms and inputs
- Use the shared `<Input>` / `<Select>` / `<Textarea>` components where they exist.
- Labels are always required — either wrapping or via `htmlFor`/`id`.
- Show validation errors inline below the field, not in a toast.

### Loading and empty states
- Use the shared `<Spinner>` for loading — never a raw CSS spinner.
- Empty states must have a message and, where applicable, a CTA to add the first item.
- Skeleton loaders preferred over spinners for list/table content.

### Toasts
- Success after a mutation: `toast.success("...")` — one toast per action.
- The Axios interceptor already fires `toast.error` on API failures — don't add a second toast in the mutation's `onError`.
- Toast messages are short (≤ 60 chars) and action-oriented ("Email deleted." not "The email has been successfully deleted.").

### Modals and dialogs
- Use `window.confirm` only for quick destructive confirmations — for complex flows, use the `<Dialog>` component.
- Always trap focus inside open modals.
- Close on Escape key and on backdrop click.

## Page structure

```
src/
  pages/         ← one file per route, thin — import from components/
  components/
    ui/           ← reusable primitives (Button, Input, Badge, Spinner, Table…)
    layout/       ← Sidebar, TopBar, PageHeader
    emails/       ← EmailManager sub-components
    brands/       ← BrandManager sub-components
    offers/       ← OffersManager sub-components
    scraper/      ← WebsiteScraper sub-components
  api/            ← one file per domain, React Query hooks only
  store/          ← Zustand stores (authStore, toastStore)
```

- Page files should not define sub-components longer than ~30 lines — extract them to `components/`.
- Do not import from `src/pages/` in other pages — pages are route-level only.
