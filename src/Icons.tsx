import type { SVGProps } from 'react';

type IconName = 'arrow' | 'copy' | 'check' | 'download' | 'github' | 'pen' | 'close' | 'info';
const paths: Record<IconName, React.ReactNode> = {
  arrow: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4" /></>,
  check: <path d="m5 12 4 4 10-10" />,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" /></>,
  github: <><path d="M9 19c-4 1-4-2-6-2m12 5v-4a3.5 3.5 0 0 0-1-2.7c3.3-.4 6.8-1.6 6.8-7.3a5.7 5.7 0 0 0-1.5-4A5.2 5.2 0 0 0 19.2.2S18 .1 15 1.7a13.6 13.6 0 0 0-7 0C5 .1 3.8.2 3.8.2a5.2 5.2 0 0 0-.1 3.8 5.7 5.7 0 0 0-1.5 4c0 5.7 3.5 6.9 6.8 7.3A3.5 3.5 0 0 0 8 18v4" transform="translate(1 1) scale(.9)" /></>,
  pen: <><path d="m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0L5 15l-1 5Z" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
