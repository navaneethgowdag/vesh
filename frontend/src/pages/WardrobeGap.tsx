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
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            High Priority
          </span>
        );
      case 'Medium':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
            Medium Priority
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
            Low Priority
          </span>
        );
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8 select-none space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800/40">
                Wardrobe Intelligence & Shopping
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Wardrobe Gap & Shopping Discovery
            </h1>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Identifies missing essentials that unlock new outfits, with taste-ranked purchase recommendations.
            </p>
          </div>

          <Button
            onClick={() => loadData(true)}
            isLoading={refreshing}
            variant="outline"
            className="flex items-center gap-1.5 shadow-xs self-start md:self-auto"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            <span>Refresh Analysis</span>
          </Button>
        </div>

        {/* Provider Status Banner (Informative & Honest) */}
        {providerStatus && (
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-zinc-500 shrink-0" />
              <div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {providerStatus.provider_name}:{' '}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">{providerStatus.message}</span>
              </div>
            </div>
            {providerStatus.is_live_configured ? (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                Live API
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                Curated Mode
              </span>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('gaps')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'gaps'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Identified Gaps ({analysis?.gaps.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('shopping')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'shopping'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Shopping Discovery {shoppingRecs.length > 0 ? `(${shoppingRecs.length})` : ''}</span>
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-10 h-10 border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
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
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Total Accepted Pieces
                      </span>
                      <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
                        {analysis.total_items}
                      </div>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 block">
                        active in capsule closet
                      </span>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Identified Gaps
                      </span>
                      <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
                        {analysis.gaps.length}
                      </div>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 block">
                        {analysis.gaps.length === 0 ? 'Optimal versatility' : 'Actionable recommendations'}
                      </span>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Palette Tone
                      </span>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-2 truncate">
                        {analysis.color_distribution.neutrals} Neutrals / {analysis.color_distribution.accents} Accents
                      </div>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 block">
                        CIELAB harmony balance
                      </span>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Formality Balance
                      </span>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-2 truncate">
                        {analysis.formality_distribution.casual} Casual / {analysis.formality_distribution.formal} Formal
                      </div>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 block">
                        +{analysis.formality_distribution.smart_casual} Smart Casual
                      </span>
                    </div>
                  </div>
                )}

                {/* Gaps List */}
                {analysis?.gaps.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      Your Wardrobe is Exceptionally Balanced!
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                      You have sufficient tops, bottoms, layers, and formal staples to cover all everyday and scheduled occasions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analysis?.gaps.map((gap: WardrobeGapItem, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                              {idx + 1}
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                                {gap.title}
                              </h3>
                              <span className="text-xs text-zinc-500">{gap.category}</span>
                            </div>
                          </div>
                          {priorityBadge(gap.priority)}
                        </div>

                        <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                          {gap.reason}
                        </p>

                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 text-xs text-zinc-600 dark:text-zinc-400">
                          <strong className="text-zinc-800 dark:text-zinc-200">Evidence: </strong>
                          {gap.evidence}
                        </div>

                        {gap.occasions.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="font-semibold text-zinc-500">Unlocks Occasions:</span>
                            {gap.occasions.map((occ) => (
                              <span
                                key={occ}
                                className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-medium border border-indigo-200 dark:border-indigo-800/40"
                              >
                                {occ}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Suggested Garments to Complete this Gap:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {gap.suggested_garments.map((garment, gIdx) => (
                              <span
                                key={gIdx}
                                className="text-xs px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium border border-zinc-200 dark:border-zinc-700"
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
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Shopping Discovery
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Live product recommendations require verified external shopping provider integration.
                  </p>
                </div>

                {shoppingRecs.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                    <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1.5">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        External Shopping Provider Unconfigured
                      </h3>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        TailorBird never fabricates synthetic products, dummy prices, or fake affiliate links. To browse live clothing items for your gaps, configure an external provider key (e.g., <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px]">SERPAPI_API_KEY</code>).
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 pt-2 font-medium">
                        Your missing wardrobe essentials are accurately detailed in the Identified Gaps tab.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('gaps')}
                      className="cursor-pointer"
                    >
                      View Identified Gaps
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {shoppingRecs.map((prod) => (
                      <div
                        key={prod.id}
                        className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between group"
                      >
                        <div>
                          {/* Image */}
                          <div className="aspect-square relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                            <img
                              src={prod.image_url}
                              alt={prod.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/70 text-white backdrop-blur-md">
                              {prod.brand}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="p-4 space-y-2">
                            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                              {prod.title}
                            </h4>

                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold text-zinc-900 dark:text-zinc-100">
                                {prod.currency === 'INR' ? '₹' : '$'}
                                {prod.price.toLocaleString()}
                              </span>
                              {prod.rating && (
                                <span className="flex items-center gap-1 text-[11px] text-amber-500 font-bold">
                                  <Star className="w-3 h-3 fill-amber-500" />
                                  {prod.rating}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-3 bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded-lg">
                              <strong className="text-zinc-800 dark:text-zinc-200">Why: </strong>
                              {prod.match_reason}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                          <a
                            href={prod.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 px-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                          >
                            <span>View Product</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleSaveProduct(prod)}
                              className={`flex-1 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                                prod.is_saved
                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border-rose-300'
                                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <Bookmark className="w-3 h-3" />
                              <span>{prod.is_saved ? 'Saved' : 'Save'}</span>
                            </button>

                            <button
                              onClick={() => handleAlreadyOwn(prod)}
                              title="I already own a similar piece"
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-emerald-600 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDismissProduct(prod)}
                              title="Not interested"
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-rose-600 transition-colors"
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
