import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/components/protected-route";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { AssistantPage } from "@/routes/assistant";
import { ConnectPage } from "@/routes/connect";
import {
  ConfirmEmailChangePage,
  ConfirmVerificationPage,
  ResetPasswordPage,
} from "@/routes/auth-confirm";
import { DashboardPage } from "@/routes/dashboard";
import { DevMailPage } from "@/routes/dev-mail";
import { HomePage } from "@/routes/home";
import { LoginPage } from "@/routes/login";
import { NotFoundPage } from "@/routes/not-found";
import { PostDetailPage } from "@/routes/post-detail";
import { SettingsPage } from "@/routes/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="posts/:slug" element={<PostDetailPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route
                path="auth/confirm-verification/:token"
                element={<ConfirmVerificationPage />}
              />
              <Route path="auth/confirm-password-reset/:token" element={<ResetPasswordPage />} />
              <Route path="auth/confirm-email-change/:token" element={<ConfirmEmailChangePage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="assistant/:conversationId?" element={<AssistantPage />} />
                <Route path="connect" element={<ConnectPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            {env.isDev && <Route path="dev/mail" element={<DevMailPage />} />}
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
