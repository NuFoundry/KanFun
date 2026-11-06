import type { Page } from "@playwright/test";
import { expect, SEED, test } from "./fixtures";

// Without an AI key (and AI_PROVIDER not ollama) the service echoes the prompt and transcribes
// every voice message as "(echo) voice message", which makes this deterministic. With a key set,
// we only assert that some answer arrives.
const echo = !(
  process.env.AI_PROVIDER === "ollama" ||
  Boolean(
    process.env.MISTRAL_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
  )
);

/**
 * Stands in for the browser's speech recognition (the real one needs Google's service): it says
 * `words` one at a time as interim results and the whole sentence as the final one on stop, or
 * fails with `error` the way a browser without a service does.
 */
async function fakeSpeech(page: Page, script: { words?: string[]; error?: string }) {
  await page.addInitScript((script) => {
    type Handler = ((event: unknown) => void) | null;
    const results = (transcript: string, isFinal: boolean) => ({
      results: Object.assign([Object.assign([{ transcript }], { isFinal })], { length: 1 }),
    });
    class FakeRecognition {
      onresult: Handler = null;
      onerror: Handler = null;
      onend: (() => void) | null = null;
      timers: ReturnType<typeof setTimeout>[] = [];
      start() {
        const words = script.words ?? [];
        if (script.error) {
          this.timers.push(
            setTimeout(() => {
              this.onerror?.({ error: script.error });
              this.onend?.();
            }, 50),
          );
        }
        words.forEach((_, index) => {
          const said = words.slice(0, index + 1).join(" ");
          this.timers.push(setTimeout(() => this.onresult?.(results(said, false)), 150 * index));
        });
      }
      stop() {
        this.onresult?.(results((script.words ?? []).join(" "), true));
        this.onend?.();
      }
      abort() {
        this.timers.forEach(clearTimeout);
      }
    }
    Object.defineProperty(window, "SpeechRecognition", { value: FakeRecognition });
    Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined });
  }, script);
}

