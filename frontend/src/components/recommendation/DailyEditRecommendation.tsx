import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  CloudSun,
  Shirt,
  RefreshCw,
  Check,
  Bookmark,
  ArrowRight,
  ArrowLeftRight,
  Layers,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Recommendation, Weather } from '../../types';
import { Button } from '../ui/Button';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import { api } from '../../services/api';

interface DailyEditRecommendationProps {
  dailyFit: Recommendation | null;
  weather: Weather | null;
  activeOccasion: string;
  isGenerating: boolean;
  wardrobeCount: number;
  onRegenerate: () => Promise<void>;
  onWear: () => Promise<void>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const DailyEditRecommendation: React.FC<DailyEditRecommendationProps> = ({
  dailyFit,
  weather,
  activeOccasion,
  isGenerating,
  wardrobeCount,
  onRegenerate,
  onWear,
  showToast,
}) => {
  const navigate = useNavigate();
  const [isRecordingWear, setIsRecordingWear] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const outfit = dailyFit?.outfit;
  const pieces = outfit?.pieces || [];
  const isWorn = dailyFit?.wornStatus === 'worn';

  // Handle Wear Action
  const handleWear = async () => {
    if (!dailyFit || isRecordingWear || isWorn) return;
    setIsRecordingWear(true);
    try {
      await onWear();
      confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
    } catch {
      showToast('Could not record wear.', 'info');
    } finally {
      setIsRecordingWear(false);
    }
  };

  // Handle Save Action
  const handleSave = async () => {
    if (!outfit?.id || isSaving) return;
    setIsSaving(true);
    try {
      if (isSaved) {
        setIsSaved(false);
        showToast('Outfit removed from saved collection.', 'info');
      } else {
        await api.saved.saveOutfit(outfit.id);
        setIsSaved(true);
        showToast('Outfit saved to your luxury vault.', 'success');
      }
    } catch {
      showToast('Could not update saved status.', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      {/* Editorial Section Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-[#EAE3D8] dark:border-[#36322D]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-[#75624D] dark:text-[#C2AB95]">
              THE DAILY EDIT
            </span>
            <span className="text-[#B8A99A]">·</span>
            <span className="text-[11px] font-sans text-[#A68B72] dark:text-[#B8A99A] italic">
              Personal Atelier
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-serif font-normal text-[#25231F] dark:text-[#F8F6F1] tracking-tight leading-tight">
            Your Style, for Today.
          </h2>
          <p className="text-xs sm:text-sm font-sans text-[#A68B72] dark:text-[#B8A99A] mt-1">
            A thoughtful edit from your personal wardrobe.
          </p>
        </div>

        {/* Ambient Weather Chip */}
        <div className="flex items-center gap-2.5 bg-[#FFFFFF] dark:bg-[#211E1B] border border-[#EAE3D8] dark:border-[#36322D] px-3.5 py-1.5 rounded-[2px] shadow-xs text-xs font-sans self-start sm:self-auto">
          <CloudSun className="w-4 h-4 text-[#75624D] dark:text-[#C2AB95]" />
          <span className="font-semibold text-[#25231F] dark:text-[#F8F6F1] font-mono">
            {weather?.city ? `${weather.city} · ${weather.temp}°C` : '22°C · Pleasant'}
          </span>
        </div>
      </div>

      {/* Main Recommendation Frame */}
      <div className="rounded-[4px] bg-[#FFFFFF] dark:bg-[#211E1B] border border-[#EAE3D8] dark:border-[#36322D] shadow-xs overflow-hidden transition-all">
        {/* Editorial Header Ribbon */}
        <div className="bg-[#25231F] dark:bg-[#181614] px-6 sm:px-8 py-3.5 text-[#F8F6F1] flex items-center justify-between border-b border-[#36322D]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#75624D] dark:bg-[#C2AB95] animate-pulse" />
            <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-[#F8F6F1]">
              Recommended Look
            </span>
            <span className="text-[#A68B72]">·</span>
            <span className="text-xs text-[#EAE3D8] font-serif italic">
              {activeOccasion || outfit?.occasion || 'Everyday Capsule'}
            </span>
          </div>

          {dailyFit?.score && dailyFit.score > 0 ? (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-[2px] bg-white/10 text-[#F8F6F1] border border-white/20">
              {dailyFit.score}% Affinity Match
            </span>
          ) : null}
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* EMPTY STATE 1: WARDROBE EMPTY */}
          {wardrobeCount === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-12 h-12 rounded-[2px] bg-[#F8F6F1] dark:bg-[#181614] border border-[#EAE3D8] dark:border-[#36322D] flex items-center justify-center mx-auto text-[#75624D] dark:text-[#C2AB95]">
                <Shirt className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-2xl text-[#25231F] dark:text-[#F8F6F1]">
                  Your Wardrobe is Waiting
                </h3>
                <p className="text-xs sm:text-sm text-[#A68B72] dark:text-[#B8A99A] max-w-sm mx-auto font-sans leading-relaxed">
                  Upload your clothing pieces to activate personal AI daily styling recommendations.
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/wardrobe')}
                className="font-sans uppercase tracking-[0.16em] text-xs !bg-[#25231F] hover:!bg-[#75624D] !text-white"
              >
                Upload Your First Piece
              </Button>
            </div>
          ) : isGenerating && !dailyFit ? (
            // GENERATING LOADING STATE
            <div className="text-center py-14 space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#75624D] border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-[#A68B72] dark:text-[#B8A99A] font-sans uppercase tracking-[0.16em]">
                Curating your personal ensemble...
              </p>
            </div>
          ) : dailyFit?.status === 'no_items' ? (
            // EMPTY STATE 2: NO SUITABLE PIECES FOR OCCASION
            <div className="text-center py-12 space-y-4">
              <div className="w-12 h-12 rounded-[2px] bg-[#F8F6F1] dark:bg-[#181614] border border-[#EAE3D8] dark:border-[#36322D] flex items-center justify-center mx-auto text-[#75624D] dark:text-[#C2AB95]">
                <Shirt className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif text-2xl text-[#25231F] dark:text-[#F8F6F1]">
                  No suitable pieces found for {activeOccasion || 'Everyday'}
                </h3>
                <p className="text-xs sm:text-sm text-[#A68B72] dark:text-[#B8A99A] max-w-sm mx-auto mt-1 font-sans leading-relaxed">
                  {dailyFit.emptyReason?.message ||
                    `Your wardrobe has no verified items suitable for ${activeOccasion || 'Everyday'} yet.`}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-1 flex-wrap">
                {dailyFit.emptyReason?.action === 'review_pending' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/wardrobe?tab=pending')}
                    className="font-sans uppercase tracking-[0.14em] text-xs !bg-[#25231F] !text-white"
                  >
                    Review Pending Garments
                  </Button>
                ) : dailyFit.emptyReason?.action === 'laundry' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/wardrobe?tab=accepted')}
                    className="font-sans uppercase tracking-[0.14em] text-xs border-[#B8A99A]"
                  >
                    Check Laundry Status
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate('/wardrobe')}
                      className="font-sans uppercase tracking-[0.14em] text-xs !bg-[#25231F] !text-white"
                    >
                      Add Clothing Pieces
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/wardrobe-gap')}
                      className="font-sans uppercase tracking-[0.14em] text-xs border-[#B8A99A]"
                    >
                      View Wardrobe Gap
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : outfit && pieces.length > 0 ? (
            // SUCCESSFUL RECOMMENDATION VIEW
            <>
              {/* Look Header & Stylist Note */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-serif text-[#25231F] dark:text-[#F8F6F1] tracking-tight">
                    {outfit.title || 'Curated Contemporary Look'}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A68B72] dark:text-[#B8A99A] mt-1 leading-relaxed font-sans max-w-2xl">
                    {dailyFit?.reasons?.[0] ||
                      'Color-coordinated palette tailored for your lifestyle and ambient weather context.'}
                  </p>
                </div>

                <button
                  onClick={() => navigate('/daily-fit')}
                  className="text-xs font-semibold self-start sm:self-auto text-[#75624D] dark:text-[#C2AB95] hover:text-[#25231F] dark:hover:text-[#F8F6F1] font-sans flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Daily Fit Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Garment Composition Gallery (Editorial Cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {pieces.map((piece) => {
                  const pieceImg =
                    resolveImageUrl(piece.preferredImageUrl || piece.image) || FALLBACK_POST_IMAGE;
                  return (
                    <div
                      key={piece.id}
                      onClick={() => navigate('/daily-fit')}
                      className="rounded-[3px] border border-[#EAE3D8] dark:border-[#36322D] overflow-hidden bg-[#F8F6F1] dark:bg-[#181614] cursor-pointer group hover:border-[#75624D] dark:hover:border-[#C2AB95] transition-all duration-200 shadow-xs"
                    >
                      <div className="aspect-[3/4] bg-[#EAE3D8] dark:bg-[#181614] overflow-hidden relative">
                        <img
                          src={pieceImg}
                          alt={piece.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                        {piece.color && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-[1px] bg-[#25231F]/80 backdrop-blur-xs text-[9px] font-sans uppercase tracking-[0.14em] text-white">
                            {piece.color}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-[#75624D] dark:text-[#C2AB95] truncate">
                          {piece.category || 'Piece'}
                        </p>
                        <p className="text-xs font-semibold text-[#25231F] dark:text-[#F8F6F1] truncate mt-0.5 font-sans">
                          {piece.name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Toolbar */}
              <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EAE3D8] dark:border-[#36322D]">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Primary Action: View Outfit */}
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => navigate('/daily-fit')}
                    className="font-sans uppercase tracking-[0.14em] text-xs !bg-[#25231F] hover:!bg-[#75624D] !text-white"
                  >
                    View Outfit
                  </Button>

                  {/* Secondary Action: Wear This Outfit */}
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleWear}
                    disabled={isRecordingWear || isWorn || dailyFit?.canWear === false}
                    className={`${isWorn ? '!bg-emerald-700 !text-white' : '!bg-[#EAE3D8] dark:!bg-[#2A2622] !text-[#25231F] dark:!text-[#F8F6F1]'} font-sans uppercase tracking-[0.12em] text-xs`}
                    icon={isWorn ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  >
                    {isWorn ? '✓ Worn Today' : 'Wear This Outfit'}
                  </Button>

                  {/* Secondary Action: Regenerate */}
                  <Button
                    variant="outline"
                    size="md"
                    onClick={onRegenerate}
                    disabled={isGenerating}
                    className="font-sans uppercase tracking-[0.12em] text-xs border-[#B8A99A] dark:border-[#4A443E]"
                    icon={<RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />}
                  >
                    Regenerate
                  </Button>

                  {/* Secondary Action: Save */}
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`font-sans uppercase tracking-[0.12em] text-xs border-[#B8A99A] dark:border-[#4A443E] ${isSaved ? '!text-[#75624D] dark:!text-[#C2AB95]' : ''}`}
                    icon={<Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />}
                  >
                    {isSaved ? 'Saved' : 'Save'}
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate('/daily-fit')}
                    className="text-xs font-sans font-semibold text-[#75624D] dark:text-[#C2AB95] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Swap a Piece</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
};
