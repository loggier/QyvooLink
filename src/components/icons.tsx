import type { SVGProps } from 'react';

export function EvolveLinkLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 2.5a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0V5.5a.75.75 0 01.75-.75zm0 8.5a1 1 0 100 2 1 1 0 000-2zm-2.25-1.75a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}
