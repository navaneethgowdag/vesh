import React, { useState } from 'react';
import { api } from '../../services/api';

interface GoogleSignInButtonProps {
  label?: string;
  destination?: string;
  action?: 'login' | 'signup' | 'link';
  disabled?: boolean;
  className?: string;
  onError?: (error: string) => void;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  label = 'Continue with Google',
  destination = '/home',
  action = 'login',
  disabled = false,
  className = '',
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleClick = async () => {
    if (disabled || isLoading) return;
    setIsLoading(true);

    try {
      const { authorization_url } = await api.auth.getGoogleAuthUrl(destination, action);
      if (authorization_url) {
        // Redirect browser to Google OAuth consent screen
        window.location.href = authorization_url;
      } else {
        throw new Error('Could not obtain Google authorization URL');
      }
    } catch (err: any) {
      setIsLoading(false);
      const message = err?.message || 'Google sign-in is currently unavailable.';
      if (onError) {
        onError(message);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleClick}
      disabled={disabled || isLoading}
      aria-label={label}
      className={`w-full min-h-[44px] px-4 py-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 
        bg-white dark:bg-zinc-800/90 hover:bg-zinc-50 dark:hover:bg-zinc-800 
        text-zinc-700 dark:text-zinc-200 text-sm font-medium 
        flex items-center justify-center gap-3 
        shadow-sm transition-all duration-150 
        focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:ring-offset-1 
        disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <div className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-zinc-600 dark:text-zinc-300"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Connecting to Google...</span>
        </div>
      ) : (
        <>
          {/* Standard Google 'G' Logo with Official Palette */}
          <svg
            className="w-4 h-4 flex-shrink-0"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          <span className="font-medium tracking-tight">{label}</span>
        </>
      )}
    </button>
  );
};
