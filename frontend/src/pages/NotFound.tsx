import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F3EEE8] dark:bg-[#161218] text-[#29202B] dark:text-[#F3EEE8] flex flex-col justify-between p-6 sm:p-12 transition-colors duration-200">
      {/* Top Bar */}
      <header className="flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-[2px] bg-[#29202B] text-[#D5A6A0] flex items-center justify-center font-serif text-base font-semibold">
            T
          </span>
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#29202B] dark:text-[#F3EEE8]">
            TailorBird
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto w-full text-center py-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.2em] text-[#743C49] dark:text-[#D5A6A0] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] mb-6">
          <span>Error 404 · Page Not Found</span>
        </div>

        <h1 className="text-8xl sm:text-9xl font-serif text-[#29202B] dark:text-[#F3EEE8] mb-2">
          404
        </h1>

        <h2 className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] mb-4">
          This piece <span className="italic text-[#743C49] dark:text-[#D5A6A0]">does not exist.</span>
        </h2>

        <p className="text-xs text-[#777078] leading-relaxed max-w-md mx-auto mb-8 font-sans">
          The editorial look or atelier archive you are seeking has been archived, relocated, or never produced.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/home')}
            className="rounded-[2px] bg-[#743C49] hover:bg-[#5E2F3A] text-white font-mono text-[10px] uppercase tracking-[0.14em]"
            icon={<Home className="w-3.5 h-3.5" />}
          >
            Return to Feed
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/explore')}
            className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
            icon={<Compass className="w-3.5 h-3.5" />}
          >
            Explore
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => navigate(-1)}
            className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Go Back
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] font-mono uppercase tracking-[0.18em] text-[#777078] max-w-6xl mx-auto w-full pt-8 border-t border-[#DCD4CC] dark:border-[#392F3E]">
        TailorBird Atelier &middot; Occasion & Style Intelligence
      </footer>
    </div>
  );
};

export default NotFound;
