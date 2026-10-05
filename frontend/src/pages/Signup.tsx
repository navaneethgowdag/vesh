import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, User, AtSign, Mail, Lock, Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { register, showToast, authError } = useApp();

  const [name, setName] = useState('Elena Rostova');
  const [username, setUsername] = useState('elena_r');
  const [email, setEmail] = useState('elena.rostova@stylesphere.io');
  const [password, setPassword] = useState('password123');
  const [confirmPassword, setConfirmPassword] = useState('password123');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'info');
      return;
    }
    if (!agreeTerms) {
      showToast('Please agree to terms to proceed', 'info');
      return;
    }

    setLoading(true);
    try {
      // Creates the account in Neon and establishes the session cookie.
      await register({ name, username, email, password });
      showToast('Account created! Let us configure your style profile.', 'success');
      navigate('/onboarding');
    } catch {
      // The context exposes the failure through `authError` / a toast.
    } finally {
      setLoading(false);
    }
  };

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
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
                  placeholder="Elena Rostova"
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
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
                  placeholder="elena_r"
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
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
                  placeholder="elena@example.com"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
                  placeholder="••••••••"
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 focus:bg-cream-50"
                  placeholder="••••••••"
                />
                <Lock className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
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

