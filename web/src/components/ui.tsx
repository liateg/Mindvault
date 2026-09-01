import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { LoaderCircle } from "lucide-react";
import { clsx } from "clsx";
import type { DecisionStatus, InvitationStatus, ProjectRole } from "../lib/types";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "icon" && "size-10",
        variant === "primary" &&
          "bg-ember text-white shadow-[0_0_22px_var(--color-glow)] hover:bg-[var(--color-ember-bright)]",
        variant === "secondary" &&
          "border border-line bg-[var(--color-panel-raised)] text-ink hover:border-[var(--color-line-strong)]",
        variant === "ghost" && "text-muted hover:bg-white/5 hover:text-ink",
        variant === "danger" && "bg-[var(--color-danger)] text-white hover:brightness-110",
        className,
      )}
      {...props}
    />
  );
}

const fieldClass =
  "w-full rounded-[var(--radius-sm)] border border-line bg-black/20 px-3 text-sm text-ink placeholder:text-subtle transition hover:border-[var(--color-line-strong)] focus:border-ember focus:outline-none";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(fieldClass, "h-10", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(fieldClass, "min-h-32 py-2.5", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(fieldClass, "h-10", className)} {...props} />
  );
}

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
      {error ? <span className="block text-xs text-red-400">{error}</span> : null}
    </label>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("glass-panel rounded-[var(--radius-lg)]", className)}>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        tone === "neutral" && "border-line bg-white/5 text-muted",
        tone === "accent" && "border-orange-800/70 bg-orange-950/50 text-orange-300",
        tone === "success" && "border-emerald-800 bg-emerald-950/50 text-emerald-300",
        tone === "warning" && "border-amber-800 bg-amber-950/50 text-amber-300",
        tone === "danger" && "border-red-800 bg-red-950/50 text-red-300",
      )}
    >
      {children}
    </span>
  );
}

export function StatePanel({
  title,
  description,
  loading = false,
  action,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-line bg-black/10 p-8 text-center">
      {loading && <LoaderCircle className="mb-3 size-5 animate-spin text-ember" />}
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-sm text-orange-300">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function RoleBadge({ role }: { role: ProjectRole }) {
  return <Badge tone={role === "admin" ? "accent" : "neutral"}>{role}</Badge>;
}

export function DecisionBadge({ status }: { status: DecisionStatus }) {
  const tone =
    status === "approved"
      ? "success"
      : status === "rejected"
        ? "danger"
        : status === "proposed"
          ? "warning"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

export function InvitationBadge({ status }: { status: InvitationStatus }) {
  const tone =
    status === "accepted"
      ? "success"
      : status === "declined" || status === "revoked"
        ? "danger"
        : "warning";
  return <Badge tone={tone}>{status}</Badge>;
}
