import { useState } from "react";

import { useFetchPreview, usePost, useSubmitPost, type SocialPlatform } from "../api/socialScraper";
import { PostReviewPanel } from "../components/socialScraper/PostReviewPanel";
import { ProcessingPanel } from "../components/jobs/ProcessingPanel";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { FieldGroup, Label, Select, TextArea, TextInput } from "../components/ui/Field";

/** Spec item 6, "Social Media Scraper Test": test a custom Facebook/Instagram
 * post URL without permanently tying it to a brand. "Scrape" only attempts a
 * best-effort public og: preview fetch for that ONE url (see
 * services/social_scraper/post_metadata_fetcher.py — never profile browsing)
 * — caption/image are always manually editable regardless of what it finds. */
export function SocialScraperTest() {
  const [platform, setPlatform] = useState<SocialPlatform>("facebook");
  const [postUrl, setPostUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [activePostId, setActivePostId] = useState<number | null>(null);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  const fetchPreview = useFetchPreview();
  const submit = useSubmitPost();
  const { data: post } = usePost(activePostId);

  function handleScrape() {
    if (!postUrl.trim()) return;
    fetchPreview.mutate(
      { platform, post_url: postUrl.trim() },
      {
        onSuccess: (result) => {
          if (result.caption) setCaption(result.caption);
          if (result.image_url) setImageUrl(result.image_url);
        },
      },
    );
  }

  function handleProcess() {
    if (!postUrl.trim()) return;
    submit.mutate(
      { platform, post_url: postUrl.trim(), caption: caption.trim() || undefined, image_url: imageUrl.trim() || undefined },
      { onSuccess: (data) => { setActivePostId(data.postId); setActiveJobId(data.jobId); } },
    );
  }

  function reset() {
    setActivePostId(null);
    setActiveJobId(null);
    setPostUrl("");
    setCaption("");
    setImageUrl("");
  }

  const isProcessing = post?.status === "pending" || post?.status === "processing";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
        Test a custom Facebook or Instagram link without permanently adding the account to the brand list.
      </p>

      {activePostId === null && (
        <Card>
          <CardHeader title="Test a Post" />
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 14 }}>
            <FieldGroup>
              <Label>Platform</Label>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform)}>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </Select>
            </FieldGroup>
            <FieldGroup>
              <Label>Post URL</Label>
              <div style={{ display: "flex", gap: 10 }}>
                <TextInput
                  placeholder="https://facebook.com/brand/posts/123..."
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                />
                <Button variant="secondary" loading={fetchPreview.isPending} disabled={!postUrl.trim()} onClick={handleScrape}>
                  Scrape
                </Button>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Best-effort auto-fill from the post's own public preview tags — often unavailable, especially on Instagram. Fill in below manually if it comes up empty.
              </span>
            </FieldGroup>
          </div>

          {fetchPreview.isSuccess && !fetchPreview.data.caption && !fetchPreview.data.image_url && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--amber-600)" }}>
              Couldn't auto-extract anything from that URL — paste the caption/image URL manually below.
            </p>
          )}

          <FieldGroup>
            <Label>Caption</Label>
            <TextArea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Post caption text…" />
          </FieldGroup>
          <FieldGroup>
            <Label>Image URL</Label>
            <TextInput value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </FieldGroup>

          <div>
            <Button loading={submit.isPending} disabled={!postUrl.trim()} onClick={handleProcess}>
              Process
            </Button>
          </div>
        </Card>
      )}

      {activePostId !== null && activeJobId !== null && isProcessing && <ProcessingPanel jobId={activeJobId} onDismiss={reset} />}

      {activePostId !== null && post && !isProcessing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <PostReviewPanel post={post} />
          <div>
            <Button variant="secondary" onClick={reset}>
              Test another post
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
