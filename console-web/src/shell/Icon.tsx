// Lightweight inline-SVG icon set — thin stroke, currentColor, no dependency.
// Replaces the emoji placeholders from the mockup with a clean linear style
// that matches the design reference. 24×24 viewBox, 1.6 stroke.

export type IconName =
  // top nav
  | "import"
  | "captions"
  | "analyze"
  | "style"
  | "spark"
  | "check"
  | "export"
  // left rail
  | "project"
  | "assets"
  | "scenes"
  | "library"
  | "plan"
  // canvas toolbar
  | "cursor"
  | "hand"
  | "zoom"
  // timeline
  | "eye"
  | "lock"
  | "skipBack"
  | "play"
  | "pause"
  | "skipFwd"
  // recommended cards
  | "star"
  | "title"
  | "annotate"
  | "compare"
  | "pip"
  | "chart"
  | "music"
  // misc
  | "hex"
  | "warn"
  | "search"
  | "settings";

const PATHS: Record<IconName, JSX.Element> = {
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19.7l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H2.6a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1A2 2 0 1 1 6.5 4.5l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 .9-1.4V2.6a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.4.9h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
  import: <path d="M12 4v9m0 0 3.5-3.5M12 13 8.5 9.5M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" />,
  captions: <><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M8 12h3M14 12h2M8 15h5" /></>,
  analyze: <><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></>,
  style: <><circle cx="12" cy="12" r="8" /><circle cx="9" cy="9" r="1" /><circle cx="15" cy="9" r="1" /><circle cx="15.5" cy="13.5" r="1" /></>,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  export: <path d="M12 16V7m0 0 3.5 3.5M12 7 8.5 10.5M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" />,
  project: <path d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />,
  assets: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4" /></>,
  scenes: <><rect x="4" y="8" width="16" height="11" rx="2" /><path d="m5 8 3-3 3 3M11 8l3-3 3 3" /></>,
  library: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
  plan: <path d="M5 6h14M5 10h14M5 14h9M5 18h9" />,
  cursor: <path d="m6 4 12 7-5 1.5L11 18z" />,
  hand: <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-.5V5.5a1.5 1.5 0 0 1 3 0V11m0-.5V7a1.5 1.5 0 0 1 3 0v7a5 5 0 0 1-5 5h-1a5 5 0 0 1-4-2l-2.5-3.5a1.4 1.4 0 0 1 2.2-1.7L8 13" />,
  zoom: <><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5M11 9v4M9 11h4" /></>,
  eye: <><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.5" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  skipBack: <path d="M17 6v12L9 12zM7 5v14" />,
  play: <path d="M8 5v14l11-7z" />,
  pause: <path d="M7 5h3v14H7zM14 5h3v14h-3z" />,
  skipFwd: <path d="M7 6v12l8-6zM17 5v14" />,
  star: <path d="m12 4 2.3 5.1 5.6.5-4.2 3.7 1.3 5.5L12 16.3 7 18.3l1.3-5.5L4.1 9.6l5.6-.5z" />,
  title: <><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M8 11h8M8 14h5" /></>,
  annotate: <><rect x="4" y="5" width="16" height="11" rx="2" /><path d="m9 20 3-4 3 4M14 9l3 3-3 0z" /></>,
  compare: <><rect x="4" y="6" width="7" height="12" rx="1" /><rect x="13" y="6" width="7" height="12" rx="1" /></>,
  pip: <><rect x="4" y="5" width="16" height="14" rx="2" /><rect x="12" y="12" width="6" height="5" rx="1" /></>,
  chart: <path d="M5 19V5M5 19h14M9 19v-6M13 19V9M17 19v-4" />,
  music: <path d="M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />,
  hex: <path d="M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3z" />,
  warn: <path d="M12 4 2.5 20h19zM12 10v4M12 17h.01" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
