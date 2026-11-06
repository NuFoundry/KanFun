/**
 * What models write that plain GitHub Markdown does not show as meant, fixed before rendering:
 *
 *  - Maths in LaTeX's `\( … \)` and `\[ … \]` (Mistral's habit) become remark-math's `$$ … $$`,
 *    inline or on lines of their own. Single dollars stay text: "$5 or $10" is money, not maths.
 *  - A reply, or a table, wrapped in a ```markdown block is unwrapped and rendered; the copy
 *    button still copies the source.
 *  - `<br>` (how models break a line inside a table cell) becomes a line break: remarkBreaks.
 *
 * Code is left alone: fenced blocks and `inline code` keep their backslashes.
 */

const MARKDOWN_FENCE = /^```(?:markdown|md)[ \t]*\n([\s\S]*?)(?:\n```[ \t]*$|(?![\s\S]))/gim;
/** Fenced blocks (closed or still streaming in) and inline code spans. */
const CODE = /(^(```|~~~)[\s\S]*?(?:^\2[ \t]*$|(?![\s\S]))|`[^`\n]*`)/gm;
const DISPLAY_MATH = /\\\[([\s\S]+?)\\\]/g;
const INLINE_MATH = /\\\(([\s\S]+?)\\\)/g;

export function prepareMarkdown(text: string): string {
  return text
    .replace(MARKDOWN_FENCE, (_, body: string) => body)
    .split(CODE)
    .map((part, index) => {
      // split() with two groups yields [text, code, fence marker, text, ...].
      if (index % 3 !== 0) return index % 3 === 1 ? part : "";
      return part
        .replace(DISPLAY_MATH, (_, tex: string) => `\n$$\n${tex.trim()}\n$$\n`)
        .replace(INLINE_MATH, (_, tex: string) => `$$${tex.trim()}$$`);
    })
    .join("");
}

type MdNode = { type: string; value?: string; children?: MdNode[] };
const BR = /^<br\s*\/?>$/i;

/** remark plugin: `<br>` becomes a line break; every other piece of HTML is still shown as text. */
export function remarkBreaks() {
  return (tree: MdNode) => {
    const walk = (node: MdNode) =>
      node.children?.forEach((child, index, siblings) => {
        if (child.type === "html" && BR.test(child.value ?? ""))
          siblings[index] = { type: "break" };
        else walk(child);
      });
    walk(tree);
  };
}
