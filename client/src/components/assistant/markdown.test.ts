import { prepareMarkdown, remarkBreaks } from "./markdown";

describe("prepareMarkdown", () => {
  it("turns LaTeX's \\( \\) and \\[ \\] into remark-math's $$", () => {
    expect(prepareMarkdown("The area is \\( \\pi r^2 \\).")).toBe("The area is $$\\pi r^2$$.");
    expect(prepareMarkdown("Sum:\n\\[\n\\sum_{i=1}^n i\n\\]\ndone")).toBe(
      "Sum:\n\n$$\n\\sum_{i=1}^n i\n$$\n\ndone",
    );
  });

  it("leaves money, code spans and code blocks alone", () => {
    expect(prepareMarkdown("Pro costs $9, Team $29.")).toBe("Pro costs $9, Team $29.");
    expect(prepareMarkdown("Use `\\(x\\)` here")).toBe("Use `\\(x\\)` here");
    const block = "```tex\n\\(x\\)\n```\nafter \\(y\\)";
    expect(prepareMarkdown(block)).toBe("```tex\n\\(x\\)\n```\nafter $$y$$");
    // A block still streaming in has no closing fence yet.
    expect(prepareMarkdown("```js\nconst a = '\\(';")).toBe("```js\nconst a = '\\(';");
  });

  it("unwraps a reply or table the model put in a ```markdown block", () => {
    const table = "| a | b |\n|---|---|\n| 1 | 2 |";
    expect(prepareMarkdown(`Here:\n\`\`\`markdown\n${table}\n\`\`\`\nend`)).toBe(
      `Here:\n${table}\nend`,
    );
    expect(prepareMarkdown(`\`\`\`md\n${table}`)).toBe(table);
    expect(prepareMarkdown("```ts\nconst x = 1;\n```")).toBe("```ts\nconst x = 1;\n```");
  });
});

describe("remarkBreaks", () => {
  it("makes <br> a line break and keeps every other piece of HTML as it was", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "tableCell",
          children: [
            { type: "text", value: "one" },
            { type: "html", value: "<br>" },
            { type: "text", value: "two" },
            { type: "html", value: "<BR />" },
            { type: "html", value: "<script>" },
          ],
        },
      ],
    };
    remarkBreaks()(tree);
    expect(tree.children[0]!.children.map((node) => node.type)).toEqual([
      "text",
      "break",
      "text",
      "break",
      "html",
    ]);
  });
});
