// The part of opentype.js (which ships no types) that scripts/brand/brand.ts uses.
declare module "opentype.js" {
  interface Glyph {
    index: number;
    advanceWidth: number;
    getPath(x: number, y: number, size: number): { toPathData(decimals?: number): string };
  }
  interface Font {
    unitsPerEm: number;
    tables: { os2: unknown };
    charToGlyph(char: string): Glyph;
    getKerningValue(left: Glyph, right: Glyph): number;
  }
  const opentype: { parse(buffer: ArrayBuffer): Font };
  export default opentype;
}
