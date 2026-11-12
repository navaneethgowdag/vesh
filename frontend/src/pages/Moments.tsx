import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { MomentsFeed } from '../components/moments/MomentsFeed';
import { AddMomentModal } from '../components/feed/AddMomentModal';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { OutfitMoment } from '../types';
import { useApp } from '../context/AppContext';

export const Moments: React.FC = () => {
  const { showToast } = useApp();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const handleMomentPublished = (_: OutfitMoment) => {
    showToast('Look published to 24-Hour Moments!', 'success');
  };

  return (
    <AppShell>
      <div className="space-y-6 pb-12 animate-fade-in max-w-2xl mx-auto">
        {/* Editorial Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#DCD4CC] dark:border-[#392F3E]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-mono uppercase tracking-widest bg-[#743C49]/10 text-[#743C49] dark:bg-[#743C49]/20 dark:text-[#D5A6A0] font-semibold border border-[#743C49]/20">
                24H Discovery
              </span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#29202B] dark:text-[#F3EEE8] tracking-tight">
              Community Moments
            </h1>
            <p className="text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] mt-1 font-sans">
              Discover real-time daily styling looks. Swipe right to appreciate, swipe left to pass.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
            className="self-start sm:self-auto shrink-0 font-mono text-xs"
          >
            Share Look
          </Button>
        </div>

        {/* Swipe Card Stack Area */}
        <div className="py-4">
          <MomentsFeed
            onShareMoment={() => setIsAddOpen(true)}
          />
        </div>

        {/* Add Moment Modal */}
        <AddMomentModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onSuccess={handleMomentPublished}
        />
      </div>
    </AppShell>
  );
};

export default Moments;
