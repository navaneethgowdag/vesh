import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart2,
  PieChart,
  Shirt,
  Sparkles,
  TrendingUp,
  Layers,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Award,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';

interface GapAnalysisData {
  total_items: number;
  category_distribution: Record<string, number>;
  formality_distribution: Record<string, number>;
  color_distribution: {
    neutrals?: number;
    accents?: number;
    breakdown?: Record<string, number>;
  };
  occasions_distribution: Record<string, number>;
  wear_stats: {
    recently_worn?: number;
    never_or_rarely_worn?: number;
  };
  gaps: Array<{
    category: string;
    title: string;
    priority: string;
    reason: string;
    evidence: string;
    occasions: string[];
    suggested_garments: string[];
    confidence: number;
  }>;
  last_analyzed_at: string;
  is_balanced: boolean;
}

export const WardrobeInsights: React.FC = () => {
  const { wardrobe, showToast } = useApp();
  const [data, setData] = useState<GapAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadInsights = async (force: boolean = false) => {
    if (force) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await api.wardrobe.getGapAnalysis(force);
      setData(res);
    } catch (err: any) {
      showToast(err?.message || 'Could not load wardrobe insights', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  // Compute live metrics from wardrobe inventory
  const activeItems = useMemo(() => wardrobe.filter((i) => !i.reviewRequired), [wardrobe]);
  const pendingReviewCount = useMemo(() => wardrobe.filter((i) => i.reviewRequired).length, [wardrobe]);

  // Color breakdown calculations
  const colorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activeItems.forEach((i) => {
      const col = (i.color || 'Unspecified').trim();
      counts[col] = (counts[col] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [activeItems]);

  // Formality breakdown
  const formalityScores = useMemo(() => {
    let casual = 0;
    let smartCasual = 0;
    let formal = 0;

    activeItems.forEach((i) => {
      const f = typeof i.formality === 'number' ? i.formality : 0.4;
      if (f < 0.4) casual++;
      else if (f <= 0.7) smartCasual++;
      else formal++;
    });

    const total = activeItems.length || 1;
    return {
      casual: Math.round((casual / total) * 100),
      smartCasual: Math.round((smartCasual / total) * 100),
      formal: Math.round((formal / total) * 100),
      counts: { casual, smartCasual, formal },
    };
  }, [activeItems]);

  // Category distribution
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activeItems.forEach((i) => {
      const cat = (i.category || 'Other').trim();
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [activeItems]);

  // Health Score Calculation
  const healthScore = useMemo(() => {
    if (activeItems.length === 0) return 20;
    let score = 50;
    if (activeItems.length >= 10) score += 15;
    else if (activeItems.length >= 5) score += 8;

    // Has tops and bottoms
    const hasTops = activeItems.some((i) => /shirt|top|tee|sweater|polo/i.test(i.category || ''));
    const hasBottoms = activeItems.some((i) => /jean|pant|trouser|skirt|short/i.test(i.category || ''));
    const hasFootwear = activeItems.some((i) => /shoe|sneaker|heel|boot|sandal/i.test(i.category || ''));

    if (hasTops && hasBottoms) score += 15;
    if (hasFootwear) score += 10;
    if (data?.is_balanced) score += 10;

    return Math.min(score, 100);
  }, [activeItems, data]);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2DDD3] dark:border-[#2D342F]">
          <div>
            <span className="text-xs uppercase tracking-widest font-semibold text-[#777C75] dark:text-[#A3ABA0] block mb-1">
              Analytics & Intelligence
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#202321] dark:text-[#F8F6F1] tracking-tight">
              Wardrobe Insights
            </h1>
            <p className="text-xs sm:text-sm text-[#777C75] dark:text-[#A3ABA0] mt-1 font-sans">
              Deep analytics on your wardrobe distribution, color harmony, formality balance, and styling readiness.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadInsights(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 self-start sm:self-auto shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Analytics</span>
          </Button>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-xs">
            <div className="flex items-center justify-between text-[#777C75] dark:text-[#A3ABA0] mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Cataloged Items</span>
              <Shirt className="w-4 h-4 text-[#727D69]" />
            </div>
            <p className="text-2xl font-bold font-mono text-[#202321] dark:text-[#F8F6F1]">{activeItems.length}</p>
            <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-0.5">
              {pendingReviewCount > 0 ? `${pendingReviewCount} pending AI review` : 'All accepted'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-xs">
            <div className="flex items-center justify-between text-[#777C75] dark:text-[#A3ABA0] mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Health Index</span>
              <Award className="w-4 h-4 text-[#B5AA99]" />
            </div>
            <p className="text-2xl font-bold font-mono text-[#202321] dark:text-[#F8F6F1]">{healthScore} / 100</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
              {healthScore >= 80 ? 'Highly Versatile' : healthScore >= 60 ? 'Well Balanced' : 'Building Essentials'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-xs">
            <div className="flex items-center justify-between text-[#777C75] dark:text-[#A3ABA0] mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Distinct Colors</span>
              <PieChart className="w-4 h-4 text-[#727D69]" />
            </div>
            <p className="text-2xl font-bold font-mono text-[#202321] dark:text-[#F8F6F1]">{colorCounts.length}</p>
            <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-0.5">Palettes cataloged</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-xs">
            <div className="flex items-center justify-between text-[#777C75] dark:text-[#A3ABA0] mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Identified Gaps</span>
              <Layers className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-bold font-mono text-[#202321] dark:text-[#F8F6F1]">
              {data?.gaps ? data.gaps.length : 0}
            </p>
            <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-0.5">Opportunities to unlock fits</p>
          </div>
        </div>

        {/* Section 1: Formality & Readiness Spectrum */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#727D69]" />
              <h2 className="text-base font-serif font-bold text-[#202321] dark:text-[#F8F6F1]">
                Formality & Lifestyle Balance
              </h2>
            </div>
            <span className="text-xs font-mono text-[#777C75] dark:text-[#A3ABA0] font-medium">100% Total Wardrobe</span>
          </div>

          {/* Formality Progress Bar */}
          <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-[#E9E6DE] dark:bg-[#242A25]">
            <div
              style={{ width: `${formalityScores.casual}%` }}
              className="bg-[#899783] transition-all duration-500"
              title={`Casual: ${formalityScores.casual}%`}
            />
            <div
              style={{ width: `${formalityScores.smartCasual}%` }}
              className="bg-[#727D69] transition-all duration-500"
              title={`Smart Casual: ${formalityScores.smartCasual}%`}
            />
            <div
              style={{ width: `${formalityScores.formal}%` }}
              className="bg-[#202321] dark:bg-[#F8F6F1] transition-all duration-500"
              title={`Formal / Evening: ${formalityScores.formal}%`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 text-center pt-2">
            <div className="p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F]">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#899783] mr-1.5" />
              <span className="text-xs font-semibold text-[#202321] dark:text-[#F8F6F1]">Casual</span>
              <p className="text-lg font-bold font-mono text-[#727D69] dark:text-[#A3ABA0] mt-0.5">
                {formalityScores.casual}%
              </p>
              <p className="text-[11px] text-[#777C75] dark:text-[#A3ABA0]">
                {formalityScores.counts.casual} items
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F]">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#727D69] mr-1.5" />
              <span className="text-xs font-semibold text-[#202321] dark:text-[#F8F6F1]">Smart Casual</span>
              <p className="text-lg font-bold font-mono text-[#727D69] dark:text-[#A3ABA0] mt-0.5">
                {formalityScores.smartCasual}%
              </p>
              <p className="text-[11px] text-[#777C75] dark:text-[#A3ABA0]">
                {formalityScores.counts.smartCasual} items
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F]">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#202321] dark:bg-[#F8F6F1] mr-1.5" />
              <span className="text-xs font-semibold text-[#202321] dark:text-[#F8F6F1]">Formal</span>
              <p className="text-lg font-bold font-mono text-[#202321] dark:text-[#F8F6F1] mt-0.5">
                {formalityScores.formal}%
              </p>
              <p className="text-[11px] text-[#777C75] dark:text-[#A3ABA0]">
                {formalityScores.counts.formal} items
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Category Distribution & Color Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Categories */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-xs space-y-4">
            <h3 className="text-base font-serif font-bold text-[#202321] dark:text-[#F8F6F1]">
              Garment Categories
            </h3>
            <div className="space-y-3">
              {categoryCounts.length === 0 ? (
                <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] py-4 text-center">
                  No accepted items in your wardrobe yet.
                </p>
              ) : (
                categoryCounts.map(([cat, count]) => {
                  const pct = Math.round((count / (activeItems.length || 1)) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-[#202321] dark:text-[#F8F6F1] capitalize">{cat}</span>
                        <span className="text-[#777C75] dark:text-[#A3ABA0] font-mono">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#E9E6DE] dark:bg-[#242A25] overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-[#202321] dark:bg-[#F8F6F1] rounded-full"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Color Palettes */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-xs space-y-4">
            <h3 className="text-base font-serif font-bold text-[#202321] dark:text-[#F8F6F1]">
              Top Colors in Rotation
            </h3>
            <div className="space-y-3">
              {colorCounts.length === 0 ? (
                <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] py-4 text-center">
                  No color data cataloged yet.
                </p>
              ) : (
                colorCounts.map(([color, count]) => {
                  const pct = Math.round((count / (activeItems.length || 1)) * 100);
                  return (
                    <div key={color} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-[#202321] dark:text-[#F8F6F1] capitalize">{color}</span>
                        <span className="text-[#777C75] dark:text-[#A3ABA0] font-mono">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#E9E6DE] dark:bg-[#242A25] overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-[#899783] rounded-full"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Occasion Readiness Matrix */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#727D69]" />
            <h3 className="text-base font-serif font-bold text-[#202321] dark:text-[#F8F6F1]">
              Occasion Readiness
            </h3>
          </div>
          <p className="text-xs text-[#777C75] dark:text-[#A3ABA0]">
            How prepared your current inventory is to assemble cohesive outfits for common occasions:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {[
              {
                occasion: 'Everyday / Casual',
                ready: activeItems.length >= 3,
                label: activeItems.length >= 3 ? 'Ready' : 'Incomplete',
              },
              {
                occasion: 'Office & Meetings',
                ready: formalityScores.counts.smartCasual + formalityScores.counts.formal >= 2,
                label:
                  formalityScores.counts.smartCasual + formalityScores.counts.formal >= 2
                    ? 'Ready'
                    : 'Needs Staples',
              },
              {
                occasion: 'Parties & Dates',
                ready: activeItems.some((i) => /chic|party|formal|dress/i.test((i.style || '') + (i.category || ''))),
                label: activeItems.some((i) => /chic|party|formal|dress/i.test((i.style || '') + (i.category || '')))
                  ? 'Ready'
                  : 'Needs Accent',
              },
              {
                occasion: 'Weddings & Festive',
                ready: activeItems.some((i) => /saree|lehenga|kurta|kurti|sherwani/i.test((i.category || '') + ((i as any).subcategory || ''))),
                label: activeItems.some((i) => /saree|lehenga|kurta|kurti|sherwani/i.test((i.category || '') + ((i as any).subcategory || '')))
                  ? 'Ready'
                  : 'Gap Detected',
              },
            ].map((item) => (
              <div
                key={item.occasion}
                className="p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#202321] dark:text-[#F8F6F1]">{item.occasion}</span>
                  {item.ready ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block self-start ${
                    item.ready
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
};
