import React from 'react';
import { CheckCircle2, Sparkles, Thermometer, Palette, Compass, Layers } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Recommendation } from '../../types';

interface WhyThisOutfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: Recommendation | null;
}

export const WhyThisOutfitModal: React.FC<WhyThisOutfitModalProps> = ({
  isOpen,
  onClose,
  recommendation,
}) => {
  if (!recommendation) return null;

  const { score, weatherCompatibility, styleCompatibility, occasionCompatibility, explanation, reasons, outfit } =
    recommendation;

  const compatibilityStats = [
    {
      label: 'Weather Compatibility',
      score: weatherCompatibility,
      icon: Thermometer,
      detail: explanation?.weatherMatch || "Calibrated for today's local climate",
      barColor: 'bg-zinc-800 dark:bg-zinc-200',
    },
    {
      label: 'Style Match',
      score: styleCompatibility,
      icon: Palette,
      detail: explanation?.styleMatch || 'Reflects your capsule aesthetic and favored palettes',
      barColor: 'bg-zinc-800 dark:bg-zinc-200',
    },
    {
      label: 'Occasion Alignment',
      score: occasionCompatibility,
      icon: Compass,
      detail: explanation?.occasionMatch || `Optimized for ${outfit.occasion}`,
      barColor: 'bg-zinc-800 dark:bg-zinc-200',
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Why This Outfit?"
      subtitle="Style Synthesis & Wardrobe Intelligence"
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Overall Score Badge */}
        <div className="flex items-center justify-between p-4 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xl font-bold">
              {score}%
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                Overall Recommendation Score
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Determined across climate, taste signature, and capsule rotation.
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown Progress Bars */}
        <div className="space-y-4">
          <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Compatibility Breakdown
          </h5>

          {compatibilityStats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.label} className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-md border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{stat.label}</span>
                  </div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{stat.score}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded overflow-hidden mb-2">
                  <div
                    className={`h-full ${stat.barColor} rounded transition-all duration-500`}
                    style={{ width: `${stat.score}%` }}
                  />
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-snug">{stat.detail}</p>
              </div>
            );
          })}
        </div>

        {/* Reasons Checklist */}
        <div className="space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Key Style Decisions
          </h5>
          <div className="space-y-2">
            {reasons.map((reason, index) => (
              <div key={index} className="flex items-start gap-2.5 text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800">
                <CheckCircle2 className="w-4 h-4 text-zinc-600 dark:text-zinc-400 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wardrobe Utilization Note */}
        <div className="flex items-center gap-2.5 p-3 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs border border-zinc-200 dark:border-zinc-700">
          <Layers className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <span>
            Utilizes {outfit.pieces.length} active pieces from your wardrobe to balance garment longevity and prevent wardrobe fatigue.
          </span>
        </div>
      </div>
    </Modal>
  );
};
