"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { AdminActionResult } from "@/lib/admin-action-result";
import { showAdminToast } from "@/components/admin-toast";

/**
 * A form for an admin server action that answers with { ok, message }. The
 * answer is always shown (a failed save is no longer silent), the page is
 * refreshed on success, and a destructive action can ask for confirmation first.
 */
export function AdminActionForm({
  action,
  children,
  className,
  confirm,
  closeDetailsOnSuccess = false,
}: {
  action: (formData: FormData) => Promise<AdminActionResult>;
  children: React.ReactNode;
  className?: string;
  /** Shown in a confirmation dialog before the action runs. */
  confirm?: string;
  /** Closes the surrounding <details> (an edit dialog) once the action succeeded. */
  closeDetailsOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm && !window.confirm(confirm)) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await action(data);
      showAdminToast(result);
      if (!result.ok) return;
      if (closeDetailsOnSuccess) form.closest("details")?.removeAttribute("open");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
