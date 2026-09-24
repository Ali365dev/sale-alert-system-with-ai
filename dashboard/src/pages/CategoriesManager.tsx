import { useState } from "react";

import type { Category, CategoryInput } from "../api/categories";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "../api/categories";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Label, TextArea, TextInput } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";
import { Icon } from "../components/icons";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function CategoryForm({
  initial,
  submitting,
  onCancel,
  onSubmit,
}: {
  initial?: Category;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: CategoryInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0));
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    const order = Number(sortOrder);
    if (!Number.isFinite(order)) {
      setError("Display order must be a number.");
      return;
    }
    setError(null);
    onSubmit({
      name: trimmed,
      description: description.trim() || null,
      sort_order: order,
      is_active: isActive,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && (
        <div style={{ padding: "10px 14px", background: "var(--danger-subtle)", color: "var(--danger)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
          {error}
        </div>
      )}
      <div>
        <Label>Category name *</Label>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fashion" />
      </div>
      <div>
        <Label>Description</Label>
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional short description" />
      </div>
      <div>
        <Label>Display order</Label>
        <TextInput value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} style={{ width: 18, height: 18 }} />
        <span style={{ fontSize: 13, color: "var(--text-body)" }}>Active (visible to users)</span>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button onClick={handleSubmit} loading={submitting}>
          {initial ? "Update category" : "Add category"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function CategoriesManager() {
  const { data, isLoading, isError } = useCategories(true);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [statusTab, setStatusTab] = useState<"" | "active" | "inactive">("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);

  if (isLoading) return <div style={{ color: "var(--text-muted)" }}>Loading categories…</div>;
  if (isError || !data) return <div style={{ color: "var(--danger)" }}>Failed to load categories.</div>;

  const categories = data.categories;
  const activeCount = categories.filter((c) => c.is_active).length;
  const byStatus = statusTab
    ? categories.filter((c) => (statusTab === "active" ? c.is_active : !c.is_active))
    : categories;
  const q = query.trim().toLowerCase();
  const filtered = q ? byStatus.filter((c) => c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q)) : byStatus;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard icon={<Icon.grid size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Total categories" value={categories.length} />
        <StatCard icon={<Icon.check size={17} />} iconColor="var(--success)" iconBg="var(--success-subtle)" label="Active" value={activeCount} />
        <StatCard icon={<Icon.x size={17} />} iconColor="var(--text-muted)" iconBg="var(--surface-sunken)" label="Inactive" value={categories.length - activeCount} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Tabs
          tabs={[
            { id: "", label: "All" },
            { id: "active", label: "Active" },
            { id: "inactive", label: "Inactive" },
          ]}
          active={statusTab}
          onChange={(id) => setStatusTab(id as "" | "active" | "inactive")}
        />
        <div style={{ flex: 1 }} />
        <Button onClick={() => setAdding(true)}>Add category</Button>
      </div>

      <Card>
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories…"
          aria-label="Search categories"
        />
        {(q || statusTab) && (
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {filtered.length} of {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          </span>
        )}
      </Card>

      <Card padded={false} style={{ overflow: "hidden" }}>
        {categories.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            No categories created yet. Add one to power onboarding and filters in the app.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>
            No categories match your filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 900 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "50px 1fr 80px 90px 90px 110px 200px",
                  gap: 12,
                  padding: "11px 20px",
                  background: "var(--surface-sunken)",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "var(--ls-wide)",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                <span>ID</span>
                <span>Name</span>
                <span>Order</span>
                <span>Brands</span>
                <span>Offers</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {filtered.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "50px 1fr 80px 90px 90px 110px 200px",
                    alignItems: "center",
                    gap: 12,
                    padding: "var(--row-pad) 20px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ font: "600 12px/1 var(--font-mono)", color: "var(--text-faint)" }}>#{c.id}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-strong)" }}>{c.name}</div>
                    {c.description ? (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{c.description}</div>
                    ) : null}
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>Created {formatDate(c.created_at)}</div>
                  </div>
                  <span style={{ font: "500 12px/1 var(--font-mono)" }}>{c.sort_order}</span>
                  <span>{c.brand_count}</span>
                  <span>{c.offer_count}</span>
                  <span>{c.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => updateCategory.mutate({ id: c.id, input: { is_active: !c.is_active } })}
                    >
                      {c.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`Delete category "${c.name}"? Offers keep their category text.`)) {
                          deleteCategory.mutate(c.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {adding && (
        <Modal title="Add category" onClose={() => setAdding(false)}>
          <CategoryForm
            submitting={createCategory.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={(input) =>
              createCategory.mutate(input, {
                onSuccess: () => setAdding(false),
                onError: (err: unknown) => {
                  const msg =
                    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                    "Failed to create category.";
                  window.alert(msg);
                },
              })
            }
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit category — ${editing.name}`} onClose={() => setEditing(null)}>
          <CategoryForm
            initial={editing}
            submitting={updateCategory.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(input) =>
              updateCategory.mutate(
                { id: editing.id, input },
                {
                  onSuccess: () => setEditing(null),
                  onError: (err: unknown) => {
                    const msg =
                      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                      "Failed to update category.";
                    window.alert(msg);
                  },
                },
              )
            }
          />
        </Modal>
      )}
    </>
  );
}
