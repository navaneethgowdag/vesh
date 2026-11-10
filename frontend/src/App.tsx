import React, { Suspense, lazy, Component, ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute, PublicOnlyRoute } from './components/auth/ProtectedRoute';
import { LuxuryPageLoader } from './components/ui/LuxuryPageLoader';

// Core pages (eager loaded for instant first paint and rock-solid navigation)
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Home } from './pages/Home';
import { Wardrobe } from './pages/Wardrobe';
import { CreatePost } from './pages/CreatePost';
import { Explore } from './pages/Explore';
import { DailyFit } from './pages/DailyFit';
import { OAuthCallback } from './pages/OAuthCallback';
import { NotFound } from './pages/NotFound';

// Code-split auxiliary feature routes (loaded on-demand as separate chunks)
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const ClothingDetail = lazy(() => import('./pages/ClothingDetail').then((m) => ({ default: m.ClothingDetail })));
const Saved = lazy(() => import('./pages/Saved').then((m) => ({ default: m.Saved })));
const Notifications = lazy(() => import('./pages/Notifications').then((m) => ({ default: m.Notifications })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const UserProfile = lazy(() => import('./pages/UserProfile').then((m) => ({ default: m.UserProfile })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Calendar = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.Calendar })));
const Inbox = lazy(() => import('./pages/Inbox').then((m) => ({ default: m.Inbox })));
const CommunityDetail = lazy(() => import('./pages/CommunityDetail').then((m) => ({ default: m.CommunityDetail })));
const WeeklyPlanner = lazy(() => import('./pages/WeeklyPlanner').then((m) => ({ default: m.WeeklyPlanner })));
const WardrobeGap = lazy(() => import('./pages/WardrobeGap').then((m) => ({ default: m.WardrobeGap })));
const WardrobeInsights = lazy(() => import('./pages/WardrobeInsights').then((m) => ({ default: m.WardrobeInsights })));

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[TailorBird:ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-sand-50 dark:bg-charcoal-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mb-6">
            {this.state.errorMessage}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, errorMessage: '' });
              window.location.reload();
            }}
            className="px-5 py-2.5 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold text-xs tracking-wider uppercase transition-opacity hover:opacity-90 active:scale-95"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<LuxuryPageLoader />}>
              <Routes>
                {/* Public landing */}
                <Route path="/" element={<Landing />} />

                {/* Auth routes (redirects to /home if already logged in) */}
                <Route path="/auth/callback" element={<OAuthCallback />} />
                <Route
                  path="/login"
                  element={
                    <PublicOnlyRoute>
                      <Login />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <PublicOnlyRoute>
                      <Signup />
                    </PublicOnlyRoute>
                  }
                />

                {/* Core Protected Application Routes */}
                <Route
                  path="/home"
                  element={
                    <ProtectedRoute>
                      <Home />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/wardrobe"
                  element={
                    <ProtectedRoute>
                      <Wardrobe />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/create"
                  element={<Navigate to="/wardrobe" replace />}
                />
                <Route
                  path="/explore"
                  element={<Navigate to="/home" replace />}
                />
                <Route
                  path="/daily-fit"
                  element={
                    <ProtectedRoute>
                      <DailyFit />
                    </ProtectedRoute>
                  }
                />

                {/* Auxiliary Feature Routes (Code-Split) */}
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <Calendar />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/planner"
                  element={
                    <ProtectedRoute>
                      <WeeklyPlanner />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/wardrobe/gap-analysis"
                  element={
                    <ProtectedRoute>
                      <WardrobeGap />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/wardrobe-gap"
                  element={
                    <ProtectedRoute>
                      <WardrobeGap />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/insights"
                  element={
                    <ProtectedRoute>
                      <WardrobeInsights />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/communities/:slug"
                  element={<Navigate to="/home" replace />}
                />
                <Route
                  path="/community/:slug"
                  element={<Navigate to="/home" replace />}
                />
                <Route
                  path="/inbox"
                  element={<Navigate to="/home" replace />}
                />
                <Route
                  path="/wardrobe/:id"
                  element={
                    <ProtectedRoute>
                      <ClothingDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/saved"
                  element={<Navigate to="/daily-fit?tab=saved" replace />}
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile/:username"
                  element={
                    <ProtectedRoute>
                      <UserProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all 404 Page */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </AppProvider>
    </ThemeProvider>
  );
};

export default App;
