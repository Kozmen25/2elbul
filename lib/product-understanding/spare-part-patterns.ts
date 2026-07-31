import { SparePartPatternEntry } from "./types";

/**
 * Categorized spare part pattern registry.
 * Spare parts are replacement components — they have a compatible device
 * but are NOT accessories (they're functional replacement parts).
 *
 * NOTE: All patterns use ASCII equivalents of Turkish characters because
 * normalizeProductTitle() converts Turkish chars (ş→s, ı→i, ç→c, ü→u, ö→o, ğ→g)
 * before pattern matching runs.
 */
export const SPARE_PART_PATTERNS: SparePartPatternEntry[] = [
  {
    type: "screen",
    patterns: [
      /ekran\s*(?:degisim|takim|yedek|orijinal|yenileme)/i,
      /lcd\s*(?:screen|ekran|panel)?/i,
      /dokunmatik\s*(?:ekran|panel)/i,
      /touch\s*(?:screen|panel|lcd)/i,
      /cam\s*(?:on\s*)?(?:cam|panel)/i,
      /screen\s*(?:replacement|assembly)/i,
    ],
    baseConfidence: 85,
    expectedCategory: null,
  },
  {
    type: "battery",
    patterns: [
      /batarya/i,
      /\bpil\b/i,
      /\bbattery\b/i,
      /batarya\s*(?:degisim|takim|yedek)/i,
      /pil\s*(?:degisim|takim|yedek)/i,
    ],
    baseConfidence: 80,
    expectedCategory: null,
  },
  {
    type: "charging_port",
    patterns: [
      /sarj\s*(?:yuvasi|portu|girisi|soketi)/i,
      /charging\s*port/i,
      /usb\s*port/i,
      /charge\s*port/i,
      /sarj\s*anakart/i,
    ],
    baseConfidence: 80,
    expectedCategory: null,
  },
  {
    type: "camera_module",
    patterns: [
      /kamera\s*(?:modulu|takimi|lensi|unitesi)/i,
      /camera\s*(?:module|lens)/i,
      /arka\s*kamera/i,
      /on\s*kamera/i,
    ],
    baseConfidence: 75,
    expectedCategory: null,
  },
  {
    type: "speaker",
    patterns: [
      /hoparlor/i,
      /\bspeaker\b/i,
      /ses\s*(?:modulu|karti|hoparloru)/i,
      /ic\s*hoparlor/i,
      /mikrofon\s*(?:karti|flex|modul)/i,
    ],
    baseConfidence: 75,
    expectedCategory: null,
  },
  {
    type: "button",
    patterns: [
      /buton/i,
      /\bbutton\b/i,
      /anahtar\s*(?:takimi|flexi)/i,
      /power\s*(?:button|flex)/i,
      /volume\s*(?:button|flex)/i,
      /home\s*(?:button|flex)/i,
      /flex\s*(?:kablo|kablosu)/i,
      /kumanda\s*(?:karti|flex)/i,
    ],
    baseConfidence: 70,
    expectedCategory: null,
  },
  {
    type: "connector_flex",
    patterns: [
      /anten\s*(?:kablosu|flex)/i,
      /sarj\s*flex/i,
      /flex\s*(?:kablo|kablosu|baglanti)/i,
      /baglanti\s*(?:kablosu|flex)/i,
      /ribbon\s*cable/i,
    ],
    baseConfidence: 65,
    expectedCategory: null,
  },
];

/**
 * All terms that should be stripped from titles when extracting
 * the compatible device from a spare part listing.
 *
 * Returns ASCII-only terms (Turkish chars converted) matching the
 * output of normalizeProductTitle with normalizeUnicode: true.
 */
export function getAllSparePartRemoveTerms(): string[] {
  return [
    "ekran degisim", "ekran takim", "ekran yedek", "lcd",
    "dokunmatik", "touch screen", "batarya", "pil",
    "sarj yuvasi", "sarj portu", "sarj girisi",
    "kamera modulu", "kamera takimi", "hoparlor",
    "buton", "flex", "anahtar takimi",
  ];
}

/**
 * Category names that signal spare parts.
 */
export const SPARE_PART_CATEGORIES = new Set([
  "yedek parca",
  "spare part",
  "tamir",
  "repair",
  "parca",
]);
