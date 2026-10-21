import React, { forwardRef } from "react";
import { Link as RouterLink, UNSAFE_NavigationContext, type LinkProps as RouterLinkProps } from "react-router-dom";

export type LinkProps = Omit<RouterLinkProps, "to"> & {
  href: string;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ href, children, onNavigate, onClick, ...props }, ref) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onNavigate?.(e);
    onClick?.(e);
  };

  const navCtx = React.useContext(UNSAFE_NavigationContext);
  const isExternal = href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:");

  if (!navCtx || isExternal) {
    return (
      <a ref={ref} href={href} onClick={handleClick} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink ref={ref} to={href} onClick={handleClick} {...props}>
      {children}
    </RouterLink>
  );
});

Link.displayName = "Link";
export default Link;
