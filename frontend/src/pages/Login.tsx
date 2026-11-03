import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Info } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { useApp } from '../context/AppContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, showToast, authError } = useApp();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const destination = (location.state as any)?.from?.pathname || '/home';
  const oauthError = searchParams.get('error');
  const oauthEmail = searchParams.get('email');

  useEffect(() => {
    if (oauthError === 'account_collision') {
      if (oauthEmail) {
        setUsernameOrEmail(oauthEmail);
      }
    } else if (oauthError === 'cancelled') {
      showToast('Google sign-in was cancelled.', 'info');
    } else if (oauthError === 'invalid_state') {
      setGoogleError('Security validation failed (invalid state token). Please try again.');
    } else if (oauthError === 'invalid_ticket') {
      setGoogleError('Authentication exchange timed out. Please try signing in again.');
    } else if (oauthError) {
      setGoogleError('Google sign-in could not be completed. Please use your password or try again.');
    }
  }, [oauthError, oauthEmail]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) return;

    setLoading(true);
    try {
      await login(usernameOrEmail.trim(), password);
      showToast('Welcome back to StyleSphere', 'success');
      navigate(destination, { replace: true });
    } catch (err: any) {
      showToast(err?.message || 'Invalid credentials', 'info');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#121214] flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      {/* Top Bar with brand */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 font-bold text-sm transition-colors">
            S
          </div>
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            StyleSphere
          </span>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto py-8">
        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
            Member Access
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Enter your credentials to access your capsule wardrobe
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 py-8 px-6 sm:px-10 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-6">
          {oauthError === 'account_collision' && (
            <div className="p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold block mb-0.5">Account already exists</span>
                An account with {oauthEmail ? <strong className="font-semibold">{oauthEmail}</strong> : 'this email'} was created using a password. Please sign in below with your password to access your account.
              </div>
            </div>
          )}

          {(authError || googleError) && (
            <div className="p-3.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{authError || googleError}</span>
            </div>
          )}

          {/* Social Sign In */}
          <GoogleSignInButton
            destination={destination}
            action="login"
            onError={(msg) => setGoogleError(msg)}
          />

          <div className="relative flex items-center justify-center">
            <div className="border-t border-zinc-200 dark:border-zinc-800 w-full" />
            <span className="bg-white dark:bg-zinc-900 px-3 text-[11px] uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500 absolute">
              or continue with email
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="username_or_email"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Username or Email
              </label>
              <div className="relative">
                <input
                  id="username_or_email"
                  type="text"
                  required
                  autoComplete="username"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md pl-10 pr-4 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  placeholder="your_username or you@domain.com"
                />
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => showToast('Password recovery link sent if email matches', 'info')}
                  className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md pl-10 pr-10 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  placeholder="••••••••"
                />
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-3 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={loading}
              className="w-full mt-2 min-h-[44px]"
            >
              Sign In
            </Button>
          </form>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              New to StyleSphere?{' '}
              <Link
                to="/signup"
                className="text-zinc-900 dark:text-zinc-100 hover:underline font-semibold"
              >
                Create your account &rarr;
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer minimal info */}
      <div className="text-center text-xs text-zinc-400">
        StyleSphere &middot; Powered by Neon PostgreSQL
      </div>
    </div>
  );
};
