import { useCallback, useEffect, useRef, useState } from "react";

import type { Brand } from "../../api/brands";
import {
  clampLogoOffset,
  clampLogoScale,
  DEFAULT_LOGO_TRANSFORM,
  LOGO_OFFSET_MAX,
  LOGO_OFFSET_MIN,
  LOGO_SCALE_MAX,
  LOGO_SCALE_MIN,
  normalizeLogoTransform,
  type LogoTransform,
} from "../../lib/logoDisplay";
import { hostnameOf } from "../../lib/publicOffers";
import { BrandLogo, suggestedLogoUrl } from "./BrandLogo";
import { Button } from "../ui/Button";
import { Label } from "../ui/Field";
import { Modal } from "../ui/Modal";

const EDITOR_SIZE = 220;
const PREVIEW_SIZES = [52, 36, 28];

type Draft = LogoTransform & { logo_url: string };

function initialDraft(brand: Brand): Draft {
  return {
    // Prefer saved logo_url; otherwise seed with the same website favicon the
    // brands list already shows so "Manage logo" isn't blank for existing marks.
    logo_url: suggestedLogoUrl(brand.logo_url, brand.website),
    ...normalizeLogoTransform({
      logo_scale: brand.logo_scale,
      logo_offset_x: brand.logo_offset_x,
      logo_offset_y: brand.logo_offset_y,
    }),
  };
}

export function LogoEditorModal({
  brand,
  submitting,
  onClose,
  onSave,
}: {
  brand: Brand;
  submitting: boolean;
  onClose: () => void;
  onSave: (input: Draft & { reset_logo_transform?: boolean }) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(brand));
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const websiteHost = hostnameOf(brand.website ?? null);
  const faviconUrl = websiteHost
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(websiteHost)}&sz=128`
    : "";

  useEffect(() => {
    setDraft(initialDraft(brand));
  }, [brand]);

  const patch = (partial: Partial<Draft>) => setDraft((d) => ({ ...d, ...partial }));
  const hasUrl = Boolean(draft.logo_url.trim());

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!draft.logo_url.trim()) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        ox: draft.logo_offset_x,
        oy: draft.logo_offset_y,
      };
    },
    [draft.logo_offset_x, draft.logo_offset_y, draft.logo_url],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const rect = stage.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    patch({
      logo_offset_x: clampLogoOffset(drag.ox + dx),
      logo_offset_y: clampLogoOffset(drag.oy + dy),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const transform = {
    logo_scale: draft.logo_scale,
    logo_offset_x: draft.logo_offset_x,
    logo_offset_y: draft.logo_offset_y,
  };

  return (
    <Modal title={`Manage logo — ${brand.name}`} onClose={onClose} maxWidth={720}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
          Adjust zoom and position. The circular preview matches how the logo appears in the mobile app — the original
          image is never permanently cropped.
        </p>

        <div>
          <Label>Logo URL</Label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={draft.logo_url}
              onChange={(e) => patch({ logo_url: e.target.value })}
              placeholder="https://…"
              style={{
                flex: 1,
                height: 40,
                padding: "0 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--surface-card)",
                color: "var(--text-strong)",
                fontSize: 13,
              }}
            />
            {faviconUrl ? (
              <Button
                size="sm"
                variant="secondary"
                type="button"
                onClick={() => patch({ logo_url: faviconUrl })}
                disabled={draft.logo_url.trim() === faviconUrl}
              >
                Use website favicon
              </Button>
            ) : null}
          </div>
          {!brand.logo_url && hasUrl ? (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              No saved logo URL yet — seeded from the website favicon shown in the brands list. Save to keep it.
            </p>
          ) : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Original
            </span>
            <div
              style={{
                width: EDITOR_SIZE,
                height: EDITOR_SIZE,
                maxWidth: "100%",
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border)",
                background: "var(--surface-sunken)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {hasUrl ? (
                <img
                  key={draft.logo_url.trim()}
                  src={draft.logo_url.trim()}
                  alt=""
                  style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain" }}
                />
              ) : (
                <span style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", padding: 12 }}>
                  No logo URL — paste one or use the website favicon
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Edit (drag to pan)
            </span>
            <div
              ref={stageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                width: EDITOR_SIZE,
                height: EDITOR_SIZE,
                maxWidth: "100%",
                borderRadius: "50%",
                border: "2px solid var(--brand)",
                background: "#F3F4F6",
                overflow: "hidden",
                cursor: hasUrl ? "grab" : "not-allowed",
                touchAction: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BrandLogo
                name={brand.name}
                logoUrl={draft.logo_url.trim() || null}
                website={brand.website}
                size={EDITOR_SIZE - 4}
                circle
                strictUrl
                transform={transform}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              App preview
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", paddingTop: 12 }}>
              {PREVIEW_SIZES.map((s) => (
                <BrandLogo
                  key={`${s}-${draft.logo_url}`}
                  name={brand.name}
                  logoUrl={draft.logo_url.trim() || null}
                  website={brand.website}
                  size={s}
                  circle
                  strictUrl
                  transform={transform}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label>Zoom ({draft.logo_scale.toFixed(2)}×)</Label>
          <input
            type="range"
            min={LOGO_SCALE_MIN}
            max={LOGO_SCALE_MAX}
            step={0.01}
            value={draft.logo_scale}
            onChange={(e) => patch({ logo_scale: clampLogoScale(Number(e.target.value)) })}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <Label>Horizontal ({draft.logo_offset_x.toFixed(2)})</Label>
            <input
              type="range"
              min={LOGO_OFFSET_MIN}
              max={LOGO_OFFSET_MAX}
              step={0.01}
              value={draft.logo_offset_x}
              onChange={(e) => patch({ logo_offset_x: clampLogoOffset(Number(e.target.value)) })}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <Label>Vertical ({draft.logo_offset_y.toFixed(2)})</Label>
            <input
              type="range"
              min={LOGO_OFFSET_MIN}
              max={LOGO_OFFSET_MAX}
              step={0.01}
              value={draft.logo_offset_y}
              onChange={(e) => patch({ logo_offset_y: clampLogoOffset(Number(e.target.value)) })}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            onClick={() =>
              patch({
                logo_offset_x: DEFAULT_LOGO_TRANSFORM.logo_offset_x,
                logo_offset_y: DEFAULT_LOGO_TRANSFORM.logo_offset_y,
              })
            }
          >
            Center logo
          </Button>
          <Button variant="secondary" onClick={() => setDraft(initialDraft(brand))}>
            Reset
          </Button>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={submitting}
            disabled={!hasUrl}
            onClick={() =>
              onSave({
                logo_url: draft.logo_url.trim(),
                logo_scale: draft.logo_scale,
                logo_offset_x: draft.logo_offset_x,
                logo_offset_y: draft.logo_offset_y,
              })
            }
          >
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
