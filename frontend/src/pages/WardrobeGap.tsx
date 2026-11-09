import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { WardrobeGapAnalysis, WardrobeGapItem } from '../types';
import { cn } from '../utils/cn';

export const WardrobeGap: React.FC = () => {
  const { showToast } = useApp();
  const [analysis, setAnalysis] = useState<WardrobeGapAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadAnalysis = useCallback(async (force: boolean = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await api.wardrobeGap.getAnalysis(force);
      setAnalysis(data);
      if (force) {
        showToast('Wardrobe gap analysis refreshed!', 'success');
      }
    } catch (err: any) {
      console.error('Failed to load wardrobe gap analysis:', err);
      showToast('Could not load wardrobe gap analysis', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAnalysis(false);
  }, [loadAnalysis]);

  const formatLastAnalyzed = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
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
      <div className="max-w-5xl mx-auto px-4 py-8 select-none">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800/40">
                Wardrobe Intelligence
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Wardrobe Gap Analysis
            </h1>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Identifies missing essentials, rotation bottlenecks, and formality imbalances across your wardrobe.
            </p>
          </div>

          <Button
            onClick={() => loadAnalysis(true)}
            isLoading={refreshing}
            variant="outline"
            className="flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            <span>Refresh Analysis</span>
          </Button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-10 h-10 border-2 border-zinc-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Analyzing wardrobe categories, colour mix & wear history...
            </p>
          </div>
        ) : !analysis ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-sm text-zinc-500">No wardrobe analysis available.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Overview Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Total Garments
                </span>
                <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
                  {analysis.total_items}
                </div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 block">
                  cataloged in wardrobe
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

            {/* Category & Formality Distributions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category Breakdown */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-primary-500" />
                  Category Distribution
                </h3>
                <div className="space-y-2.5">
                  {Object.entries(analysis.category_distribution).map(([cat, count]) => {
                    const pct = analysis.total_items > 0 ? Math.round((count / analysis.total_items) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{cat}</span>
                          <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Formality Balance */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary-500" />
                  Formality Spectrum
                </h3>
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">Casual Daily (&lt; 0.45)</span>
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">{analysis.formality_distribution.casual} items</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${analysis.total_items > 0 ? (analysis.formality_distribution.casual / analysis.total_items) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">Smart Casual (0.45 – 0.70)</span>
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">{analysis.formality_distribution.smart_casual} items</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{
                          width: `${analysis.total_items > 0 ? (analysis.formality_distribution.smart_casual / analysis.total_items) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">Formal & Black Tie (&gt; 0.70)</span>
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">{analysis.formality_distribution.formal} items</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{
                          width: `${analysis.total_items > 0 ? (analysis.formality_distribution.formal / analysis.total_items) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Identified Gaps Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Identified Wardrobe Gaps ({analysis.gaps.length})
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Recommendations derived from actual wardrobe items, wear logs & upcoming calendar demands.
                  </p>
                </div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Last analyzed: {formatLastAnalyzed(analysis.last_analyzed_at)}
                </span>
              </div>

              {analysis.gaps.length === 0 ? (
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl p-8 border border-emerald-200 dark:border-emerald-900/40 text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                    Your Wardrobe is Versatile & Balanced
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-md mx-auto mt-1">
                    No critical gaps detected. Your clothing collection has sufficient category variety, balanced formality, and versatile rotation options.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {analysis.gaps.map((gap, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          {priorityBadge(gap.priority)}
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {gap.category}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 font-medium">
                          Confidence: {Math.round(gap.confidence * 100)}%
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1.5">
                        {gap.title}
                      </h3>

                      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-3">
                        {gap.reason}
                      </p>

                      {/* Evidence Box */}
                      <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800 mb-3.5 flex items-start gap-2">
                        <Info className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-zinc-700 dark:text-zinc-300">
                          <strong className="font-semibold">Wardrobe Evidence: </strong>
                          {gap.evidence}
                        </div>
                      </div>

                      {/* Suggested Garments */}
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-2">
                          Suggested Garments to Consider:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {gap.suggested_garments.map((sug, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-50/70 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200/60 dark:border-primary-800/40"
                            >
                              + {sug}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
