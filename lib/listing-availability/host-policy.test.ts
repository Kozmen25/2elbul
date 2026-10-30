import { describe, expect, it } from "vitest";
import { isPublicAddress } from "./fetch-page";
import { hostOf, isCheckableUrl } from "./host-policy";

describe("host policy", () => {
  it("skips sites that block automated checks or need a login", () => {
    expect(isCheckableUrl("https://www.sahibinden.com/ilan/123")).toBe(false);
    expect(isCheckableUrl("https://m.facebook.com/marketplace/item/1")).toBe(false);
    expect(isCheckableUrl("https://www.easycep.com/urun/1")).toBe(true);
  });

  it("only accepts http(s) links", () => {
    expect(isCheckableUrl("javascript:alert(1)")).toBe(false);
    expect(isCheckableUrl("ftp://example.com/x")).toBe(false);
    expect(hostOf("https://WWW.Getmobil.com/a")).toBe("getmobil.com");
  });
});

describe("isPublicAddress", () => {
  it("rejects loopback, private, link-local and metadata addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.5", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPublicAddress(address)).toBe(false);
    }
  });

  it("accepts public addresses", () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:4700::1111")).toBe(true);
  });
});
