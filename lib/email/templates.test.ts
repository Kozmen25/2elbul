import { describe, expect, it } from "vitest";
import { assertSafeUrl, escapeHtml, renderEmail, type EmailKind, type EmailTemplateData } from "./templates";

const LINK = "https://www.2elbul.com/auth/confirm?token_hash=abc&type=recovery";

describe("escapeHtml", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
    );
  });
});

describe("assertSafeUrl", () => {
  it("accepts http and https", () => {
    expect(assertSafeUrl("https://www.2elbul.com/x?a=1")).toBe("https://www.2elbul.com/x?a=1");
    expect(assertSafeUrl("http://localhost:3000/x")).toBe("http://localhost:3000/x");
  });

  it("rejects script, data and mail links and garbage", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,x", "mailto:a@b.com", "not a url", ""]) {
      expect(() => assertSafeUrl(value), value).toThrow();
    }
  });
});

describe("renderEmail", () => {
  const samples: { [K in EmailKind]: EmailTemplateData[K] } = {
    signup: { link: LINK },
    recovery: { link: LINK },
    magiclink: { link: LINK },
    invite: { link: LINK },
    reauthentication: { code: "123456" },
    price_alert: { productName: "iPhone 13", targetPrice: 20000, currentPrice: 19500, productUrl: "https://www.2elbul.com/product/iphone-13", settingsUrl: "https://www.2elbul.com/hesabim" },
    price_drop: { productName: "iPhone 13", previousPrice: 25000, currentPrice: 23000, dropPercent: 8, productUrl: "https://www.2elbul.com/product/iphone-13", settingsUrl: "https://www.2elbul.com/hesabim" },
    new_listing: { productName: "iPhone 13", price: 21000, belowMarketPercent: 12.5, productUrl: "https://www.2elbul.com/product/iphone-13", settingsUrl: "https://www.2elbul.com/hesabim" },
    saved_search: { query: "iphone 13", matchCount: 3, searchUrl: "https://www.2elbul.com/search?q=iphone+13", settingsUrl: "https://www.2elbul.com/hesabim" },
    test: { to: "admin@example.com" },
  };

  it.each(Object.keys(samples) as EmailKind[])("%s renders subject, html and text", (kind) => {
    const rendered = renderEmail(kind, samples[kind] as never);
    expect(rendered.subject).toMatch(/^2ElBul - /);
    expect(rendered.html).toContain("<html");
    expect(rendered.html).toContain("2ElBul");
    expect(rendered.text.length).toBeGreaterThan(20);
    expect(rendered.subject).not.toMatch(/[\r\n]/);
  });

  it("puts the link in both the html button and the plain text", () => {
    const rendered = renderEmail("recovery", { link: LINK });
    expect(rendered.html).toContain(escapeHtml(LINK));
    expect(rendered.text).toContain(LINK);
  });

  it("shows the one-time code for re-authentication", () => {
    const rendered = renderEmail("reauthentication", { code: "482913" });
    expect(rendered.html).toContain("482913");
    expect(rendered.text).toContain("482913");
  });

  it("formats prices in Turkish lira and mentions the drop", () => {
    const rendered = renderEmail("price_drop", samples.price_drop);
    expect(rendered.text).toContain("₺25.000");
    expect(rendered.text).toContain("₺23.000");
    expect(rendered.text).toContain("%8");
  });

  it("escapes product names so they cannot inject markup", () => {
    const rendered = renderEmail("price_alert", { ...samples.price_alert, productName: `<img src=x onerror=alert(1)>` });
    expect(rendered.html).not.toContain("<img src=x");
    expect(rendered.html).toContain("&lt;img src=x");
  });

  it("refuses unsafe links instead of emailing them", () => {
    expect(() => renderEmail("signup", { link: "javascript:alert(1)" })).toThrow();
    expect(() => renderEmail("price_alert", { ...samples.price_alert, productUrl: "data:text/html,x" })).toThrow();
  });

  it("words the saved-search mail for one and for several new listings", () => {
    expect(renderEmail("saved_search", { ...samples.saved_search, matchCount: 1 }).text).toContain("1 yeni ilan");
    expect(renderEmail("saved_search", samples.saved_search).text).toContain("3 yeni ilan");
  });

  it("escapes the saved-search query", () => {
    const rendered = renderEmail("saved_search", { ...samples.saved_search, query: `<b>x</b>` });
    expect(rendered.html).not.toContain("<b>x</b>");
  });

  it("includes an unsubscribe hint only in notification e-mails", () => {
    expect(renderEmail("price_alert", samples.price_alert).text).toContain("Hesabım");
    expect(renderEmail("recovery", { link: LINK }).text).not.toContain("almak istemiyorsan");
  });
});

describe("new_listing e-mail", () => {
  it("names the product, the price and how far below the market it is", () => {
    const rendered = renderEmail("new_listing", {
      productName: "iPhone 13",
      price: 21000,
      belowMarketPercent: 12.5,
      productUrl: "https://www.2elbul.com/product/iphone-13",
      settingsUrl: "https://www.2elbul.com/hesabim",
    });
    expect(rendered.subject).toBe("2ElBul - Yeni ilan: iPhone 13");
    expect(rendered.text).toContain("yeni bir ilan eklendi");
    expect(rendered.text).toContain("%12,5 altında");
  });

  it("leaves the market comparison out when it is not known", () => {
    const rendered = renderEmail("new_listing", {
      productName: "iPhone 13",
      price: 21000,
      belowMarketPercent: null,
      productUrl: "https://www.2elbul.com/product/iphone-13",
      settingsUrl: "https://www.2elbul.com/hesabim",
    });
    expect(rendered.text).not.toContain("Piyasa ortalamasının");
  });
});
