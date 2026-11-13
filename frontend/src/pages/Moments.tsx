import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { EditorialPageHeader } from '../components/editorial/EditorialPageHeader';
import { MomentsFeed } from '../components/moments/MomentsFeed';
import { AddMomentModal } from '../components/feed/AddMomentModal';
import { Plus } from 'lucide-react';
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
      <div className="space-y-6 pb-12 animate-fade-in max-w-2xl mx-auto select-none">
        {/* Editorial Page Header */}
        <EditorialPageHeader
          eyebrow="24H EPHEMERAL DISCOVERY"
          title="Community"
          italicTitle="Moments."
          description="Discover real-time daily styling looks. Swipe right to appreciate, swipe left to pass."
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddOpen(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
              className="bg-[#743C49] hover:bg-[#5C2F3A] text-white rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
            >
              Share Look
            </Button>
          }
        />

        {/* Swipe Card Stack Area */}
        <div className="py-2">
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
