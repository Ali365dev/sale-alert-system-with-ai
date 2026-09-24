import { useState } from "react";

import { useBrands } from "../../api/brands";
import { BrandLogo as ConfiguredBrandLogo } from "../brands/BrandLogo";
import type { LogoTransform } from "../../lib/logoDisplay";

/** Public-site / list BrandLogo — looks up the brand by name when logoUrl is
 * not passed, then renders with the saved transform. */
export function BrandLogo({
  name,
  size = 44,
  circle = false,
  logoUrl,
  website,
  transform,
}: {
  name: string;
  size?: number;
  circle?: boolean;
  logoUrl?: string | null;
  website?: string | null;
  transform?: Partial<LogoTransform> | null;
}) {
  const { data } = useBrands();
  const brand = data?.brands.find((b) => b.name === name);
  return (
    <ConfiguredBrandLogo
      name={name}
      size={size}
      circle={circle}
      logoUrl={logoUrl ?? brand?.logo_url ?? null}
      website={website ?? brand?.website ?? null}
      transform={
        transform ??
        (brand
          ? {
              logo_scale: brand.logo_scale,
              logo_offset_x: brand.logo_offset_x,
              logo_offset_y: brand.logo_offset_y,
            }
          : null)
      }
    />
  );
}

/** Tiny loading placeholder used while brands query is in flight. */
export function BrandLogoPlaceholder({ size = 44 }: { size?: number }) {
  const [ready] = useState(true);
  if (!ready) return null;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--surface-sunken)",
        border: "1px solid var(--border)",
      }}
    />
  );
}
