import { escapeHtml, isTemplateName, renderTemplate, textFromHtml } from "./templates";

describe("templates", () => {
  it("renders the welcome email in text and html", () => {
    const mail = renderTemplate("welcome", {
      appName: "KanFun",
      appUrl: "http://localhost:5173",
      name: "Alice",
    });
    expect(mail.subject).toBe("Welcome to KanFun");
    expect(mail.text).toContain("Hi Alice,");
    expect(mail.html).toContain('href="http://localhost:5173"');
  });

  it("escapes user-provided content in html", () => {
    const mail = renderTemplate("notification", {
      appName: "A",
      appUrl: "http://x",
      title: "<b>Hi</b>",
      message: "1 < 2",
    });
    expect(mail.html).toContain("&lt;b&gt;Hi&lt;/b&gt;");
    expect(mail.html).toContain("1 &lt; 2");
    expect(mail.text).toBe("1 < 2");
  });

  it("validates template data", () => {
    expect(() => renderTemplate("welcome", { appName: "" })).toThrow();
    expect(isTemplateName("welcome")).toBe(true);
    expect(isTemplateName("toString")).toBe(false);
  });

  it("escapeHtml handles all special characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });

  it("renders the welcome email in German when asked", () => {
    const mail = renderTemplate("welcome", {
      appName: "KanFun",
      appUrl: "http://x",
      name: "Alice",
      locale: "de",
    });
    expect(mail.subject).toBe("Willkommen bei KanFun");
    expect(mail.text).toContain("Hallo Alice,");
    expect(() => renderTemplate("welcome", { appName: "A", appUrl: "x", locale: "fr" })).toThrow();
  });
});

describe("textFromHtml", () => {
  it("keeps the words and the links, drops tags and styles", () => {
    const html =
      '<style>p{color:red}</style><h1>Hi &amp; bye</h1><p>Open <a href="http://x/a">this</a>.</p><br><p>Done</p>';
    expect(textFromHtml(html)).toBe("Hi & bye\nOpen this (http://x/a).\n\nDone");
  });
});
