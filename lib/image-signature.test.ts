import { describe, expect, it } from "vitest";
import { detectImageType, isLikelyImage } from "./image-signature";

const pad = (head: number[]) => Uint8Array.from([...head, ...new Array(16).fill(0)]);

describe("detectImageType", () => {
  it("recognises PNG, JPEG and WebP by content", () => {
    expect(detectImageType(pad([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe1]))).toBe("image/jpeg");
    expect(detectImageType(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });

  it("rejects other files, including scripts renamed to .jpg, and short input", () => {
    expect(detectImageType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(pad([0x47, 0x49, 0x46, 0x38]))).toBeNull(); // GIF
    expect(detectImageType(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull(); // WAV
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(isLikelyImage(new Uint8Array())).toBe(false);
  });
});
