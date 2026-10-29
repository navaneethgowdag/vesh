import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, AtSign, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setLoading(true);
    try {
      await register({
        name: cleanName,
        username: cleanUsername,
        email: cleanEmail,
        password,
      });
      showToast('Welcome to StyleSphere! Let us configure your wardrobe.', 'success');
      navigate('/onboarding');
    } catch (err: any) {
      const msg = err?.message || 'Failed to create account. Please try again.';
      setFormError(msg);
      showToast(msg, 'info');
    } finally {
      setLoading(false);
    }
  };

  const displayedError = formError || authError;

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

      {/* Main Registration Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto py-6">
        <div className="text-center mb-6">
          <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
            Membership
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Create Your Account
          </h1>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            Begin your journey towards an intentional, AI-curated style life
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 py-8 px-6 sm:px-10 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-5">
          {displayedError && (
            <div className="p-3.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{displayedError}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
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
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md pl-10 pr-4 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  placeholder="e.g. Clara Vane"
                />
                <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
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
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md pl-10 pr-4 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  placeholder="claravane"
                />
                <AtSign className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
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
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md pl-10 pr-4 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  placeholder="you@domain.com"
                />
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
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
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md pl-9 pr-8 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    placeholder="Min 6 chars"
                  />
                  <Lock className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
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
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md pl-9 pr-8 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    placeholder="Repeat"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-3 p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
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
                  className="w-4 h-4 mt-0.5 rounded text-zinc-900 focus:ring-zinc-900 border-zinc-300 dark:border-zinc-700"
                />
                <span className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  I agree to the Terms of Service, Privacy Policy, and Community Standards.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={loading}
              className="w-full mt-2 min-h-[44px]"
            >
              Complete Registration
            </Button>
          </form>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-zinc-900 dark:text-zinc-100 hover:underline font-semibold"
              >
                Sign In &rarr;
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
