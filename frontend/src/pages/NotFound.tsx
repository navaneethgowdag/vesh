import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, Home, Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-luxury-bg dark:bg-luxury-dark-bg text-luxury-text dark:text-luxury-dark-text flex flex-col justify-between p-6 sm:p-12 transition-colors duration-300">
      {/* Top Bar */}
      <header className="flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-luxury-espresso dark:bg-luxury-dark-champagne text-white dark:text-luxury-dark-espresso flex items-center justify-center font-serif text-sm font-bold">
            S
          </span>
          <span className="font-serif tracking-widest text-sm font-semibold uppercase">
            StyleSphere Atelier
          </span>
        </div>
      </header>

      {/* Main Editorial Content */}
      <main className="max-w-xl mx-auto w-full text-center py-12">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest text-luxury-champagne dark:text-luxury-dark-champagne bg-luxury-surface dark:bg-luxury-dark-surface border border-luxury-champagne/30 mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Error 404 · Uncharted Silhouette</span>
        </span>

        <h1 className="font-serif text-7xl sm:text-9xl font-bold tracking-tight text-luxury-espresso dark:text-luxury-dark-champagne mb-4">
          404
        </h1>

        <h2 className="font-serif text-2xl sm:text-3xl font-medium text-luxury-text dark:text-luxury-dark-text mb-4">
          This look has departed the atelier.
        </h2>

        <p className="text-sm sm:text-base text-luxury-textMuted dark:text-luxury-dark-textMuted leading-relaxed max-w-md mx-auto mb-8 font-sans">
          The runway you are seeking is either private, expired, or has moved to another collection.
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
            icon={<Compass className="w-4 h-4 text-luxury-champagne" />}
          >
            Explore Trends
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
      <footer className="text-center text-xs text-luxury-textMuted/60 dark:text-luxury-dark-textMuted/60 max-w-6xl mx-auto w-full pt-8 border-t border-luxury-border/60 dark:border-luxury-dark-border/60 font-serif">
        StyleSphere © {new Date().getFullYear()} · High Fashion Digital Wardrobe & Atelier
      </footer>
    </div>
  );
};

export default NotFound;
