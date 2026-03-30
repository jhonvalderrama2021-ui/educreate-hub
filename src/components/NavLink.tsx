import {
  NavLink as RouterNavLink,
  NavLinkProps,
  useLocation,
  useMatch,
  useResolvedPath,
} from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    const location = useLocation();
    const resolved = useResolvedPath(to);
    const match = useMatch({ path: resolved.pathname, end: props.end ?? false });
    const isActiveWithSearch = Boolean(match) && location.search === resolved.search;

    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isPending }) =>
          cn(className, isActiveWithSearch && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
