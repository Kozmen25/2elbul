// What a user wants to be told about, and where. Pure: the account page, the
// server action and the daily checks all read the same rules.

export const NOTIFICATION_KINDS = ["price_alert", "price_drop", "new_listing", "saved_search"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_CHANNELS = ["in_app", "email"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationSettings = Partial<Record<NotificationKind, Partial<Record<NotificationChannel, boolean>>>>;

/** Wording shown on the account page, in the order the kinds are listed there. */
export const NOTIFICATION_KIND_INFO: Record<NotificationKind, { label: string; description: string }> = {
  price_alert: {
    label: "Hedef fiyata ulaşıldı",
    description: "Fiyat alarmı kurduğun ürünün fiyatı belirlediğin tutarın altına düştüğünde.",
  },
  price_drop: {
    label: "Takip ettiğin ürünün fiyatı düştü",
    description: "Takip ettiğin ürünün en düşük fiyatı belirgin şekilde azaldığında.",
  },
  new_listing: {
    label: "Takip ettiğin üründe yeni ilan",
    description: "Takip ettiğin ürüne piyasa ortalamasının altında yeni bir ilan eklendiğinde.",
  },
  saved_search: {
    label: "Takip ettiğin aramaya yeni ilan",
    description: "Kaydettiğin bir aramayla eşleşen yeni ilan geldiğinde.",
  },
};

export type ResolvedChannels = { inApp: boolean; email: boolean };

function isKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

function isChannel(value: string): value is NotificationChannel {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

/**
 * Reads the stored JSON defensively: unknown kinds, unknown channels and
 * non-boolean values are dropped, so a bad row can never switch anything off
 * by accident.
 */
export function parseNotificationSettings(value: unknown): NotificationSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const settings: NotificationSettings = {};
  for (const [kind, channels] of Object.entries(value as Record<string, unknown>)) {
    if (!isKind(kind) || !channels || typeof channels !== "object" || Array.isArray(channels)) continue;
    const parsed: Partial<Record<NotificationChannel, boolean>> = {};
    for (const [channel, enabled] of Object.entries(channels as Record<string, unknown>)) {
      if (isChannel(channel) && typeof enabled === "boolean") parsed[channel] = enabled;
    }
    if (Object.keys(parsed).length > 0) settings[kind] = parsed;
  }
  return settings;
}

/**
 * Whether a notification of `kind` is stored in the app and/or e-mailed.
 * Missing means on. `emailMaster` is the account-wide e-mail switch: when it
 * is off, no kind is e-mailed whatever its own setting says.
 */
export function resolveChannels(
  kind: NotificationKind,
  settings: NotificationSettings,
  emailMaster: boolean,
): ResolvedChannels {
  const chosen = settings[kind] ?? {};
  return {
    inApp: chosen.in_app ?? true,
    email: emailMaster && (chosen.email ?? true),
  };
}

/** The full grid for the account page: every kind and channel with its current value. */
export function expandSettings(settings: NotificationSettings): Record<NotificationKind, Record<NotificationChannel, boolean>> {
  const grid = {} as Record<NotificationKind, Record<NotificationChannel, boolean>>;
  for (const kind of NOTIFICATION_KINDS) {
    grid[kind] = { in_app: settings[kind]?.in_app ?? true, email: settings[kind]?.email ?? true };
  }
  return grid;
}

/**
 * Validates what the account page sends and returns the compact JSON to
 * store (only values that differ from the default "on"). Null when the input
 * is not a complete, well-formed grid.
 */
export function compactSettings(input: unknown): NotificationSettings | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;

  const compact: NotificationSettings = {};
  for (const kind of NOTIFICATION_KINDS) {
    const channels = record[kind];
    if (!channels || typeof channels !== "object" || Array.isArray(channels)) return null;
    for (const channel of NOTIFICATION_CHANNELS) {
      const enabled = (channels as Record<string, unknown>)[channel];
      if (typeof enabled !== "boolean") return null;
      if (!enabled) compact[kind] = { ...compact[kind], [channel]: false };
    }
  }
  return compact;
}
