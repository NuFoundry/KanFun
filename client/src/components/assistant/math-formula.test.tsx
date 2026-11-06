import { render, screen, waitFor } from "@testing-library/react";
import { MathFormula } from "./math-formula";

const TEX = "\\frac{a}{b}";

describe("MathFormula", () => {
  it("shows the LaTeX as code until KaTeX has drawn it", async () => {
    const { container } = render(<MathFormula tex={TEX} display={false} />);
    expect(screen.getByText(TEX).tagName).toBe("CODE");
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    expect(screen.queryByText(TEX, { selector: "code" })).toBeNull();
    expect(screen.getByTestId("math")).toBeVisible();
  });

  it("draws display maths as a block and survives broken LaTeX", async () => {
    const { container } = render(<MathFormula tex={"\\frac{a}{"} display />);
    await waitFor(() =>
      expect(container.querySelector(".katex-display, .katex-error")).not.toBeNull(),
    );
  });
});
