import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshData, showToast } = useApp();
  const [statusMessage, setStatusMessage] = useState('Verifying your Google authentication...');
  const hasExchangedRef = useRef(false);

  useEffect(() => {
    if (hasExchangedRef.current) return;
    hasExchangedRef.current = true;

    const ticket = searchParams.get('ticket');
    const destination = searchParams.get('destination') || '/home';

    if (!ticket) {
      navigate('/login?error=missing_ticket&message=Authentication+ticket+missing.+Please+try+again.', {
        replace: true,
      });
      return;
    }

    const completeAuth = async () => {
      try {
        setStatusMessage('Exchanging secure authentication credentials...');
        const res = await api.auth.exchangeGoogleTicket(ticket);
        
        setStatusMessage('Loading your capsule wardrobe...');
        await refreshData();

        showToast('Welcome to TailorBird! Signed in with Google.', 'success');
        const target = res.destination || destination || '/home';
        navigate(target, { replace: true });
      } catch (err: any) {
        const errorMsg = encodeURIComponent(
          err?.message || 'Google authentication failed or expired. Please sign in again.'
        );
        navigate(`/login?error=exchange_failed&message=${errorMsg}`, { replace: true });
      }
    };

    completeAuth();
  }, [navigate, searchParams, refreshData, showToast]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#121214] flex flex-col items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center shadow-sm space-y-4">
        {/* Loading Spinner */}
        <div className="flex justify-center">
          <div className="w-10 h-10 border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            TailorBird Authentication
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {statusMessage}
          </p>
        </div>
      </div>
    </div>
  );
};
