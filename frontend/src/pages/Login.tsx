import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, showToast, authError } = useApp();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const destination = (location.state as any)?.from?.pathname || '/home';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) return;

    setLoading(true);
    try {
      await login(usernameOrEmail.trim(), password);
      showToast('Welcome back to StyleSphere Atelier', 'success');
      navigate(destination, { replace: true });
    } catch (err: any) {
      showToast(err?.message || 'Invalid credentials', 'info');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Main Form Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto py-8">
        <div className="text-center mb-8">
          <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[#C3A36B] dark:text-[#D1B47A] block mb-1 font-sans">
            Member Access
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#25211E] dark:text-[#F4F0E8] tracking-tight">
            Welcome Back
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#82796F] dark:text-[#B2AA9E] font-sans">
            Enter your credentials to access your capsule wardrobe
          </p>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#22221F] py-8 px-6 sm:px-10 shadow-soft rounded-2xl border border-[#E5DED3] dark:border-[#393832] space-y-6">
          {authError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="username_or_email"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-1.5"
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
                  className="w-full bg-[#F7F4EE]/60 dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#25211E] dark:text-[#F4F0E8] placeholder:text-[#A39B90] dark:placeholder:text-[#7E786E] focus:outline-none focus:ring-2 focus:ring-[#C3A36B] dark:focus:ring-[#D1B47A]"
                  placeholder="your_username or you@domain.com"
                />
                <Mail className="w-4 h-4 text-[#82796F] dark:text-[#7E786E] absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E]"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => showToast('Password recovery link sent if email matches', 'info')}
                  className="text-xs text-[#C3A36B] dark:text-[#D1B47A] hover:underline font-medium"
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
                  className="w-full bg-[#F7F4EE]/60 dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[#25211E] dark:text-[#F4F0E8] placeholder:text-[#A39B90] dark:placeholder:text-[#7E786E] focus:outline-none focus:ring-2 focus:ring-[#C3A36B] dark:focus:ring-[#D1B47A]"
                  placeholder="••••••••"
                />
                <Lock className="w-4 h-4 text-[#82796F] dark:text-[#7E786E] absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-2.5 p-1 text-[#82796F] dark:text-[#7E786E] hover:text-[#25211E] dark:hover:text-[#F4F0E8]"
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
              className="w-full mt-2"
            >
              Sign In to Atelier
            </Button>
          </form>

          <div className="pt-4 border-t border-[#E5DED3] dark:border-[#393832] text-center">
            <p className="text-xs text-[#82796F] dark:text-[#B2AA9E]">
              New to StyleSphere?{' '}
              <Link
                to="/signup"
                className="text-[#C3A36B] dark:text-[#D1B47A] hover:underline font-semibold"
              >
                Create your account &rarr;
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
