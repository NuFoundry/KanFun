import { act, renderHook } from "@testing-library/react";
import { THEME_COLORS, useTheme } from "./use-theme";

describe("useTheme", () => {
  it("switches the dark class and the theme-color the browser and iOS status bar take", () => {
    const meta = Object.assign(document.createElement("meta"), { name: "theme-color" });
    document.head.append(meta);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("dark"));
    expect(document.documentElement).toHaveClass("dark");
    expect(meta.content).toBe(THEME_COLORS.dark);
    act(() => result.current.toggle());
    expect(document.documentElement).not.toHaveClass("dark");
    expect(meta.content).toBe(THEME_COLORS.light);
    meta.remove();
  });
});
