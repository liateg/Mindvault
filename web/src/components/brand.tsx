import { Link } from "react-router-dom";
import { clsx } from "clsx";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={clsx("brand-mark", className)} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <rect
          x="3.5"
          y="7"
          width="13.5"
          height="19"
          rx="3.2"
          fill="#FF4D00"
          transform="rotate(-18 10.25 16.5)"
        />
        <rect
          x="15"
          y="5.5"
          width="13.5"
          height="19"
          rx="3.2"
          fill="#FF6A2A"
          transform="rotate(18 21.75 15)"
        />
      </svg>
    </span>
  );
}

export function BrandLink({
  to = "/",
  className,
}: {
  to?: string;
  className?: string;
}) {
  return (
    <Link className={clsx("brand-link", className)} to={to}>
      <BrandMark />
      Mindvault
    </Link>
  );
}
