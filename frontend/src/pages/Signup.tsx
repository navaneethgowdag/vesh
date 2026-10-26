import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, User, AtSign, Mail, Lock, Check, AlertCircle } from 'lucide-react';
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
      showToast('Please enter your full name.', 'info');
      return;
    }

    if (cleanUsername.length < 3) {
      setFormError('Username must be at least 3 characters long.');
      showToast('Username must be at least 3 characters long.', 'info');
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setFormError('Username can only contain letters, numbers, underscores, dashes, and periods.');
      showToast('Username can only contain letters, numbers, underscores, and dashes.', 'info');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormError('Please enter a valid email address.');
      showToast('Please enter a valid email address.', 'info');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      showToast('Password must be at least 6 characters long.', 'info');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      showToast('Passwords do not match.', 'info');
      return;
    }

    if (!agreeTerms) {
      setFormError('Please accept the Terms of Service and Privacy Policy to proceed.');
      showToast('Please agree to terms to proceed.', 'info');
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
      showToast('Account created! Let us configure your style profile.', 'success');
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
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 cursor-pointer mb-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-charcoal-900 flex items-center justify-center text-cream-50 font-serif font-bold text-2xl shadow-soft">
            S
          </div>
        </div>

        <h2 className="font-serif text-3xl font-bold tracking-tight text-charcoal-950">
          Join StyleSphere
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-charcoal-500">
          Begin your journey towards an effortless, intelligent wardrobe
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-cream-50 py-8 px-6 sm:px-10 shadow-soft-xl rounded-3xl border border-sand-200/90 space-y-6">
          {displayedError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold block">Registration Error</span>
                <span>{displayedError}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
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
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
                  placeholder="e.g. Jane Doe"
                  autoComplete="name"
                />
                <User className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={50}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    clearErrors();
                  }}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
                  placeholder="e.g. janedoe"
                  autoComplete="username"
                />
                <AtSign className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
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
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <Mail className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearErrors();
                  }}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
                  placeholder="•••••••• (at least 6 characters)"
                  autoComplete="new-password"
                />
                <Lock className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearErrors();
                  }}
                  className={`w-full bg-cream-100/60 border rounded-2xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:bg-cream-50 ${
                    passwordsMismatch
                      ? 'border-rose-400 focus:ring-rose-500'
                      : passwordsMatch
                      ? 'border-emerald-500 focus:ring-emerald-500'
                      : 'border-sand-300 focus:ring-cognac-600'
                  }`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <Lock className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
                {passwordsMatch && (
                  <Check className="w-4 h-4 text-emerald-600 absolute right-3.5 top-3" />
                )}
              </div>
              {passwordsMismatch && (
                <p className="text-[11px] text-rose-600 mt-1 pl-1">Passwords do not match</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  clearErrors();
                }}
                className="w-4 h-4 rounded text-cognac-600 focus:ring-cognac-500 border-sand-300"
              />
              <label htmlFor="terms" className="text-xs text-charcoal-600">
                I agree to the{' '}
                <span className="text-cognac-700 underline cursor-pointer">Terms of Service</span>{' '}
                and <span className="text-cognac-700 underline cursor-pointer">Privacy Policy</span>.
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={loading}
              className="w-full mt-2"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Onboarding
            </Button>
          </form>

          <p className="text-center text-xs text-charcoal-500 pt-2">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-cognac-700 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

