import { useState } from "react";

import { useBrands, type Brand } from "../api/brands";
import { usePost, useScrapeHistory, useSubmitPost, type SocialPlatform } from "../api/socialScraper";
import { ProcessingPanel } from "../components/jobs/ProcessingPanel";
import { PostReviewPanel } from "../components/socialScraper/PostReviewPanel";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { FieldGroup, Label, TextArea, TextInput } from "../components/ui/Field";
import { LoadingState } from "../components/ui/Spinner";
import { Tabs } from "../components/ui/Tabs";

function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_TONE = { success: "success", failed: "danger", never_run: "neutral" } as const;

function SubmitPostForm({ brand, platform, onDone }: { brand: Brand; platform: SocialPlatform; onDone: (postId: number, jobId: number) => void }) {
  const [postUrl, setPostUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const submit = useSubmitPost();

  function handleSubmit() {
    if (!postUrl.trim()) return;
    submit.mutate(
      { platform, post_url: postUrl.trim(), caption: caption.trim() || undefined, image_url: imageUrl.trim() || undefined, brand_id: brand.id },
      { onSuccess: (data) => onDone(data.postId, data.jobId) },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)" }}>
      <FieldGroup>
        <Label>Post URL</Label>
        <TextInput value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder={`https://${platform}.com/...`} />
      </FieldGroup>
      <FieldGroup>
        <Label>Caption</Label>
        <TextArea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Paste what the post says…" />
      </FieldGroup>
      <FieldGroup>
        <Label>Image URL (optional)</Label>
        <TextInput value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
      </FieldGroup>
      <div>
        <Button size="sm" loading={submit.isPending} disabled={!postUrl.trim()} onClick={handleSubmit}>
          Submit Post
        </Button>
      </div>
    </div>
  );
}

function BrandSocialRow({ brand }: { brand: Brand }) {
  const facebookUrl = brand.social_links?.facebook;
  const instagramUrl = brand.social_links?.instagram;
  const { data: history } = useScrapeHistory(brand.id);
  const [openForm, setOpenForm] = useState<SocialPlatform | null>(null);
  const [activePostId, setActivePostId] = useState<number | null>(null);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const { data: post } = usePost(activePostId);

  const isProcessing = post?.status === "pending" || post?.status === "processing";

  function historyFor(platform: SocialPlatform) {
    return history?.find((h) => h.platform === platform);
  }

  function platformRow(platform: SocialPlatform, url: string) {
    const h = historyFor(platform);
    const PlatformIcon = Icon[platform];
    return (
      <div key={platform} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PlatformIcon size={16} />
          <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "var(--brand)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
            {url}
          </a>
          {h && <Badge tone={STATUS_TONE[h.status]}>{h.status}</Badge>}
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {h ? `${h.posts_checked} checked · ${h.offers_created} offers · last ${formatDateTime(h.last_scraped_at)}` : "Never scraped"}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setOpenForm(openForm === platform ? null : platform)} style={{ marginLeft: "auto" }}>
            Submit Post
          </Button>
        </div>
        {openForm === platform && (
          <SubmitPostForm
            brand={brand}
            platform={platform}
            onDone={(postId, jobId) => {
              setOpenForm(null);
              setActivePostId(postId);
              setActiveJobId(jobId);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader title={brand.name} />
      {facebookUrl && platformRow("facebook", facebookUrl)}
      {instagramUrl && platformRow("instagram", instagramUrl)}

      {activePostId !== null && activeJobId !== null && isProcessing && <ProcessingPanel jobId={activeJobId} onDismiss={() => setActivePostId(null)} />}
      {activePostId !== null && post && !isProcessing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PostReviewPanel post={post} />
          <div>
            <Button size="sm" variant="ghost" onClick={() => setActivePostId(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function SocialMediaTab() {
  const { data, isLoading } = useBrands();
  const brands = (data?.brands ?? []).filter((b) => b.social_links?.facebook || b.social_links?.instagram);

  if (isLoading) return <LoadingState />;
  if (brands.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        No brands have a Facebook or Instagram link configured yet — add one from the Brands Manager's edit form.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {brands.map((brand) => (
        <BrandSocialRow key={brand.id} brand={brand} />
      ))}
    </div>
  );
}

/** Room to grow: the source-type tabs here are the extension point for
 * future scraper types (e.g. a Website tab) without a new page each time. */
export function OfferDiscovery() {
  const [tab, setTab] = useState("social");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
        Submit posts for brands' configured social accounts and turn genuine offers into Offers. See scrape history per
        account below.
      </p>

      <Tabs tabs={[{ id: "social", label: "Social Media" }]} active={tab} onChange={setTab} />
      {tab === "social" && <SocialMediaTab />}
    </div>
  );
}
