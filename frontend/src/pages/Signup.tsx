import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, AtSign, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { useApp } from '../context/AppContext';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { register, showToast, authError } = useApp();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const clearErrors = () => {
    if (formError) setFormError(null);
  };

  const isSubmittingRef = React.useRef(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSubmittingRef.current) return;
    clearErrors();

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setFormError('Please enter your full name.');
      return;
    }

    if (cleanUsername.length < 3) {
      setFormError('Username must be at least 3 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setFormError('Username can only contain letters, numbers, underscores, and dashes.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    if (!agreeTerms) {
      setFormError('Please accept the Terms of Service to proceed.');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await register({
        name: cleanName,
        username: cleanUsername,
        email: cleanEmail,
        password,
      });
      showToast('Welcome to TailorBird! Let us configure your wardrobe.', 'success');
      navigate('/onboarding');
    } catch (err: any) {
      const msg = err?.message || 'Failed to create account. Please try again.';
      setFormError(msg);
      showToast(msg, 'info');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const displayedError = formError || authError;

  return (
    <div className="min-h-screen bg-[#F8F6F1] dark:bg-[#141715] flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      {/* Top Bar with brand */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#202321] dark:bg-[#F8F6F1] flex items-center justify-center text-[#F8F6F1] dark:text-[#202321] font-serif font-bold text-base shadow-xs transition-colors">
            T
          </div>
          <span className="text-xl font-serif font-bold tracking-tight text-[#202321] dark:text-[#F8F6F1]">
            TailorBird
          </span>
        </div>
      </div>

      {/* Main Registration Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto py-6">
        <div className="text-center mb-6">
          <span className="text-xs uppercase tracking-widest font-semibold text-[#777C75] dark:text-[#A3ABA0] block mb-1">
            Membership
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#202321] dark:text-[#F8F6F1] tracking-tight">
            Create Your Account
          </h1>
          <p className="mt-1.5 text-sm text-[#777C75] dark:text-[#A3ABA0] font-sans">
            Begin your journey towards an intentional, AI-curated style life
          </p>
        </div>

        <div className="bg-white dark:bg-[#1C201D] py-8 px-6 sm:px-10 rounded-2xl border border-[#E2DDD3] dark:border-[#2D342F] shadow-sm space-y-5">
          {displayedError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{displayedError}</span>
            </div>
          )}

          {/* Social Sign Up */}
          <GoogleSignInButton
            label="Sign up with Google"
            destination="/onboarding"
            action="signup"
            onError={(msg) => setFormError(msg)}
          />

          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#E2DDD3] dark:border-[#2D342F] w-full" />
            <span className="bg-white dark:bg-[#1C201D] px-3 text-[11px] font-mono uppercase tracking-wider font-semibold text-[#777C75] dark:text-[#A3ABA0] absolute">
              or register with email
            </span>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-1">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearErrors();
                  }}
                  className="w-full bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl pl-10 pr-4 py-2.5 min-h-[44px] text-base sm:text-sm text-[#202321] dark:text-[#F8F6F1] placeholder:text-[#777C75]/60 focus:outline-none focus:ring-1 focus:ring-[#727D69]"
                  placeholder="e.g. Clara Vane"
                />
                <User className="w-4 h-4 text-[#777C75] absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-1">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    clearErrors();
                  }}
                  className="w-full bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl pl-10 pr-4 py-2.5 min-h-[44px] text-base sm:text-sm text-[#202321] dark:text-[#F8F6F1] placeholder:text-[#777C75]/60 focus:outline-none focus:ring-1 focus:ring-[#727D69]"
                  placeholder="claravane"
                />
                <AtSign className="w-4 h-4 text-[#777C75] absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearErrors();
                  }}
                  className="w-full bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl pl-10 pr-4 py-2.5 min-h-[44px] text-base sm:text-sm text-[#202321] dark:text-[#F8F6F1] placeholder:text-[#777C75]/60 focus:outline-none focus:ring-1 focus:ring-[#727D69]"
                  placeholder="you@domain.com"
                />
                <Mail className="w-4 h-4 text-[#777C75] absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearErrors();
                    }}
                    className="w-full bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl pl-9 pr-8 py-2.5 min-h-[44px] text-base sm:text-sm text-[#202321] dark:text-[#F8F6F1] placeholder:text-[#777C75]/60 focus:outline-none focus:ring-1 focus:ring-[#727D69]"
                    placeholder="Min 6 chars"
                  />
                  <Lock className="w-3.5 h-3.5 text-[#777C75] absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-1">
                  Confirm
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      clearErrors();
                    }}
                    className="w-full bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl pl-9 pr-8 py-2.5 min-h-[44px] text-base sm:text-sm text-[#202321] dark:text-[#F8F6F1] placeholder:text-[#777C75]/60 focus:outline-none focus:ring-1 focus:ring-[#727D69]"
                    placeholder="Repeat"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-3 p-1 text-[#777C75] hover:text-[#202321] dark:hover:text-[#F8F6F1] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => {
                    setAgreeTerms(e.target.checked);
                    clearErrors();
                  }}
                  className="w-4 h-4 mt-0.5 rounded text-[#202321] focus:ring-[#727D69] border-[#E2DDD3] dark:border-[#2D342F]"
                />
                <span className="text-xs text-[#777C75] dark:text-[#A3ABA0] leading-relaxed">
                  I agree to the Terms of Service, Privacy Policy, and Community Standards.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={loading}
              loadingText="Creating Account..."
              className="w-full mt-2 min-h-[44px] shadow-xs cursor-pointer"
            >
              Complete Registration
            </Button>
          </form>

          <div className="pt-3 border-t border-[#E2DDD3] dark:border-[#2D342F] text-center">
            <p className="text-xs text-[#777C75] dark:text-[#A3ABA0]">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-[#202321] dark:text-[#F8F6F1] hover:underline font-semibold"
              >
                Sign In &rarr;
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer minimal info */}
      <div className="text-center text-xs font-mono text-[#777C75] dark:text-[#A3ABA0]">
        TailorBird · Powered by Neon PostgreSQL
      </div>
    </div>
  );
};

export default Signup;
