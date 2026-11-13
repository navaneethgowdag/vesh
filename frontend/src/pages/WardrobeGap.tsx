import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Shirt,
  Layers,
  Calendar,
  Palette,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Tag,
  Info,
  ExternalLink,
  Bookmark,
  Check,
  EyeOff,
  AlertCircle,
  ShoppingBag,
  Star,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EditorialPageHeader } from '../components/editorial/EditorialPageHeader';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { WardrobeGapAnalysis, WardrobeGapItem } from '../types';
import { cn } from '../utils/cn';

interface ShoppingProduct {
  id: string;
  title: string;
  brand: string;
  merchant: string;
  price: number;
  currency: string;
  image_url: string;
  product_url: string;
  category: string;
  color?: string;
  rating?: number;
  review_count?: number;
  budget_tier?: string;
  gap_id?: string;
  match_reason: string;
  is_saved: boolean;
  is_trending?: boolean;
}

export const WardrobeGap: React.FC = () => {
  const { showToast } = useApp();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<WardrobeGapAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Shopping Recommendations & Trending State
  const [shoppingRecs, setShoppingRecs] = useState<ShoppingProduct[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<ShoppingProduct[]>([]);
  const [providerStatus, setProviderStatus] = useState<any>(null);
  const [loadingShopping, setLoadingShopping] = useState<boolean>(false);

  // Active view tab: Gaps vs Shopping vs Trending
  const [activeTab, setActiveTab] = useState<'gaps' | 'shopping' | 'trending'>('gaps');

  const loadData = useCallback(async (force: boolean = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const [gapData, shopData, trendData] = await Promise.all([
        api.wardrobeGap.getAnalysis(force),
        api.wardrobeGap.getShoppingRecommendations(8),
        api.wardrobeGap.getTrending(6),
      ]);

      setAnalysis(gapData);
      if (shopData) {
        setShoppingRecs(shopData.recommendations || []);
        setProviderStatus(shopData.provider_status || null);
      }
      if (trendData) {
        setTrendingProducts(trendData.trending_products || []);
      }

      if (force) {
        showToast('Wardrobe gap & shopping analysis refreshed!', 'success');
      }
    } catch (err: any) {
      console.error('Failed to load wardrobe gap analysis:', err);
      showToast('Could not load complete wardrobe gap data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingShopping(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Product Actions
  const handleSaveProduct = async (prod: ShoppingProduct) => {
    try {
      await api.wardrobeGap.saveProduct(prod.id);
      setShoppingRecs((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, is_saved: true } : p))
      );
      setTrendingProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, is_saved: true } : p))
      );
      showToast(`Saved "${prod.title}" to your wishlist.`, 'success');
    } catch {
      showToast('Could not save product', 'info');
    }
  };

  const handleDismissProduct = async (prod: ShoppingProduct) => {
    try {
      await api.wardrobeGap.dismissProduct(prod.id);
      setShoppingRecs((prev) => prev.filter((p) => p.id !== prod.id));
      setTrendingProducts((prev) => prev.filter((p) => p.id !== prod.id));
      showToast('Recommendation dismissed.', 'info');
    } catch {
      showToast('Failed to dismiss item', 'info');
    }
  };

  const handleAlreadyOwn = async (prod: ShoppingProduct) => {
    try {
      await api.wardrobeGap.markAlreadyOwned(prod.id, prod.category);
      setShoppingRecs((prev) => prev.filter((p) => p.id !== prod.id));
      showToast('Noted! We have recorded that you already own this piece.', 'success');
    } catch {
      showToast('Could not update preference', 'info');
    }
  };

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case 'High':
        return (
          <span className="px-2.5 py-0.5 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.14em] bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0] border border-[#743C49]/30">
            High Priority
          </span>
        );
      case 'Medium':
        return (
          <span className="px-2.5 py-0.5 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.14em] bg-[#B49B82]/20 text-[#29202B] dark:text-[#DCD4CC] border border-[#B49B82]/40">
            Medium Priority
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.14em] bg-[#6D7068]/15 text-[#6D7068] dark:text-[#D5A6A0] border border-[#6D7068]/30">
            Low Priority
          </span>
        );
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 select-none space-y-6 pb-20">
        {/* Editorial Header */}
        <EditorialPageHeader
          eyebrow="CAPSULE INTELLIGENCE & ACQUISITION"
          title="Wardrobe Gap"
          italicTitle="Studio."
          description="Identifies missing essentials that unlock new outfits, with taste-ranked purchase recommendations."
          actions={
            <Button
              onClick={() => loadData(true)}
              isLoading={refreshing}
              variant="outline"
              className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em] border-[#DCD4CC] dark:border-[#392F3E] flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              <span>Refresh Analysis</span>
            </Button>
          }
        />

        {/* Provider Status Banner (Informative & Honest) */}
        {providerStatus && (
          <div className="p-4 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Info className="w-4 h-4 text-[#743C49] shrink-0" />
              <div>
                <span className="font-serif font-medium text-[#29202B] dark:text-[#F3EEE8]">
                  {providerStatus.provider_name}:{' '}
                </span>
                <span className="text-[#777078] dark:text-[#A89E9B]">{providerStatus.message}</span>
              </div>
            </div>
            {providerStatus.is_live_configured ? (
              <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.14em] px-2 py-0.5 rounded-[2px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50">
                Live API
              </span>
            ) : (
              <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.14em] px-2.5 py-0.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#2A222D] text-[#29202B] dark:text-[#F3EEE8] border border-[#DCD4CC] dark:border-[#392F3E]">
                Curated Mode
              </span>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-[2px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] text-xs overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveTab('gaps')}
            className={`px-4 py-2 rounded-[2px] text-[10px] font-mono uppercase tracking-[0.14em] transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'gaps'
                ? 'bg-[#29202B] text-[#F3EEE8] dark:bg-[#F3EEE8] dark:text-[#29202B] font-semibold'
                : 'text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Identified Gaps ({analysis?.gaps.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('shopping')}
            className={`px-4 py-2 rounded-[2px] text-[10px] font-mono uppercase tracking-[0.14em] transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'shopping'
                ? 'bg-[#29202B] text-[#F3EEE8] dark:bg-[#F3EEE8] dark:text-[#29202B] font-semibold'
                : 'text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Shopping Discovery {shoppingRecs.length > 0 ? `(${shoppingRecs.length})` : ''}</span>
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <RefreshCw className="w-8 h-8 text-[#743C49] animate-spin mb-4" />
            <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#777078] dark:text-[#A89E9B]">
              Analyzing accepted wardrobe items & catalog matches...
            </p>
          </div>
        ) : (
          <>
            {/* ------------------------------------------------------------- */}
            {/* TAB 1: IDENTIFIED WARDROBE GAPS */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'gaps' && (
              <div className="space-y-6">
                {/* Overview Stats Cards */}
                {analysis && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    <div className="bg-white dark:bg-[#1F1922] rounded-[3px] p-4 border border-[#DCD4CC] dark:border-[#392F3E]">
                      <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0] block">
                        Total Accepted Pieces
                      </span>
                      <div className="text-2xl font-serif text-[#29202B] dark:text-[#F3EEE8] mt-1">
                        {analysis.total_items}
                      </div>
                      <span className="text-[10px] text-[#777078] dark:text-[#A89E9B] font-mono uppercase tracking-[0.1em] mt-0.5 block">
                        active in closet
                      </span>
                    </div>

                    <div className="bg-white dark:bg-[#1F1922] rounded-[3px] p-4 border border-[#DCD4CC] dark:border-[#392F3E]">
                      <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0] block">
                        Identified Gaps
                      </span>
                      <div className="text-2xl font-serif text-[#29202B] dark:text-[#F3EEE8] mt-1">
                        {analysis.gaps.length}
                      </div>
                      <span className="text-[10px] text-[#777078] dark:text-[#A89E9B] font-mono uppercase tracking-[0.1em] mt-0.5 block">
                        {analysis.gaps.length === 0 ? 'Optimal versatility' : 'Actionable recommendations'}
                      </span>
                    </div>

                    <div className="bg-white dark:bg-[#1F1922] rounded-[3px] p-4 border border-[#DCD4CC] dark:border-[#392F3E]">
                      <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0] block">
                        Palette Tone
                      </span>
                      <div className="text-sm font-serif text-[#29202B] dark:text-[#F3EEE8] mt-2 truncate">
                        {analysis.color_distribution.neutrals} Neutrals / {analysis.color_distribution.accents} Accents
                      </div>
                      <span className="text-[10px] text-[#777078] dark:text-[#A89E9B] font-mono uppercase tracking-[0.1em] mt-0.5 block">
                        CIELAB harmony balance
                      </span>
                    </div>

                    <div className="bg-white dark:bg-[#1F1922] rounded-[3px] p-4 border border-[#DCD4CC] dark:border-[#392F3E]">
                      <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0] block">
                        Formality Balance
                      </span>
                      <div className="text-sm font-serif text-[#29202B] dark:text-[#F3EEE8] mt-2 truncate">
                        {analysis.formality_distribution.casual} Casual / {analysis.formality_distribution.formal} Formal
                      </div>
                      <span className="text-[10px] text-[#777078] dark:text-[#A89E9B] font-mono uppercase tracking-[0.1em] mt-0.5 block">
                        +{analysis.formality_distribution.smart_casual} Smart Casual
                      </span>
                    </div>
                  </div>
                )}

                {/* Gaps List */}
                {analysis?.gaps.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E]">
                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <h3 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
                      Your Wardrobe is Exceptionally Balanced!
                    </h3>
                    <p className="text-xs text-[#777078] dark:text-[#A89E9B] mt-1 max-w-sm mx-auto">
                      You have sufficient tops, bottoms, layers, and formal staples to cover all everyday and scheduled occasions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analysis?.gaps.map((gap: WardrobeGapItem, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-[#1F1922] rounded-[3px] p-6 border border-[#DCD4CC] dark:border-[#392F3E] transition-colors hover:border-[#743C49] space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-[2px] bg-[#FAF6F0] dark:bg-[#2A222D] text-[#743C49] dark:text-[#D5A6A0] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center font-mono text-xs font-semibold">
                              0{idx + 1}
                            </div>
                            <div>
                              <h3 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
                                {gap.title}
                              </h3>
                              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078]">{gap.category}</span>
                            </div>
                          </div>
                          {priorityBadge(gap.priority)}
                        </div>

                        <p className="text-xs sm:text-sm text-[#29202B] dark:text-[#F3EEE8] leading-relaxed">
                          {gap.reason}
                        </p>

                        <div className="p-3.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] text-xs text-[#777078] dark:text-[#A89E9B] border border-[#DCD4CC] dark:border-[#392F3E]">
                          <strong className="text-[#29202B] dark:text-[#F3EEE8] font-serif">Evidence: </strong>
                          {gap.evidence}
                        </div>

                        {gap.occasions.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#777078] dark:text-[#A89E9B]">Unlocks Occasions:</span>
                            {gap.occasions.map((occ) => (
                              <span
                                key={occ}
                                className="px-2.5 py-0.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#2A222D] text-[#743C49] dark:text-[#D5A6A0] font-mono text-[9px] uppercase tracking-[0.12em] border border-[#DCD4CC] dark:border-[#392F3E]"
                              >
                                {occ}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1.5 pt-2 border-t border-[#DCD4CC] dark:border-[#392F3E]">
                          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-[#777078] dark:text-[#A89E9B]">
                            Suggested Garments to Complete this Gap:
                          </span>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {gap.suggested_garments.map((garment, gIdx) => (
                              <span
                                key={gIdx}
                                className="text-xs px-3 py-1 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] text-[#29202B] dark:text-[#F3EEE8] font-mono border border-[#DCD4CC] dark:border-[#392F3E]"
                              >
                                {garment}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 2: RECOMMENDED FOR YOUR CLOSET */}
            {/* ------------------------------------------------------------- */}
            {activeTab === 'shopping' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-serif text-[#29202B] dark:text-[#F3EEE8]">
                    Shopping Discovery
                  </h2>
                  <p className="text-xs text-[#777078] dark:text-[#A89E9B] mt-0.5">
                    Live product recommendations require verified external shopping provider integration.
                  </p>
                </div>

                {shoppingRecs.length === 0 ? (
                  <div className="p-10 text-center bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] space-y-4">
                    <div className="w-12 h-12 rounded-[2px] bg-[#FAF6F0] dark:bg-[#2A222D] text-[#743C49] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center mx-auto">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1.5">
                      <h3 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
                        External Shopping Provider Unconfigured
                      </h3>
                      <p className="text-xs text-[#777078] dark:text-[#A89E9B] leading-relaxed">
                        TailorBird never fabricates synthetic products, dummy prices, or fake affiliate links. To browse live clothing items for your gaps, configure an external provider key (e.g., <code className="px-1.5 py-0.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] font-mono text-[11px]">SERPAPI_API_KEY</code>).
                      </p>
                      <p className="text-xs text-[#743C49] dark:text-[#D5A6A0] pt-2 font-mono uppercase tracking-[0.1em]">
                        Your missing wardrobe essentials are accurately detailed in the Identified Gaps tab.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('gaps')}
                      className="cursor-pointer rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
                    >
                      View Identified Gaps
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {shoppingRecs.map((prod) => (
                      <div
                        key={prod.id}
                        className="bg-white dark:bg-[#1F1922] rounded-[3px] overflow-hidden border border-[#DCD4CC] dark:border-[#392F3E] flex flex-col justify-between group transition-colors hover:border-[#743C49]"
                      >
                        <div>
                          {/* Image */}
                          <div className="aspect-square relative overflow-hidden bg-[#FAF6F0] dark:bg-[#241D27]">
                            <img
                              src={prod.image_url}
                              alt={prod.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <span className="absolute top-2.5 left-2.5 text-[9px] font-mono uppercase tracking-[0.14em] px-2 py-0.5 rounded-[2px] bg-[#29202B]/85 text-[#F3EEE8] backdrop-blur-xs">
                              {prod.brand}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="p-4 space-y-2">
                            <h4 className="text-xs font-serif text-[#29202B] dark:text-[#F3EEE8] line-clamp-2">
                              {prod.title}
                            </h4>

                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                                {prod.currency === 'INR' ? '₹' : '$'}
                                {prod.price.toLocaleString()}
                              </span>
                              {prod.rating && (
                                <span className="flex items-center gap-1 text-[11px] text-[#B49B82] font-mono">
                                  <Star className="w-3 h-3 fill-[#B49B82]" />
                                  {prod.rating}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-[#777078] dark:text-[#A89E9B] line-clamp-3 bg-[#FAF6F0] dark:bg-[#241D27] p-2.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E]">
                              <strong className="text-[#29202B] dark:text-[#F3EEE8] font-serif">Why: </strong>
                              {prod.match_reason}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="p-3 border-t border-[#DCD4CC] dark:border-[#392F3E] space-y-2">
                          <a
                            href={prod.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 px-3 rounded-[2px] bg-[#29202B] text-[#F3EEE8] dark:bg-[#F3EEE8] dark:text-[#29202B] text-[10px] font-mono uppercase tracking-[0.14em] flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer"
                          >
                            <span>View Product</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleSaveProduct(prod)}
                              className={`flex-1 py-1.5 rounded-[2px] border text-[10px] font-mono uppercase tracking-[0.12em] flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                                prod.is_saved
                                  ? 'bg-[#743C49]/15 text-[#743C49] border-[#743C49]/40'
                                  : 'border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] hover:border-[#743C49]'
                              }`}
                            >
                              <Bookmark className="w-3 h-3" />
                              <span>{prod.is_saved ? 'Saved' : 'Save'}</span>
                            </button>

                            <button
                              onClick={() => handleAlreadyOwn(prod)}
                              title="I already own a similar piece"
                              className="p-1.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDismissProduct(prod)}
                              title="Not interested"
                              className="p-1.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] text-[#777078] hover:text-[#743C49] transition-colors cursor-pointer"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
};
