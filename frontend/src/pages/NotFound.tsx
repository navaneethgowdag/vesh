import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col justify-between p-6 sm:p-12 transition-colors duration-200">
      {/* Top Bar */}
      <header className="flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-sm font-bold">
            S
          </span>
          <span className="tracking-wide text-sm font-bold uppercase">
            StyleSphere
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto w-full text-center py-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mb-6">
          <span>Error 404 · Page Not Found</span>
        </div>

        <h1 className="text-7xl sm:text-9xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
          404
        </h1>

        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          This page does not exist.
        </h2>

        <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md mx-auto mb-8">
          The page you are looking for has been moved, deleted, or does not exist.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/home')}
            icon={<Home className="w-4 h-4" />}
          >
            Return to Feed
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/explore')}
            icon={<Compass className="w-4 h-4" />}
          >
            Explore
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => navigate(-1)}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Go Back
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-zinc-500 dark:text-zinc-400 max-w-6xl mx-auto w-full pt-8 border-t border-zinc-200 dark:border-zinc-800">
        StyleSphere © {new Date().getFullYear()} · All rights reserved.
      </footer>
    </div>
  );
};

export default NotFound;
