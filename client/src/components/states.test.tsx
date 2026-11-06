import userEvent from "@testing-library/user-event";
import { EmptyState, ErrorState } from "./states";
import { renderWithProviders, screen } from "@/test/test-utils";

describe("EmptyState", () => {
  it("renders title, description and action", () => {
    renderWithProviders(
      <EmptyState title="Nothing here" description="Add one" action={<button>New</button>} />,
    );
    expect(screen.getByTestId("empty")).toHaveTextContent("Nothing here");
    expect(screen.getByText("Add one")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("is an alert with the message and a retry button", async () => {
    const onRetry = jest.fn();
    renderWithProviders(
      <ErrorState error={new Error("boom")} onRetry={onRetry} testId="x-error" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    await userEvent.click(screen.getByTestId("x-error-retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("works without a retry handler and with non-Error values", () => {
    renderWithProviders(<ErrorState error="plain string" />);
    expect(screen.getByRole("alert")).toHaveTextContent("plain string");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
