// Inline stroke icons — no icon dependency, no extra network requests.
// 20px grid, 1.6 stroke, currentColor so nav/copy states drive them.

type Props = { name: IconName; className?: string; size?: number };

export type IconName =
  | "command"
  | "radar"
  | "inbox"
  | "scissors"
  | "check"
  | "wallet"
  | "settings"
  | "menu"
  | "close"
  | "arrow"
  | "spark"
  | "upload"
  | "external"
  | "info"
  | "clock"
  | "play";

const paths: Record<IconName, React.ReactNode> = {
  command: (
    <>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </>
  ),
  radar: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3" />
      <path d="M10 10l5.2-5.2" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 11.5V15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5" />
      <path d="M3 11.5 3.9 5.6A2 2 0 0 1 5.9 4h8.2a2 2 0 0 1 2 1.6L17 11.5" />
      <path d="M3 11.5h4l.8 1.7h4.4l.8-1.7h4" />
    </>
  ),
  scissors: (
    <>
      <circle cx="5.5" cy="5.5" r="2.2" />
      <circle cx="5.5" cy="14.5" r="2.2" />
      <path d="M7.6 6.9 16 15M16 5 7.6 13.1" />
    </>
  ),
  check: (
    <>
      <path d="M4.5 10.5 8 14l7.5-8" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="5.5" width="14" height="10" rx="2.2" />
      <path d="M3 9h14" />
      <circle cx="13.4" cy="12.4" r="1" />
    </>
  ),
  settings: (
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.8v1.9M10 15.3v1.9M2.8 10h1.9M15.3 10h1.9M4.9 4.9l1.35 1.35M13.75 13.75 15.1 15.1M15.1 4.9l-1.35 1.35M6.25 13.75 4.9 15.1" />
    </>
  ),
  menu: <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />,
  close: <path d="M5 5l10 10M15 5 5 15" />,
  arrow: <path d="M4.5 10h11M11 5.5 15.5 10 11 14.5" />,
  spark: (
    <>
      <path d="M10 3v3.2M10 13.8V17M3 10h3.2M13.8 10H17" />
      <path d="M5.9 5.9 7.4 7.4M12.6 12.6l1.5 1.5M14.1 5.9l-1.5 1.5M7.4 12.6 5.9 14.1" />
    </>
  ),
  upload: (
    <>
      <path d="M10 13V4.5M6.8 7.5 10 4.3l3.2 3.2" />
      <path d="M4 12v2.6A1.4 1.4 0 0 0 5.4 16h9.2A1.4 1.4 0 0 0 16 14.6V12" />
    </>
  ),
  external: (
    <>
      <path d="M11.5 4.5H16V9" />
      <path d="M16 4.5 9.5 11" />
      <path d="M14 11.8v2.8A1.4 1.4 0 0 1 12.6 16H5.4A1.4 1.4 0 0 1 4 14.6V7.4A1.4 1.4 0 0 1 5.4 6h2.8" />
    </>
  ),
  info: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v4.4M10 6.6v.9" />
    </>
  ),
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.2V10l2.6 1.6" />
    </>
  ),
  play: <path d="M7.5 5.2 15 10l-7.5 4.8z" />,
};

export default function Icon({ name, className, size = 20 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.55}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
