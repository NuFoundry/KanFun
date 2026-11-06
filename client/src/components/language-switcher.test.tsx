import { LanguageSwitcher } from "./language-switcher";
import { useAuth } from "@/lib/auth-context";
import { fireEvent, renderWithProviders, screen } from "@/test/test-utils";

jest.mock("@/lib/auth-context");
const mockedAuth = jest.mocked(useAuth);

describe("LanguageSwitcher", () => {
  it("lists every locale and asks the auth context to switch", async () => {
    const setLocale = jest.fn();
    mockedAuth.mockReturnValue({ setLocale } as unknown as ReturnType<typeof useAuth>);
    renderWithProviders(<LanguageSwitcher />);
    // jsdom has no real pointer events; Radix also opens the menu on Enter.
    fireEvent.keyDown(screen.getByTestId("language"), { key: "Enter" });
    const de = await screen.findByTestId("language-de");
    expect(screen.getByTestId("language-en")).toHaveTextContent("English");
    fireEvent.click(de);
    expect(setLocale).toHaveBeenCalledWith("de");
  });
});
