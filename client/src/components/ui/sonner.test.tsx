import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { Toaster } from "./sonner";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

describe("Toaster", () => {
  it("starts below the header and closes a toast right away", async () => {
    renderWithProviders(<Toaster richColors position="top-right" />);
    act(() => {
      toast.success("Profile saved");
    });
    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    const stack = document.querySelector<HTMLElement>("[data-sonner-toaster]");
    expect(stack?.style.getPropertyValue("--offset-top")).toBe(
      "calc(72px + env(safe-area-inset-top))",
    );

    await userEvent.click(screen.getByRole("button", { name: "Close notification" }));
    await waitFor(() => expect(screen.queryByText("Profile saved")).not.toBeInTheDocument());
  });
});
