// Where a notification leads. One definition for the bell dropdown and the
// /bildirimler page.
//
// Notifications written before product follows only carry product_id; the
// product page also resolves a numeric id (getProductBySlug), so those keep
// working. There is no per-listing page, so a notification that only knows a
// listing falls back to the notifications page.

export type NotificationLinkInput = {
  type: string;
  metadata: Record<string, unknown> | null;
};

export function getNotificationLink({ type, metadata }: NotificationLinkInput, fallback: string): string {
  const slug = metadata?.product_slug;
  if (typeof slug === "string" && slug) return `/product/${encodeURIComponent(slug)}`;

  const productId = metadata?.product_id;
  if ((typeof productId === "number" || typeof productId === "string") && String(productId)) {
    return `/product/${encodeURIComponent(String(productId))}`;
  }

  const query = metadata?.query;
  if ((type === "saved_search" || type === "new_listing") && query) return `/search?q=${encodeURIComponent(String(query))}`;

  return fallback;
}
