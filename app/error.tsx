"use client";

import { ErrorShell } from "@/components/error-shell";

export default function HomeError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorShell reset={reset} />;
}
