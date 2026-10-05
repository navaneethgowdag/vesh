import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Lock, Mail } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [email, setEmail] = useState('elena.rostova@stylesphere.io');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      showToast('Welcome back, Elena!', 'success');
      navigate('/home');
    }, 500);
  };

  const handleGoogleLogin = () => {
    showToast('Signed in via Google', 'success');
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand logo */}
        <div
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 cursor-pointer mb-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-charcoal-900 flex items-center justify-center text-cream-50 font-serif font-bold text-2xl shadow-soft">
            S
          </div>
        </div>

        <h2 className="font-serif text-3xl font-bold tracking-tight text-charcoal-950">
          Welcome back to StyleSphere
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-charcoal-500">
          Access your digital wardrobe and daily AI recommendations
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-cream-50 py-8 px-6 sm:px-10 shadow-soft-xl rounded-3xl border border-sand-200/90 space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
                  placeholder="elena@example.com"
                />
                <Mail className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => showToast('Password reset link sent to email', 'info')}
                  className="text-xs text-cognac-700 hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
                  placeholder="••••••••"
                />
                <Lock className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={loading}
              className="w-full mt-2"
            >
              Sign In to StyleSphere
            </Button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-sand-200" />
            <span className="flex-shrink mx-4 text-xs uppercase tracking-wider text-charcoal-400 font-medium">
              or
            </span>
            <div className="flex-grow border-t border-sand-200" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleGoogleLogin}
            className="w-full text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </Button>

          <p className="text-center text-xs text-charcoal-500 pt-2">
            Don't have an account yet?{' '}
            <Link to="/signup" className="font-semibold text-cognac-700 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

