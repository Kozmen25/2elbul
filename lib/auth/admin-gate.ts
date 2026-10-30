// Decides access to /admin before any admin page renders.
//
// Admin pages are server components that load data with the service-role
// client. Next.js renders a layout and its page in parallel, so the layout's
// requireAdminUser() redirect alone does not stop the page from streaming its
// data (user e-mails, listings...) to an anonymous visitor. The middleware
// therefore enforces this gate first; the layout check stays as a second layer.

export type AdminAccess = "allow" | "login" | "forbidden";

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function decideAdminAccess(signedIn: boolean, isAdmin: boolean): AdminAccess {
  if (!signedIn) return "login";
  return isAdmin ? "allow" : "forbidden";
}

export function adminLoginPath(pathname: string, search: string): string {
  return `/giris?next=${encodeURIComponent(pathname + search)}`;
}
