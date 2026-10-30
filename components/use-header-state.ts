"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { HeaderState } from "@/app/api/header-state/route";

const GUEST_STATE: HeaderState = {
  userEmail: null,
  unreadCount: 0,
  displayName: null,
  avatarUrl: null,
};

// @supabase/ssr stores the session in cookies named `sb-<ref>-auth-token`
// (optionally chunked as `.0`, `.1`). Their absence means nobody is signed in,
// so visitors skip the request entirely.
const AUTH_COOKIE_MARKER = "-auth-token";

function hasAuthCookie(): boolean {
  return document.cookie.split("; ").some((cookie) => cookie.split("=")[0].includes(AUTH_COOKIE_MARKER));
}

export type HeaderAccount = HeaderState & {
  /** False until we know whether someone is signed in (first paint after load). */
  ready: boolean;
};

/**
 * Account details for the header, loaded after the page is already on screen
 * so that rendering a page never waits on (or varies by) the visitor.
 * Re-checked on every navigation: sign-in, sign-out and unread counts change
 * without the header remounting.
 */
export function useHeaderAccount(): HeaderAccount {
  const pathname = usePathname();
  const [state, setState] = useState<HeaderState>(GUEST_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasAuthCookie()) {
      setState(GUEST_STATE);
      setReady(true);
      return;
    }

    const controller = new AbortController();
    fetch("/api/header-state", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<HeaderState>) : GUEST_STATE))
      .then((next) => {
        setState(next);
        setReady(true);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === "AbortError") return;
        setState(GUEST_STATE);
        setReady(true);
      });

    return () => controller.abort();
  }, [pathname]);

  return { ...state, ready };
}
