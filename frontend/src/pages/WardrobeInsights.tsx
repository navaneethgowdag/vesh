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
import { EditorialPageHeader } from '../components/editorial/EditorialPageHeader';
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 space-y-8 select-none">
        {/* Editorial Header */}
        <EditorialPageHeader
          eyebrow="ANALYTICS & PORTFOLIO INTELLIGENCE"
          title="Wardrobe"
          italicTitle="Insights."
          description="Deep analytics on your wardrobe distribution, color harmony, formality balance, and styling readiness."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadInsights(true)}
              disabled={isRefreshing}
              className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em] border-[#DCD4CC] dark:border-[#392F3E] flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Analytics</span>
            </Button>
          }
        />

        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E]">
            <div className="flex items-center justify-between text-[#777078] dark:text-[#D5A6A0] mb-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em]">Cataloged Items</span>
              <Shirt className="w-4 h-4 text-[#743C49]" />
            </div>
            <p className="text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] mt-1">{activeItems.length}</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#777078] dark:text-[#A89E9B] mt-1">
              {pendingReviewCount > 0 ? `${pendingReviewCount} pending AI review` : 'All accepted'}
            </p>
          </div>

          <div className="p-4 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E]">
            <div className="flex items-center justify-between text-[#777078] dark:text-[#D5A6A0] mb-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em]">Health Index</span>
              <Award className="w-4 h-4 text-[#B49B82]" />
            </div>
            <p className="text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] mt-1">{healthScore} <span className="text-sm font-sans text-[#777078]">/ 100</span></p>
            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#743C49] dark:text-[#D5A6A0] mt-1 font-semibold">
              {healthScore >= 80 ? 'Highly Versatile' : healthScore >= 60 ? 'Well Balanced' : 'Building Essentials'}
            </p>
          </div>

          <div className="p-4 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E]">
            <div className="flex items-center justify-between text-[#777078] dark:text-[#D5A6A0] mb-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em]">Distinct Colors</span>
              <PieChart className="w-4 h-4 text-[#6D7068]" />
            </div>
            <p className="text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] mt-1">{colorCounts.length}</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#777078] dark:text-[#A89E9B] mt-1">Palettes cataloged</p>
          </div>

          <div className="p-4 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E]">
            <div className="flex items-center justify-between text-[#777078] dark:text-[#D5A6A0] mb-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em]">Identified Gaps</span>
              <Layers className="w-4 h-4 text-[#743C49]" />
            </div>
            <p className="text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] mt-1">
              {data?.gaps ? data.gaps.length : 0}
            </p>
            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#777078] dark:text-[#A89E9B] mt-1">Opportunities to unlock fits</p>
          </div>
        </div>

        {/* Section 1: Formality & Readiness Spectrum */}
        <div className="p-5 sm:p-6 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#743C49]" />
              <h2 className="text-lg font-serif text-[#29202B] dark:text-[#F3EEE8]">
                Formality & Lifestyle Balance
              </h2>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0]">100% Total Wardrobe</span>
          </div>

          {/* Formality Progress Bar */}
          <div className="w-full h-3 rounded-[2px] overflow-hidden flex bg-[#FAF6F0] dark:bg-[#2A222D] border border-[#DCD4CC] dark:border-[#392F3E]">
            <div
              style={{ width: `${formalityScores.casual}%` }}
              className="bg-[#B49B82] transition-all duration-500"
              title={`Casual: ${formalityScores.casual}%`}
            />
            <div
              style={{ width: `${formalityScores.smartCasual}%` }}
              className="bg-[#743C49] transition-all duration-500"
              title={`Smart Casual: ${formalityScores.smartCasual}%`}
            />
            <div
              style={{ width: `${formalityScores.formal}%` }}
              className="bg-[#29202B] dark:bg-[#F3EEE8] transition-all duration-500"
              title={`Formal / Evening: ${formalityScores.formal}%`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 text-center pt-2">
            <div className="p-3.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E]">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="inline-block w-2 h-2 rounded-[1px] bg-[#B49B82]" />
                <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0]">Casual</span>
              </div>
              <p className="text-xl font-serif text-[#29202B] dark:text-[#F3EEE8]">
                {formalityScores.casual}%
              </p>
              <p className="text-[10px] font-mono text-[#777078] dark:text-[#A89E9B] mt-0.5">
                {formalityScores.counts.casual} pieces
              </p>
            </div>

            <div className="p-3.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E]">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="inline-block w-2 h-2 rounded-[1px] bg-[#743C49]" />
                <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0]">Smart Casual</span>
              </div>
              <p className="text-xl font-serif text-[#29202B] dark:text-[#F3EEE8]">
                {formalityScores.smartCasual}%
              </p>
              <p className="text-[10px] font-mono text-[#777078] dark:text-[#A89E9B] mt-0.5">
                {formalityScores.counts.smartCasual} pieces
              </p>
            </div>

            <div className="p-3.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E]">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="inline-block w-2 h-2 rounded-[1px] bg-[#29202B] dark:bg-[#F3EEE8]" />
                <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0]">Formal</span>
              </div>
              <p className="text-xl font-serif text-[#29202B] dark:text-[#F3EEE8]">
                {formalityScores.formal}%
              </p>
              <p className="text-[10px] font-mono text-[#777078] dark:text-[#A89E9B] mt-0.5">
                {formalityScores.counts.formal} pieces
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Category Distribution & Color Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Categories */}
          <div className="p-5 sm:p-6 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] space-y-4">
            <h3 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
              Garment Categories
            </h3>
            <div className="space-y-3">
              {categoryCounts.length === 0 ? (
                <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#777078] py-4 text-center">
                  No accepted items in your wardrobe yet.
                </p>
              ) : (
                categoryCounts.map(([cat, count]) => {
                  const pct = Math.round((count / (activeItems.length || 1)) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#29202B] dark:text-[#F3EEE8] capitalize font-sans">{cat}</span>
                        <span className="text-[#777078] dark:text-[#A89E9B] font-mono text-[10px]">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-[1px] bg-[#FAF6F0] dark:bg-[#2A222D] overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-[#29202B] dark:bg-[#F3EEE8] rounded-[1px]"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Color Palettes */}
          <div className="p-5 sm:p-6 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] space-y-4">
            <h3 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
              Top Colors in Rotation
            </h3>
            <div className="space-y-3">
              {colorCounts.length === 0 ? (
                <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#777078] py-4 text-center">
                  No color data cataloged yet.
                </p>
              ) : (
                colorCounts.map(([color, count]) => {
                  const pct = Math.round((count / (activeItems.length || 1)) * 100);
                  return (
                    <div key={color} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#29202B] dark:text-[#F3EEE8] capitalize font-sans">{color}</span>
                        <span className="text-[#777078] dark:text-[#A89E9B] font-mono text-[10px]">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-[1px] bg-[#FAF6F0] dark:bg-[#2A222D] overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-[#743C49] rounded-[1px]"
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
        <div className="p-5 sm:p-6 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#743C49]" />
            <h3 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
              Occasion Readiness
            </h3>
          </div>
          <p className="text-xs text-[#777078] dark:text-[#A89E9B]">
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
                className="p-3.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-serif text-[#29202B] dark:text-[#F3EEE8]">{item.occasion}</span>
                  {item.ready ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-[#B49B82]" />
                  )}
                </div>
                <span
                  className={`text-[9px] font-mono uppercase tracking-[0.14em] px-2 py-0.5 rounded-[2px] inline-block self-start border ${
                    item.ready
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/50'
                      : 'bg-[#B49B82]/15 text-[#29202B] dark:text-[#DCD4CC] border-[#B49B82]/30'
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
