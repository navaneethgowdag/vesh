import React from 'react';
import { Sparkles } from 'lucide-react';

export const LuxuryPageLoader: React.FC = () => {
  return (
    <div className="min-h-screen bg-sand-50 dark:bg-charcoal-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full border-2 border-cognac-200 dark:border-cognac-900 border-t-cognac-600 dark:border-t-cognac-400 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-cognac-600 dark:text-cognac-400 animate-pulse" />
        </div>
      </div>
      <h2 className="font-serif text-xl tracking-wider text-charcoal-900 dark:text-sand-100 font-semibold mb-2">
        STYLESPHERE
      </h2>
      <p className="text-xs uppercase tracking-widest text-charcoal-500 dark:text-sand-400 font-medium">
        Curating Wardrobe &amp; Intelligence
      </p>
    </div>
  );
};