test.describe("assistant", () => {
  test("a conversation is saved, listed, reopened and deleted", async ({ authedPage: page }) => {
    await page.goto("/assistant");
    await expect(page.getByTestId("chat-empty")).toBeVisible();
    // The seeded conversation is already in the history.
    await expect(
      page.getByTestId("conversation-link").filter({ hasText: SEED.conversationTitle }),
    ).toBeVisible();
    const prompt = `ping ${Date.now()}`;
    await page.getByTestId("chat-input").fill(prompt);
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("chat-message-user")).toHaveText(prompt);
    const reply = page.getByTestId("chat-message-assistant");
    await expect(reply).toBeVisible({ timeout: 30_000 });
    if (echo) await expect(reply).toContainText(prompt);
    else await expect(reply).not.toBeEmpty();

    // Saved: it gets its own URL and shows up in the history, also after a reload.
    await expect(page).toHaveURL(/\/assistant\/\w+$/);
    const entry = page.getByTestId("conversation-link").filter({ hasText: prompt });
    await expect(entry).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("chat-message-user")).toHaveText(prompt);

    await page.getByTestId("new-chat").click();
    await expect(page.getByTestId("chat-empty")).toBeVisible();
    await entry.click();
    await expect(page.getByTestId("chat-message-user")).toHaveText(prompt);

    await entry
      .locator("xpath=..")
      .getByRole("button", { name: /Actions for/ })
      .click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByTestId("confirm-delete-conversation").click();
    await expect(page).toHaveURL(/\/assistant$/);
    await expect(entry).toHaveCount(0);
  });

  test("a reply never loads remote images", async ({ authedPage: page }) => {
    // The echo provider repeats the prompt, so the reply contains the image Markdown.
    test.skip(!echo, "needs the echo provider to control the reply");
    const leaks: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("pixel.png")) leaks.push(request.url());
    });
    await page.goto("/assistant");
    await page.getByTestId("chat-input").fill("![tracker](http://127.0.0.1:9/pixel.png?d=secret)");
    await page.getByTestId("chat-send").click();
    const reply = page.getByTestId("chat-message-assistant");
    await expect(reply).toContainText("tracker");
    await expect(reply.locator("img")).toHaveCount(0);
    expect(leaks).toEqual([]);
  });

  test("a reply renders tables, strikethrough, task lists and bare links", async ({
    authedPage: page,
  }) => {
    test.skip(!echo, "needs the echo provider to control the reply");
    await page.goto("/assistant");
    await page
      .getByTestId("chat-input")
      .fill(
        "Plans:\n\n| Plan | Price |\n| --- | ---: |\n| Pro | 9 |\n\n~~old~~ new\n\n- [x] done\n- [ ] open\n\nSee https://example.com",
      );
    await page.getByTestId("chat-send").click();
    const reply = page.getByTestId("chat-message-assistant");
    await expect(reply.locator("table th")).toHaveText(["Plan", "Price"]);
    await expect(reply.locator("td").last()).toHaveCSS("text-align", "right");
    await expect(reply.locator("del")).toHaveText("old");
    await expect(reply.getByRole("checkbox")).toHaveCount(2);
    await expect(reply.getByRole("checkbox").first()).toBeChecked();
    await expect(reply.getByRole("link", { name: "https://example.com" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
  });

  test("a reply renders maths, line breaks in table cells and a table sent as a code block", async ({
    authedPage: page,
  }) => {
    test.skip(!echo, "needs the echo provider to control the reply");
    await page.goto("/assistant");
    await page
      .getByTestId("chat-input")
      .fill(
        [
          "Area \\( \\pi r^2 \\), money $5 or $10.",
          "",
          "\\[ \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} \\]",
          "",
          "| Step | Detail |",
          "| --- | --- |",
          "| One | first<br>second |",
          "",
          "```markdown",
          "| Plan | Price |",
          "| --- | --- |",
          "| Pro | 9 |",
          "```",
        ].join("\n"),
      );
    await page.getByTestId("chat-send").click();
    const reply = page.getByTestId("chat-message-assistant");
    // KaTeX draws both formulas (loaded on demand); dollar amounts stay text.
    await expect(reply.locator(".katex")).toHaveCount(2);
    await expect(reply.locator(".katex-display")).toHaveCount(1);
    await expect(reply).toContainText("money $5 or $10.");
    await expect(reply.locator("td br")).toHaveCount(1);
    await expect(reply).not.toContainText("<br>");
    await expect(reply.locator("table")).toHaveCount(2);
    await expect(reply.locator("pre")).toHaveCount(0);
  });

  test("dictation puts the words into the message box while you speak", async ({
    authedPage: page,
  }) => {
    await fakeSpeech(page, { words: ["hello", "from", "dictation"] });
    await page.goto("/assistant");
    await page.getByTestId("voice-start").click();
    await expect(page.getByTestId("dictation-status")).toBeVisible();
    const input = page.getByTestId("chat-input");
    await expect(input).toHaveValue("hello from dictation");
    await page.getByTestId("dictation-stop").click();
    await expect(page.getByTestId("dictation-status")).toHaveCount(0);
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-message-user")).toHaveText("hello from dictation");
    await expect(page.getByTestId("chat-message-assistant")).toBeVisible({ timeout: 30_000 });
  });

  test("without a speech service, a voice message is transcribed into the message box", async ({
    authedPage: page,
    request,
  }) => {
    // Anthropic and Ollama have no speech to text; the mic is hidden unless Mistral or OpenAI
    // lends one (services/ai/src/env.ts). The only allowed kind of skip: a missing account.
    const health = (await (await request.get("/ai/health")).json()) as { transcription: boolean };
    test.skip(
      !health.transcription,
      "Set MISTRAL_API_KEY or OPENAI_API_KEY to test voice messages",
    );
    // The browser offers recognition but has no service behind it (Brave): it records instead.
    await fakeSpeech(page, { error: "network" });
    await page.goto("/assistant");
    await page.getByTestId("voice-start").click();
    await expect(page.getByTestId("voice-recorder")).toBeVisible();
    // At least a second of the fake microphone: under load a fixed wait could stop the
    // recorder before it delivered any audio (an empty recording is dropped silently).
    await expect(page.getByTestId("voice-recorder")).toContainText("0:01");
    await page.getByTestId("voice-confirm").click();
    const input = page.getByTestId("chat-input");
    if (echo) await expect(input).toHaveValue("(echo) voice message", { timeout: 15_000 });
    else await expect(input).not.toHaveValue("", { timeout: 30_000 });

    // Cancelling throws the recording away and leaves the text alone.
    await page.getByTestId("voice-start").click();
    await page.getByTestId("voice-cancel").click();
    await expect(page.getByTestId("voice-recorder")).toHaveCount(0);
    await expect(input).not.toHaveValue("");
  });

  test("attached files are read in the browser and go with the message", async ({
    authedPage: page,
    browser,
  }) => {
    // A PDF and a screenshot (wider than the 1568 px images are scaled to) made by Chromium.
    const maker = await browser.newPage({ viewport: { width: 2000, height: 1000 } });
    await maker.setContent("<h1>Quarterly report</h1><p>Revenue grew 12% this quarter.</p>");
    const pdf = await maker.pdf();
    const png = await maker.screenshot();
    await maker.close();

    await page.goto("/assistant");
    await page.getByTestId("attach-input").setInputFiles([
      { name: "report.pdf", mimeType: "application/pdf", buffer: pdf },
      { name: "chart.png", mimeType: "image/png", buffer: png },
      { name: "plans.csv", mimeType: "text/csv", buffer: Buffer.from("plan,price\nPro,9\n") },
    ]);
    const chips = page.getByTestId("composer-files").getByTestId("file-chip");
    await expect(chips).toHaveCount(3);
    await expect(chips.nth(1).locator("img")).toBeVisible();
    await page.getByTestId("chat-input").fill("Sum these up");
    await expect(page.getByTestId("chat-send")).toBeEnabled();
    await page.getByTestId("chat-send").click();

    const question = page.getByTestId("chat-message-user");
    await expect(question.getByTestId("file-chip")).toHaveCount(3);
    const reply = page.getByTestId("chat-message-assistant");
    if (echo) {
      // The echo provider repeats the start of each file it received.
      await expect(reply).toContainText("report.pdf:");
      await expect(reply).toContainText("Revenue grew 12%");
      await expect(reply).toContainText("chart.png: image");
      await expect(reply).toContainText("plans.csv: plan,price Pro,9");
    } else {
      await expect(reply).not.toBeEmpty({ timeout: 30_000 });
    }

    // Only the names are saved: after a reload the files are listed, their content is gone.
    await expect(page).toHaveURL(/\/assistant\/\w+$/);
    await page.reload();
    await expect(question.getByTestId("file-chip").first()).toHaveAttribute("title", /Not kept/);

    // Files dropped on the assistant are attached too, also on the list beside the chat.
    const dataTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["a,b"], "dropped.csv", { type: "text/csv" }));
      return transfer;
    });
    await page.getByTestId("chat-log").dispatchEvent("dragover", { dataTransfer });
    await expect(page.getByTestId("drop-zone")).toBeVisible();
    await page.getByRole("complementary").dispatchEvent("drop", { dataTransfer });
    await expect(page.getByTestId("drop-zone")).toHaveCount(0);
    await expect(chips).toHaveCount(1);
    await expect(chips).toContainText("dropped.csv");
  });

  test("works on a phone: history in a sheet, composer in view", async ({ authedPage: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/assistant");
    await expect(page.getByTestId("chat-composer")).toBeInViewport();
    await page.getByTestId("open-history").click();
    await expect(page.getByRole("dialog").getByTestId("new-chat")).toBeVisible();
  });
});
