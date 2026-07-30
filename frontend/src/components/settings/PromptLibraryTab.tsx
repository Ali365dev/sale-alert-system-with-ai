import { useEffect, useState } from "react";

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
import { Label, TextArea, TextInput } from "../ui/Field";
import { LoadingState } from "../ui/Spinner";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function PromptEditor({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const [content, setContent] = useState(prompt.content);
  const [testSubject, setTestSubject] = useState("50% Off Everything — Summer Sale!");
  const [testBody, setTestBody] = useState("Shop now and save big on all items. Use code SUMMER50 at checkout. Offer ends July 31.");
  const [showTest, setShowTest] = useState(false);

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
            Test with a sample email
          </div>
          <div>
            <Label>Subject</Label>
            <TextInput value={testSubject} onChange={(e) => setTestSubject(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <TextArea value={testBody} onChange={(e) => setTestBody(e.target.value)} style={{ minHeight: 90 }} />
          </div>
          <div>
            <Button
              size="sm"
              loading={test.isPending}
              onClick={() => test.mutate({ key: prompt.key, subject: testSubject, body: testBody })}
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
