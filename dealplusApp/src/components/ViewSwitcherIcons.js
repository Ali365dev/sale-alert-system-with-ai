import Svg, { Path } from 'react-native-svg';

/** Exact list-view icon from design. */
export function ListViewIcon({ color = '#6B7C93', size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M3 3.33331H13C13.5519 3.33331 14 3.7814 14 4.33331V4.99998C14 5.55189 13.5519 5.99998 13 5.99998H3C2.44808 5.99998 2 5.55189 2 4.99998V4.33331C2 3.7814 2.44808 3.33331 3 3.33331V3.33331"
        fill="none"
        stroke={color}
        strokeWidth={1.46667}
      />
      <Path
        d="M3 10H13C13.5519 10 14 10.4481 14 11V11.6667C14 12.2186 13.5519 12.6667 13 12.6667H3C2.44808 12.6667 2 12.2186 2 11.6667V11C2 10.4481 2.44808 10 3 10V10"
        fill="none"
        stroke={color}
        strokeWidth={1.46667}
      />
    </Svg>
  );
}

/** Exact grid-view icon from design. */
export function GridViewIcon({ color = '#F20D38', size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M3 2H5.66667C6.21858 2 6.66667 2.44808 6.66667 3V5.66667C6.66667 6.21858 6.21858 6.66667 5.66667 6.66667H3C2.44808 6.66667 2 6.21858 2 5.66667V3C2 2.44808 2.44808 2 3 2V2"
        fill="none"
        stroke={color}
        strokeWidth={1.46667}
      />
      <Path
        d="M10.3333 2H13C13.5519 2 14 2.44808 14 3V5.66667C14 6.21858 13.5519 6.66667 13 6.66667H10.3333C9.7814 6.66667 9.33331 6.21858 9.33331 5.66667V3C9.33331 2.44808 9.7814 2 10.3333 2V2"
        fill="none"
        stroke={color}
        strokeWidth={1.46667}
      />
      <Path
        d="M3 9.33331H5.66667C6.21858 9.33331 6.66667 9.7814 6.66667 10.3333V13C6.66667 13.5519 6.21858 14 5.66667 14H3C2.44808 14 2 13.5519 2 13V10.3333C2 9.7814 2.44808 9.33331 3 9.33331V9.33331"
        fill="none"
        stroke={color}
        strokeWidth={1.46667}
      />
      <Path
        d="M10.3333 9.33331H13C13.5519 9.33331 14 9.7814 14 10.3333V13C14 13.5519 13.5519 14 13 14H10.3333C9.7814 14 9.33331 13.5519 9.33331 13V10.3333C9.33331 9.7814 9.7814 9.33331 10.3333 9.33331V9.33331"
        fill="none"
        stroke={color}
        strokeWidth={1.46667}
      />
    </Svg>
  );
}
