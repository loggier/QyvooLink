import type { ImgHTMLAttributes } from 'react';

export function EvolveLinkLogo(props: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src="https://qyvoo.vemontech.com/img/logo-2x1.png"
      alt="Qyvoo Logo"
      {...props}
    />
  );
}
