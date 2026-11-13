import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, User, AlertCircle, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { api, adminTokenStorage } from '../../services/api';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/admin/overview';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please provide both administrator username and password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.admin.login({ username: username.trim(), password });
      if (res && res.access_token) {
        adminTokenStorage.set(res.access_token);
        navigate(from, { replace: true });
      } else {
        setError('Login failed: invalid response from authentication server.');
      }
    } catch (err: any) {
      if (err.status === 429) {
        setError('Too many failed sign-in attempts. Administrator login has been temporarily throttled for security.');
      } else if (err.status === 401 || err.status === 403) {
        setError('Invalid administrator credentials or unauthorized role.');
      } else {
        setError(err.message || 'Authentication error. Please check your network and credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#161218] text-[#F3EEE8] flex flex-col justify-center items-center px-4 relative overflow-hidden select-none">
      <div className="w-full max-w-md relative z-10">
        {/* Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[2px] bg-[#29202B] border border-[#743C49]/40 mb-4 shadow-sm">
            <Shield className="w-6 h-6 text-[#D5A6A0]" />
          </div>
          <span className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[#D5A6A0] mb-1">
            GOVERNANCE ATELIER
          </span>
          <h1 className="text-3xl font-serif text-[#F3EEE8] tracking-tight">
            TailorBird <span className="italic font-normal text-[#D5A6A0]">Admin.</span>
          </h1>
          <p className="text-xs text-[#777078] mt-1.5 font-sans">
            Restricted Model Fine-Tuning & Governance Console
          </p>
        </div>

        {/* Login Form Container */}
        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6 sm:p-8 shadow-xl">
          {error && (
            <div className="mb-6 p-3.5 rounded-[2px] bg-[#743C49]/20 border border-[#743C49]/50 text-rose-200 text-xs flex items-start gap-2.5 font-mono">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#D5A6A0]" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1.5">
                Admin Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#777078]">
                  <User size={15} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#241D27] border border-[#392F3E] rounded-[2px] text-xs text-[#F3EEE8] placeholder-[#777078] focus:outline-none focus:border-[#743C49] transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1.5">
                Master Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#777078]">
                  <Lock size={15} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#241D27] border border-[#392F3E] rounded-[2px] text-xs text-[#F3EEE8] placeholder-[#777078] focus:outline-none focus:border-[#743C49] transition-colors font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-[2px] bg-[#743C49] hover:bg-[#5C2F3A] text-white font-mono text-xs uppercase tracking-[0.14em] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Verifying Authority...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate Console</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-[#392F3E] text-center">
            <div className="text-[10px] text-[#777078] flex items-center justify-center gap-1.5 font-mono uppercase tracking-[0.1em]">
              <Sparkles size={11} className="text-[#D5A6A0]" />
              <span>TailorBird System Authorization Engine</span>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/home')}
            className="text-xs font-mono uppercase tracking-[0.12em] text-[#777078] hover:text-[#D5A6A0] transition-colors cursor-pointer"
          >
            ← Return to Client App
          </button>
        </div>
      </div>
    </div>
  );
};
