import type { LucideIcon } from "lucide-react";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff6b00]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  icon: Icon,
  note,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/7 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-black/45">{label}</p>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-4 truncate text-3xl font-black tracking-[-0.04em]">
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-black/40">{note}</p>}
    </div>
  );
}

export function AdminEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-black/45">
      {children}
    </div>
  );
}
