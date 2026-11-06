import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders children and handles clicks", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Click me" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-destructive");
  });

  it("renders as a child element with asChild", () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Link" })).toHaveAttribute("href", "/x");
  });
});
