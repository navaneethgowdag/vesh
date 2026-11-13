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

  const isSubmittingRef = React.useRef(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSubmittingRef.current) return;
    if (!usernameOrEmail.trim() || !password) return;

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await login(usernameOrEmail.trim(), password);
      showToast('Welcome back to TailorBird', 'success');
      navigate(destination, { replace: true });
    } catch (err: any) {
      showToast(err?.message || 'Invalid credentials', 'info');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3EEE8] dark:bg-[#1A151C] flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      {/* Top Bar with brand */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-[2px] bg-[#29202B] dark:bg-[#F3EEE8] flex items-center justify-center text-[#FFFFFF] dark:text-[#29202B] font-serif font-bold text-base shadow-xs transition-colors">
            T
          </div>
          <span className="text-xl font-serif font-bold tracking-tight text-[#29202B] dark:text-[#F3EEE8]">
            TailorBird
          </span>
        </div>
        <Link
          to="/"
          className="text-xs font-sans font-medium uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B] hover:text-[#29202B] dark:hover:text-[#F3EEE8]"
        >
          Editorial Journal
        </Link>
      </div>

      {/* Main Form Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto py-8">
        <div className="text-center mb-8">
          <span className="text-[10px] uppercase tracking-[0.2em] font-sans font-semibold text-[#743C49] dark:text-[#D5A6A0] block mb-2 select-none">
            Member Access · Atelier
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight leading-tight">
            <span>Welcome</span>{' '}
            <span className="italic font-normal font-serif text-[#743C49] dark:text-[#D5A6A0]">
              Back.
            </span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] font-sans">
            Enter your credentials to access your capsule wardrobe & recommendations
          </p>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#241D27] py-8 px-6 sm:px-9 rounded-[4px] border border-[#DCD4CC] dark:border-[#392F3E] shadow-sm space-y-6">
          {oauthError === 'account_collision' && (
            <div className="p-3.5 rounded-[2px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#743C49]" />
              <div>
                <span className="font-semibold block mb-0.5">Account already exists</span>
                An account with {oauthEmail ? <strong className="font-semibold">{oauthEmail}</strong> : 'this email'} was created using a password. Please sign in below with your password to access your account.
              </div>
            </div>
          )}

          {(authError || googleError) && (
            <div className="p-3.5 rounded-[2px] bg-[#A33D42]/10 border border-[#A33D42]/30 flex items-start gap-2.5 text-xs text-[#A33D42] dark:text-rose-300">
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
            <div className="border-t border-[#DCD4CC] dark:border-[#392F3E] w-full" />
            <span className="bg-[#FFFFFF] dark:bg-[#241D27] px-3 text-[10px] font-sans uppercase tracking-[0.16em] font-semibold text-[#6D7068] dark:text-[#A89E9B] absolute">
              or continue with email
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="username_or_email"
                className="block text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B] mb-1.5"
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
                  className="w-full bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] pl-10 pr-4 py-2.5 min-h-[44px] text-sm text-[#29202B] dark:text-[#F3EEE8] placeholder:text-[#6D7068]/50 focus:outline-none focus:border-[#743C49] dark:focus:border-[#D5A6A0]"
                  placeholder="your_username or you@domain.com"
                />
                <Mail className="w-4 h-4 text-[#6D7068] absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B]"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => showToast('Password recovery link sent if email matches', 'info')}
                  className="text-xs text-[#6D7068] dark:text-[#A89E9B] hover:text-[#743C49] dark:hover:text-[#D5A6A0] font-sans cursor-pointer transition-colors"
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
                  className="w-full bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] pl-10 pr-10 py-2.5 min-h-[44px] text-sm text-[#29202B] dark:text-[#F3EEE8] placeholder:text-[#6D7068]/50 focus:outline-none focus:border-[#743C49] dark:focus:border-[#D5A6A0]"
                  placeholder="••••••••"
                />
                <Lock className="w-4 h-4 text-[#6D7068] absolute left-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-3 p-1 text-[#6D7068] hover:text-[#29202B] dark:hover:text-[#F3EEE8] cursor-pointer"
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
              loadingText="Signing In..."
              className="w-full mt-3 min-h-[44px] shadow-xs cursor-pointer font-sans uppercase tracking-[0.14em] text-xs"
            >
              Sign In to Wardrobe
            </Button>
          </form>

          <div className="pt-4 border-t border-[#DCD4CC] dark:border-[#392F3E] text-center">
            <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] font-sans">
              New to TailorBird?{' '}
              <Link
                to="/signup"
                className="text-[#743C49] dark:text-[#D5A6A0] hover:underline font-semibold ml-1"
              >
                Create your account &rarr;
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer minimal info */}
      <div className="text-center text-[11px] font-sans uppercase tracking-[0.16em] text-[#6D7068] dark:text-[#A89E9B]">
        TailorBird · Personal AI Wardrobe & Occasion Stylist
      </div>
    </div>
  );
};
