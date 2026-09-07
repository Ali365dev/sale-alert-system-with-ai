import { useEffect, useState } from "react";

import { useSaleFilter, useTestSaleFilter, useUpdateSaleFilter } from "../../api/settings";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { FieldGroup, Label, TextArea, TextInput } from "../ui/Field";
import { LoadingState } from "../ui/Spinner";

const STATUS_TONE = {
  eligible_for_analysis: "success",
  needs_review: "warning",
  not_sale_related: "neutral",
} as const;

const STATUS_LABEL = {
  eligible_for_analysis: "Eligible for analysis",
  needs_review: "Needs review",
  not_sale_related: "Not sale-related",
} as const;

function sameSet(a: string[], b: string[]) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function KeywordChip({ keyword, onRemove }: { keyword: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 6px 0 10px",
        borderRadius: "var(--radius-pill)",
        background: "var(--surface-sunken)",
        border: "1px solid var(--border)",
        fontSize: 12.5,
        color: "var(--text-body)",
      }}
    >
      {keyword}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${keyword}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          border: "none",
          borderRadius: "50%",
          background: "transparent",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </span>
  );
}

function KeywordListEditor({
  title,
  description,
  keywords,
  defaults,
  onChange,
}: {
  title: string;
  description: string;
  keywords: string[];
  defaults: string[];
  onChange: (next: string[]) => void;
}) {
  const [newKeyword, setNewKeyword] = useState("");

  function add() {
    const value = newKeyword.trim().toLowerCase();
    if (!value || keywords.includes(value)) {
      setNewKeyword("");
      return;
    }
    onChange([...keywords, value]);
    setNewKeyword("");
  }

  return (
    <Card>
      <CardHeader title={title} />
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>{description}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {keywords.length === 0 && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No keywords — add one below.</span>}
        {keywords.map((kw) => (
          <KeywordChip key={kw} keyword={kw} onRemove={() => onChange(keywords.filter((x) => x !== kw))} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, maxWidth: 360 }}>
        <TextInput
          placeholder="add a keyword or phrase…"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" onClick={add} disabled={!newKeyword.trim()}>
          Add
        </Button>
      </div>

      <div>
        <Button variant="ghost" onClick={() => onChange(defaults)} disabled={sameSet(keywords, defaults)}>
          Restore defaults
        </Button>
      </div>
    </Card>
  );
}

export function SaleFilterTab() {
  const { data, isLoading } = useSaleFilter();
  const update = useUpdateSaleFilter();
  const test = useTestSaleFilter();

  const [weakKeywords, setWeakKeywords] = useState<string[]>([]);
  const [strongKeywords, setStrongKeywords] = useState<string[]>([]);

  const [testSubject, setTestSubject] = useState("");
  const [testBody, setTestBody] = useState("");
  const [testOcr, setTestOcr] = useState("");

  useEffect(() => {
    if (data) {
      setWeakKeywords(data.weak_keywords);
      setStrongKeywords(data.strong_keywords);
    }
  }, [data]);

  if (isLoading || !data) return <LoadingState />;

  const dirty = !sameSet(weakKeywords, data.weak_keywords) || !sameSet(strongKeywords, data.strong_keywords);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KeywordListEditor
        title="Weak Sale Keywords"
        description={
          'Generic marketing words that corroborate a sale but never qualify an email on their own — a single hit here is never enough on its own to send an email to full AI analysis.'
        }
        keywords={weakKeywords}
        defaults={data.default_weak_keywords}
        onChange={setWeakKeywords}
      />

      <KeywordListEditor
        title="Strong Sale Keywords"
        description={
          'Specific phrases that are strong evidence of a real sale on their own (e.g. "flash sale", "black friday") — each match counts the same as a concrete discount pattern like "% off". Plain phrase matches only, not regex, so a typo here can never break scoring for every incoming email.'
        }
        keywords={strongKeywords}
        defaults={data.default_strong_keywords}
        onChange={setStrongKeywords}
      />

      <div>
        <Button
          loading={update.isPending}
          disabled={!dirty}
          onClick={() => update.mutate({ weak_keywords: weakKeywords, strong_keywords: strongKeywords })}
        >
          Save changes
        </Button>
      </div>

      <Card>
        <CardHeader title="Test Against Sample Content" />
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
          Runs the real filter — same code every incoming email goes through — against pasted content. No AI call,
          instant and free. Uses whatever keyword lists are above, whether saved yet or not.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          <FieldGroup>
            <Label>Subject</Label>
            <TextInput value={testSubject} onChange={(e) => setTestSubject(e.target.value)} placeholder="50% OFF Sitewide" />
          </FieldGroup>
          <FieldGroup>
            <Label>OCR text (optional)</Label>
            <TextInput value={testOcr} onChange={(e) => setTestOcr(e.target.value)} placeholder="text extracted from images" />
          </FieldGroup>
        </div>
        <FieldGroup>
          <Label>Body</Label>
          <TextArea value={testBody} onChange={(e) => setTestBody(e.target.value)} placeholder="Save big this weekend, use code SAVE20 at checkout." />
        </FieldGroup>

        <div>
          <Button
            variant="secondary"
            loading={test.isPending}
            disabled={!testSubject.trim() && !testBody.trim() && !testOcr.trim()}
            onClick={() => test.mutate({ subject: testSubject, body: testBody, ocr_text: testOcr })}
          >
            Run test
          </Button>
        </div>

        {test.data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Badge tone={STATUS_TONE[test.data.status]}>{STATUS_LABEL[test.data.status]}</Badge>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>score {test.data.score}</span>
            </div>
            <span style={{ fontSize: 12.5, color: "var(--text-body)" }}>{test.data.reason}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
