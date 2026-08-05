import { useEffect, useState } from "react";

import { useBrands, type Brand } from "../../api/brands";
import { useEmail, useEmails } from "../../api/emails";
import { useOffers, type Offer } from "../../api/offers";
import {
  useDuplicatePrompt,
  usePrompts,
  useRestorePromptDefault,
  useTestPrompt,
  useUpdatePrompt,
  type Prompt,
} from "../../api/settings";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { Label, Select, TextArea, TextInput } from "../ui/Field";
import { LoadingState } from "../ui/Spinner";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function offerToTestBody(offer: Offer): string {
  return [
    `Brand: ${offer.brand ?? "—"}`,
    `Category: ${offer.category ?? "—"}${offer.subcategory ? ` / ${offer.subcategory}` : ""}`,
    `Type: ${offer.offer_type ?? "—"}`,
    offer.discount_percentage != null ? `Discount: ${offer.discount_percentage}%` : null,
    offer.coupon_code ? `Coupon code: ${offer.coupon_code}` : null,
    offer.expiry_date ? `Expiry: ${offer.expiry_date}` : null,
    offer.offer_value ? `Offer value: ${offer.offer_value}` : null,
    offer.website ? `Website: ${offer.website}` : null,
    offer.summary ? `Summary: ${offer.summary}` : null,
  ]
    .filter((line): line is string => !!line)
    .join("\n");
}

