import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, fill = "none", stroke = "currentColor", ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    />
  );
}

export const Icon = {
  home: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </Svg>
  ),
  pie: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3v9l7.5 4.3" />
      <circle cx="12" cy="12" r="9" />
    </Svg>
  ),
  activity: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </Svg>
  ),
  search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  ),
  check: (p: IconProps) => (
    <Svg strokeWidth={2.6} {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  ),
  x: (p: IconProps) => (
    <Svg {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  ),
  chevron: (p: IconProps) => (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  ),
  sparkle: (p: IconProps) => (
    <Svg fill="currentColor" stroke="none" {...p}>
      <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16l-1.9-5.1L4.5 9l5.6-1.4z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
    </Svg>
  ),
  trendUp: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </Svg>
  ),
  house: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </Svg>
  ),
  target: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </Svg>
  ),
  clock: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  ),
  alert: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17v.01" />
    </Svg>
  ),
  offer: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-7-7A2 2 0 013 12.2V5a2 2 0 012-2h7.2a2 2 0 011.4.6l7 7a2 2 0 010 2.8z" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
    </Svg>
  ),
  mail: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </Svg>
  ),
  image: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </Svg>
  ),
  spinner: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Svg>
  ),
  play: (p: IconProps) => (
    <Svg fill="currentColor" stroke="none" {...p}>
      <path d="M7 4.5v15l13-7.5z" />
    </Svg>
  ),
  stop: (p: IconProps) => (
    <Svg fill="currentColor" stroke="none" {...p}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </Svg>
  ),
  retry: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 12a9 9 0 1 1 3 6.7" />
      <path d="M3 21v-6h6" />
    </Svg>
  ),
  eye: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  eyeOff: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.4 4.4M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.4-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  ),
  trash: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  ),
  copy: (p: IconProps) => (
    <Svg {...p}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  ),
  share: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.6 15.4 6.4M8.6 13.4l6.8 4.2" />
    </Svg>
  ),
  heart: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 20.5s-7.5-4.6-9.8-9A5.3 5.3 0 0 1 12 6.2 5.3 5.3 0 0 1 21.8 11.5c-2.3 4.4-9.8 9-9.8 9Z" />
    </Svg>
  ),
  tag: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12.6 2.6 21 11l-9.5 9.5a2 2 0 0 1-2.8 0L2.6 14.4a2 2 0 0 1 0-2.8L11 3.1a2 2 0 0 1 1.6-.5Z" />
      <circle cx="15.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
    </Svg>
  ),
  percent: (p: IconProps) => (
    <Svg {...p}>
      <path d="M19 5 5 19" />
      <circle cx="6.5" cy="6.5" r="2.3" />
      <circle cx="17.5" cy="17.5" r="2.3" />
    </Svg>
  ),
  calendar: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </Svg>
  ),
  arrowRight: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  ),
  filter: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 5h16M7 12h10M10 19h4" />
    </Svg>
  ),
  shield: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3 5 6v6c0 4.6 3 7.5 7 9 4-1.5 7-4.4 7-9V6z" />
      <path d="m9.5 12 1.8 1.8L15 10" />
    </Svg>
  ),
  flame: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 22c4 0 7-2.7 7-6.7 0-3-1.8-4.8-3-6.8-.3 1.6-1.2 2.6-2 2.6.6-3.5-1-6-4-8-.3 2.4-1 3.8-2.5 5.4C6 10 5 12 5 14.7 5 19 8.5 22 12 22Z" />
    </Svg>
  ),
  store: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 9 4.5 3.5h15L21 9" />
      <path d="M4 9v11h16V9M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
    </Svg>
  ),
  gift: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="9" width="18" height="12" rx="1" />
      <path d="M3 9h18v4H3zM12 9v12M12 9C9 9 8 7.5 8 6a2.5 2.5 0 0 1 4-2c1.5 1.5 2 5 2 5s2.5-.5 4-2a2.5 2.5 0 1 0-4-2c-1 1-2 3-2 3" />
    </Svg>
  ),
  grid: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </Svg>
  ),
  bell: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Svg>
  ),
  inbox: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 12h4.5l1.5 3h6l1.5-3H21" />
      <path d="M5 5h14l2 7v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z" />
    </Svg>
  ),
};
