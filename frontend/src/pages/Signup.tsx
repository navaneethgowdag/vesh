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
    <div className="min-h-screen bg-[#F7F4EE] dark:bg-[#171715] flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      {/* Top Bar with brand & theme toggle */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-xl bg-[#25211E] dark:bg-[#22221F] border border-[#C3A36B]/30 flex items-center justify-center text-[#F7F4EE] font-serif font-bold text-sm shadow-subtle group-hover:bg-[#C3A36B] transition-colors">
            S
          </div>
          <span className="font-serif text-lg font-bold tracking-tight text-[#25211E] dark:text-[#F4F0E8]">
            StyleSphere
          </span>
        </div>
      </div>

      {/* Main Registration Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto py-6">
        <div className="text-center mb-6">
          <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[#C3A36B] dark:text-[#D1B47A] block mb-1 font-sans">
            Atelier Membership
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#25211E] dark:text-[#F4F0E8] tracking-tight">
            Create Your Capsule
          </h1>
          <p className="mt-1.5 text-xs text-[#82796F] dark:text-[#B2AA9E] font-sans">
            Begin your journey towards an intentional, AI-curated style life
          </p>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#22221F] py-8 px-6 sm:px-10 shadow-soft rounded-2xl border border-[#E5DED3] dark:border-[#393832] space-y-5">
          {displayedError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{displayedError}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-1">
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
                  className="w-full bg-[#F7F4EE]/60 dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-[#25211E] dark:text-[#F4F0E8] placeholder:text-[#A39B90] dark:placeholder:text-[#7E786E] focus:outline-none focus:ring-2 focus:ring-[#C3A36B] dark:focus:ring-[#D1B47A]"
                  placeholder="e.g. Clara Vane"
                />
                <User className="w-4 h-4 text-[#82796F] dark:text-[#7E786E] absolute left-3.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-1">
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
                  className="w-full bg-[#F7F4EE]/60 dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-[#25211E] dark:text-[#F4F0E8] placeholder:text-[#A39B90] dark:placeholder:text-[#7E786E] focus:outline-none focus:ring-2 focus:ring-[#C3A36B] dark:focus:ring-[#D1B47A]"
                  placeholder="claravane"
                />
                <AtSign className="w-4 h-4 text-[#82796F] dark:text-[#7E786E] absolute left-3.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-1">
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
                  className="w-full bg-[#F7F4EE]/60 dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-[#25211E] dark:text-[#F4F0E8] placeholder:text-[#A39B90] dark:placeholder:text-[#7E786E] focus:outline-none focus:ring-2 focus:ring-[#C3A36B] dark:focus:ring-[#D1B47A]"
                  placeholder="you@domain.com"
                />
                <Mail className="w-4 h-4 text-[#82796F] dark:text-[#7E786E] absolute left-3.5 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-1">
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
                    className="w-full bg-[#F7F4EE]/60 dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] rounded-xl pl-9 pr-8 py-2 text-xs text-[#25211E] dark:text-[#F4F0E8] placeholder:text-[#A39B90] dark:placeholder:text-[#7E786E] focus:outline-none focus:ring-2 focus:ring-[#C3A36B] dark:focus:ring-[#D1B47A]"
                    placeholder="Min 6 chars"
                  />
                  <Lock className="w-3.5 h-3.5 text-[#82796F] dark:text-[#7E786E] absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-1">
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
                    className="w-full bg-[#F7F4EE]/60 dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] rounded-xl pl-9 pr-8 py-2 text-xs text-[#25211E] dark:text-[#F4F0E8] placeholder:text-[#A39B90] dark:placeholder:text-[#7E786E] focus:outline-none focus:ring-2 focus:ring-[#C3A36B] dark:focus:ring-[#D1B47A]"
                    placeholder="Repeat"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2 p-0.5 text-[#82796F] dark:text-[#7E786E] hover:text-[#25211E] dark:hover:text-[#F4F0E8]"
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
                  className="w-4 h-4 mt-0.5 rounded text-[#C3A36B] focus:ring-[#C3A36B] border-[#E5DED3] dark:border-[#393832]"
                />
                <span className="text-xs text-[#82796F] dark:text-[#B2AA9E] leading-relaxed">
                  I agree to the Terms of Service, Privacy Policy, and Atelier Community Standards.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={loading}
              className="w-full mt-2"
            >
              Complete Registration
            </Button>
          </form>

          <div className="pt-3 border-t border-[#E5DED3] dark:border-[#393832] text-center">
            <p className="text-xs text-[#82796F] dark:text-[#B2AA9E]">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-[#C3A36B] dark:text-[#D1B47A] hover:underline font-semibold"
              >
                Sign In &rarr;
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer minimal info */}
      <div className="text-center text-xs text-[#A39B90] dark:text-[#7E786E]">
        StyleSphere Atelier &middot; Powered by Neon PostgreSQL
      </div>
    </div>
  );
};