/** Loads real emails for the test-prompt picker; fills subject + body when one is selected. */
function EmailSamplePicker({ onSelect }: { onSelect: (subject: string, body: string) => void }) {
  const [emailId, setEmailId] = useState<number | "">("");
  const { data, isLoading } = useEmails({ page_size: 50, sort: "received_date", sort_dir: "desc" });
  const detail = useEmail(emailId === "" ? null : emailId);

  useEffect(() => {
    if (detail.data) onSelect(detail.data.subject, detail.data.body ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data]);

  return (
    <Select
      value={emailId}
      disabled={isLoading}
      onChange={(e) => setEmailId(e.target.value ? Number(e.target.value) : "")}
    >
      <option value="">{isLoading ? "Loading emails…" : "— Select a real email —"}</option>
      {data?.emails.map((e) => (
        <option key={e.id} value={e.id}>
          #{e.id} · {e.subject}
        </option>
      ))}
    </Select>
  );
}

/** Loads real offers for the test-prompt picker; fills the body field with a readable dump of the offer. */
function OfferSamplePicker({ onSelect }: { onSelect: (body: string) => void }) {
  const [offerId, setOfferId] = useState<number | "">("");
  const { data, isLoading } = useOffers({});
  const offer = data?.offers.find((o) => o.id === offerId);

  useEffect(() => {
    if (offer) onSelect(offerToTestBody(offer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer]);

  return (
    <Select
      value={offerId}
      disabled={isLoading}
      onChange={(e) => setOfferId(e.target.value ? Number(e.target.value) : "")}
    >
      <option value="">{isLoading ? "Loading offers…" : "— Select a real offer —"}</option>
      {data?.offers.map((o) => (
        <option key={o.id} value={o.id}>
          #{o.id} · {o.brand ?? "Unknown brand"} — {o.offer_type ?? "offer"}
        </option>
      ))}
    </Select>
  );
}

/** Loads real brands for the test-prompt picker; fills brand name/website/categories when one is selected. */
function BrandSamplePicker({ onSelect }: { onSelect: (brand: Brand) => void }) {
  const [brandId, setBrandId] = useState<number | "">("");
  const { data, isLoading } = useBrands();
  const brand = data?.brands.find((b) => b.id === brandId);

  useEffect(() => {
    if (brand) onSelect(brand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  return (
    <Select
      value={brandId}
      disabled={isLoading}
      onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : "")}
    >
      <option value="">{isLoading ? "Loading brands…" : "— Select a real brand —"}</option>
      {data?.brands.map((b) => (
        <option key={b.id} value={b.id}>
          #{b.id} · {b.name}
        </option>
      ))}
    </Select>
  );
}

function PromptEditor({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const [content, setContent] = useState(prompt.content);
  const [testSubject, setTestSubject] = useState("50% Off Everything — Summer Sale!");
  const [testBody, setTestBody] = useState("Shop now and save big on all items. Use code SUMMER50 at checkout. Offer ends July 31.");
  const [testBrandName, setTestBrandName] = useState("TestBrand");
  const [testWebsite, setTestWebsite] = useState("https://example.com");
  const [testCategories, setTestCategories] = useState("General");
  const [showTest, setShowTest] = useState(false);
  const isBrandResearch = prompt.category === "research";

  const update = useUpdatePrompt();
  const restore = useRestorePromptDefault();
  const duplicate = useDuplicatePrompt();
  const test = useTestPrompt();

  useEffect(() => setContent(prompt.content), [prompt.content]);

  const dirty = content !== prompt.content;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
      <TextArea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{ minHeight: 320, fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.5 }}
      />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button size="sm" loading={update.isPending} disabled={!dirty} onClick={() => update.mutate({ key: prompt.key, content })}>
          Save
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowTest((s) => !s)}>
          {showTest ? "Hide test" : "Test prompt"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={duplicate.isPending}
          onClick={() => duplicate.mutate(prompt.key)}
        >
          Duplicate
        </Button>
        <Button
          size="sm"
          variant="danger"
          loading={restore.isPending}
          disabled={content === prompt.default_content && !dirty}
          onClick={() => {
            if (window.confirm("Restore this prompt to its default text? Your edits will be lost.")) {
              restore.mutate(prompt.key);
            }
          }}
        >
          Restore default
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {showTest && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-muted)" }}>
            {isBrandResearch ? "Test with a sample brand" : "Test with a sample email"}
          </div>

          {isBrandResearch ? (
            <>
              <div>
                <Label>Load a real brand</Label>
                <BrandSamplePicker
                  onSelect={(brand) => {
                    setTestBrandName(brand.name);
                    setTestWebsite(brand.website ?? "");
                    setTestCategories(brand.categories.join(", ") || "General");
                  }}
                />
              </div>
              <div>
                <Label>Brand name</Label>
                <TextInput value={testBrandName} onChange={(e) => setTestBrandName(e.target.value)} />
              </div>
              <div>
                <Label>Website</Label>
                <TextInput value={testWebsite} onChange={(e) => setTestWebsite(e.target.value)} />
              </div>
              <div>
                <Label>Categories</Label>
                <TextInput value={testCategories} onChange={(e) => setTestCategories(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <div>
                  <Label>Load a real email</Label>
                  <EmailSamplePicker onSelect={(subject, body) => { setTestSubject(subject); setTestBody(body); }} />
                </div>
                <div>
                  <Label>Load a real offer</Label>
                  <OfferSamplePicker onSelect={(body) => setTestBody(body)} />
                </div>
              </div>
              <div>
                <Label>Subject</Label>
                <TextInput value={testSubject} onChange={(e) => setTestSubject(e.target.value)} />
              </div>
              <div>
                <Label>Body</Label>
                <TextArea value={testBody} onChange={(e) => setTestBody(e.target.value)} style={{ minHeight: 90 }} />
              </div>
            </>
          )}

          <div>
            <Button
              size="sm"
              loading={test.isPending}
              onClick={() =>
                test.mutate(
                  isBrandResearch
                    ? { key: prompt.key, subject: "", body: "", brand_name: testBrandName, website: testWebsite, categories: testCategories }
                    : { key: prompt.key, subject: testSubject, body: testBody },
                )
              }
            >
              Run
            </Button>
          </div>
          {test.data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <Label>Raw response</Label>
                <pre style={{ margin: 0, fontSize: 11.5, background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10, overflowX: "auto", whiteSpace: "pre-wrap" }}>
                  {test.data.raw_response ?? "(no response)"}
                </pre>
              </div>
              <div>
                <Label>Parsed JSON</Label>
                <pre style={{ margin: 0, fontSize: 11.5, background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10, overflowX: "auto" }}>
                  {test.data.parsed ? JSON.stringify(test.data.parsed, null, 2) : "(could not parse JSON from response)"}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PromptCard({ prompt }: { prompt: Prompt }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>{prompt.name}</span>
            {prompt.category && <Badge tone="neutral">{prompt.category}</Badge>}
            <Badge tone="brand">v{prompt.version}</Badge>
          </div>
          {prompt.description && <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>{prompt.description}</p>}
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Updated {formatDate(prompt.updated_at)}</span>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? "Collapse" : "Edit"}
        </Button>
      </div>
      {open && <PromptEditor prompt={prompt} onClose={() => setOpen(false)} />}
    </Card>
  );
}

export function PromptLibraryTab() {
  const [search, setSearch] = useState("");
  const { data: prompts, isLoading } = usePrompts();

  if (isLoading) return <LoadingState label="Loading prompts…" />;

  const filtered = (prompts ?? []).filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.key.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <CardHeader title="Prompt Library" />
        <TextInput placeholder="Search prompts…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>
      {filtered.map((p) => (
        <PromptCard key={p.key} prompt={p} />
      ))}
      {filtered.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No prompts match "{search}".</div>}
    </div>
  );
}
