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
      barColor: 'bg-amber-600',
    },
    {
      label: 'Style Match',
      score: styleCompatibility,
      icon: Palette,
      detail: explanation?.styleMatch || 'Reflects your capsule aesthetic and favored palettes',
      barColor: 'bg-cognac-600',
    },
    {
      label: 'Occasion Alignment',
      score: occasionCompatibility,
      icon: Compass,
      detail: explanation?.occasionMatch || `Optimized for ${outfit.occasion}`,
      barColor: 'bg-emerald-600',
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Why This Outfit?"
      subtitle="AI Style Synthesis & Wardrobe Intelligence"
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Overall Score Badge */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-cognac-50 to-sand-100 border border-cognac-200/70">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-charcoal-900 text-cream-50 flex items-center justify-center font-serif text-xl font-bold shadow-soft">
              {score}%
            </div>
            <div>
              <h4 className="text-sm font-bold text-charcoal-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cognac-600" />
                Overall Recommendation Score
              </h4>
              <p className="text-xs text-charcoal-500">
                Determined across climate, taste signature, and capsule rotation.
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown Progress Bars */}
        <div className="space-y-4">
          <h5 className="text-xs font-bold uppercase tracking-wider text-charcoal-400">
            Compatibility Breakdown
          </h5>

          {compatibilityStats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.label} className="p-3.5 bg-sand-50 rounded-2xl border border-sand-200/70">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-cognac-700" />
                    <span className="text-xs font-bold text-charcoal-800">{stat.label}</span>
                  </div>
                  <span className="text-xs font-bold text-charcoal-900">{stat.score}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-sand-200 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full ${stat.barColor} rounded-full transition-all duration-700`}
                    style={{ width: `${stat.score}%` }}
                  />
                </div>

                <p className="text-[11px] text-charcoal-500 leading-snug">{stat.detail}</p>
              </div>
            );
          })}
        </div>

        {/* Reasons Checklist */}
        <div className="space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-wider text-charcoal-400">
            Key Style Decisions
          </h5>
          <div className="space-y-2">
            {reasons.map((reason, index) => (
              <div key={index} className="flex items-start gap-2.5 text-xs text-charcoal-800 bg-cream-50 p-2.5 rounded-xl border border-sand-200/60">
                <CheckCircle2 className="w-4 h-4 text-cognac-600 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wardrobe Utilization Note */}
        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-sand-100/70 text-charcoal-600 text-[11px] border border-sand-200">
          <Layers className="w-4 h-4 text-charcoal-500 flex-shrink-0" />
          <span>
            Utilizes {outfit.pieces.length} active pieces from your wardrobe to balance garment longevity and prevent wardrobe fatigue.
          </span>
        </div>
      </div>
    </Modal>
  );
};

