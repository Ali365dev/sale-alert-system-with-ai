import { useState } from "react";

import type { Category, CategoryInput } from "../api/categories";
import { useRegionStore } from "../store/regionStore";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "../api/categories";
import { useBrands, useUpdateBrand } from "../api/brands";
import { BrandLogo } from "../components/brands/BrandLogo";
import { Badge } from "../components/ui/Badge";
import { Icon } from "../components/icons";
import { Button, IconButton } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { DataTable, DataTableBody, DataTableEmpty, DataTableHead, DataTableRow } from "../components/ui/DataTable";
import { Label, TextArea, TextInput } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";

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

function BrandsInCategoryModal({ category, onClose }: { category: Category; onClose: () => void }) {
  const { data, isLoading } = useBrands(null);
  const updateBrand = useUpdateBrand();
  const [addQuery, setAddQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const allBrands = data?.brands ?? [];
  const inCategory = allBrands.filter((b) => b.categories.includes(category.name));
  const notInCategory = allBrands.filter((b) => !b.categories.includes(category.name));
  const filteredAdd = notInCategory.filter((b) =>
    b.name.toLowerCase().includes(addQuery.toLowerCase()),
  );

  const removeBrand = (brandId: number, currentCategories: string[]) => {
    updateBrand.mutate({
      id: brandId,
      input: { categories: currentCategories.filter((c) => c !== category.name) },
    });
  };

  const addBrand = (brandId: number, currentCategories: string[]) => {
    updateBrand.mutate({
      id: brandId,
      input: { categories: [...currentCategories, category.name] },
    });
    setAddQuery("");
    setAddOpen(false);
  };

  return (
    <Modal title={`Brands in "${category.name}"`} onClose={onClose}>
      {isLoading ? (
        <div style={{ color: "var(--text-muted)", padding: 16 }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Add brand search */}
          <div style={{ position: "relative" }}>
            <TextInput
              value={addQuery}
              onChange={(e) => { setAddQuery(e.target.value); setAddOpen(true); }}
              onFocus={() => setAddOpen(true)}
              placeholder="Add a brand to this category…"
              aria-label="Search brands to add"
            />
            {addOpen && addQuery && filteredAdd.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  maxHeight: 200,
                  overflowY: "auto",
                  background: "var(--surface-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {filteredAdd.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addBrand(b.id, b.categories)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "8px 12px",
                      border: "none",
                      background: "transparent",
                      textAlign: "left",
                      fontSize: 13,
                      color: "var(--text-body)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <BrandLogo name={b.name} logoUrl={b.logo_url} website={b.website} size={28} circle />
                    <span style={{ fontWeight: 600 }}>{b.name}</span>
                    {b.country && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{b.country}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Brand chips grid */}
          {inCategory.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
              No brands assigned yet. Search above to add one.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 10,
              }}
            >
              {inCategory.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 10px 10px",
                    background: "var(--surface-sunken)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    textAlign: "center",
                  }}
                >
                  <BrandLogo name={b.name} logoUrl={b.logo_url} website={b.website} size={44} circle />
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text-strong)", lineHeight: 1.2 }}>
                    {b.name}
                  </div>
                  {b.country && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{b.country}</div>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${b.name}`}
                    onClick={() => removeBrand(b.id, b.categories)}
                    style={{
                      marginTop: 2,
                      padding: "3px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "1px solid var(--danger)",
                      borderRadius: 999,
                      background: "transparent",
                      color: "var(--danger)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--danger)"; }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function CategoriesManager() {
  const region = useRegionStore((s) => s.region);
  const { data, isLoading, isError } = useCategories(true, region);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [statusTab, setStatusTab] = useState<"" | "active" | "inactive">("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewingBrands, setViewingBrands] = useState<Category | null>(null);

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
        <StatCard label="Total categories" value={categories.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="Inactive" value={categories.length - activeCount} />
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
        ) : (
          <DataTable
            label="Categories"
            columns="56px minmax(240px, 1fr) 64px 72px 72px 96px 168px"
            minWidth={880}
            align={{ 2: "right", 3: "right", 4: "right" }}
            stickyActions
          >
            <DataTableHead>
              <span>ID</span>
              <span>Name</span>
              <span>Order</span>
              <span>Brands</span>
              <span>Offers</span>
              <span>Status</span>
              <span>Actions</span>
            </DataTableHead>
            <DataTableBody>
              {filtered.length === 0 && <DataTableEmpty>No categories match your filters</DataTableEmpty>}
              {filtered.map((c) => (
                <DataTableRow key={c.id} muted={!c.is_active}>
                  <span className="dt-id">#{c.id}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="dt-strong dt-truncate">{c.name}</div>
                    <div className="dt-truncate dt-muted" style={{ fontSize: "0.75rem" }} title={c.description ?? undefined}>
                      {c.description || `Created ${formatDate(c.created_at)}`}
                    </div>
                  </div>
                  <span className="dt-num dt-muted">{c.sort_order}</span>
                  <span className={c.brand_count ? "dt-num" : "dt-num dt-faint"}>{c.brand_count}</span>
                  <span className={c.offer_count ? "dt-num" : "dt-num dt-faint"}>{c.offer_count}</span>
                  <Badge tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "Active" : "Inactive"}</Badge>
                  <span style={{ display: "flex", gap: 4 }}>
                    <IconButton icon={<Icon.store size={14} />} label={`View ${c.brand_count} brands`} variant="ghost" onClick={() => setViewingBrands(c)} />
                    <IconButton icon={<Icon.edit size={14} />} label="Edit category" variant="ghost" onClick={() => setEditing(c)} />
                    <IconButton
                      icon={<Icon.power size={14} />}
                      label={c.is_active ? "Disable category" : "Enable category"}
                      variant="ghost"
                      onClick={() => updateCategory.mutate({ id: c.id, input: { is_active: !c.is_active } })}
                    />
                    <IconButton
                      icon={<Icon.trash size={14} />}
                      label="Delete category"
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`Delete category "${c.name}"? Offers keep their category text.`)) {
                          deleteCategory.mutate(c.id);
                        }
                      }}
                    />
                  </span>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </Card>

      {adding && (
        <Modal title="Add category" onClose={() => setAdding(false)}>
          <CategoryForm
            submitting={createCategory.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={(input) =>
              createCategory.mutate(input, { onSuccess: () => setAdding(false) })
            }
          />
        </Modal>
      )}

      {viewingBrands && (
        <BrandsInCategoryModal category={viewingBrands} onClose={() => setViewingBrands(null)} />
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
                { onSuccess: () => setEditing(null) },
              )
            }
          />
        </Modal>
      )}
    </>
  );
}
