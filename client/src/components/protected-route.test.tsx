import { Route, Routes } from "react-router";
import { ProtectedRoute } from "./protected-route";
import { useAuth } from "@/lib/auth-context";
import { renderWithProviders, screen } from "@/test/test-utils";

jest.mock("@/lib/auth-context");
const mockedUseAuth = jest.mocked(useAuth);
type Auth = ReturnType<typeof useAuth>;

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<p>login page</p>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/secret" element={<p>secret page</p>} />
      </Route>
    </Routes>,
    { route },
  );
}

describe("ProtectedRoute", () => {
  it("redirects anonymous users to /login", () => {
    mockedUseAuth.mockReturnValue({ isAuthenticated: false, loading: false } as Auth);
    renderAt("/secret");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("renders the child route for signed-in users", () => {
    mockedUseAuth.mockReturnValue({ isAuthenticated: true, loading: false } as Auth);
    renderAt("/secret");
    expect(screen.getByText("secret page")).toBeInTheDocument();
  });

  it("shows a placeholder while validating the session", () => {
    mockedUseAuth.mockReturnValue({ isAuthenticated: false, loading: true } as Auth);
    renderAt("/secret");
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
  });
});
