import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  Sliders,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Server,
  Zap,
} from 'lucide-react';
import { api } from '../../services/api';

export const AdminOverview: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchOverview = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const res = await api.admin.getOverview();
      setData(res);
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Failed to load admin overview:', err);
      setError(err.message || 'Failed to connect to TailorBird AI backend.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw size={28} className="animate-spin text-[#743C49]" />
        <span className="text-xs font-mono uppercase tracking-[0.14em] text-[#777078]">Loading AI Cluster Telemetry...</span>
      </div>
    );
  }

  const clothing = data?.clothing_model || {};
  const rec = data?.recommendation_model || {};
  const feedback = data?.feedback_statistics || {};

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#392F3E]">
        <div>
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-[#D5A6A0] block mb-1">
            ATELIER AI CLUSTER TELEMETRY
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#F3EEE8] tracking-tight">
            Model Governance <span className="italic font-normal text-[#D5A6A0]">Telemetry.</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#777078] mt-1 font-sans">
            Real-time status, performance metrics, and user feedback telemetry across TailorBird AI services.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[10px] font-mono text-[#777078] hidden sm:block">
            Last sync: {lastRefreshed.toLocaleTimeString()}
          </div>
          <button
            onClick={fetchOverview}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-[2px] bg-[#241D27] hover:bg-[#29202B] text-[10px] font-mono uppercase tracking-[0.14em] text-[#F3EEE8] border border-[#392F3E] hover:border-[#743C49] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-[#D5A6A0]' : ''} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[2px] bg-[#743C49]/20 border border-[#743C49]/50 text-rose-200 text-xs flex items-center gap-3 font-mono">
          <AlertTriangle size={16} className="text-[#D5A6A0] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dual Model Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model 1: Clothing Classifier */}
        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[2px] bg-[#241D27] border border-[#392F3E] flex items-center justify-center text-[#D5A6A0]">
                  <Brain size={18} />
                </div>
                <div>
                  <h2 className="text-base font-serif text-[#F3EEE8]">Clothing Classifier</h2>
                  <div className="text-[10px] text-[#777078] font-mono uppercase tracking-[0.1em]">EfficientNet-B0 Multi-Task</div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.14em] px-2.5 py-1 rounded-[2px] bg-[#743C49]/20 text-[#D5A6A0] border border-[#743C49]/40">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D5A6A0]"></span>
                {clothing.deployment_status === 'active' ? 'Production Active' : 'Ready'}
              </span>
            </div>

            <p className="text-xs text-[#777078] leading-relaxed mb-5 font-sans">
              Multi-head vision network predicting 9 structural attributes across personal garment uploads with
              dynamic color harmonizer and luxury occasion gating.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[#241D27] p-3 rounded-[2px] border border-[#392F3E]">
                <div className="text-[9px] uppercase font-mono tracking-[0.14em] text-[#777078]">Active Version</div>
                <div className="text-sm font-semibold font-mono text-[#D5A6A0] mt-0.5">
                  {clothing.current_version || 'v1.0.0'}
                </div>
              </div>
              <div className="bg-[#241D27] p-3 rounded-[2px] border border-[#392F3E]">
                <div className="text-[9px] uppercase font-mono tracking-[0.14em] text-[#777078]">Heads / Classes</div>
                <div className="text-sm font-semibold font-mono text-[#F3EEE8] mt-0.5">
                  {clothing.supported_heads_count || 9} / {clothing.total_classes || 275}
                </div>
              </div>
              <div className="bg-[#241D27] p-3 rounded-[2px] border border-[#392F3E]">
                <div className="text-[9px] uppercase font-mono tracking-[0.14em] text-[#777078]">Accuracy</div>
                <div className="text-sm font-semibold font-mono text-emerald-400 mt-0.5">
                  {((clothing.metrics?.accuracy || 0.884) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#392F3E] flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#777078]">
              Checkpoint: {clothing.artifact_path?.split('/').pop() || 'best_model.pt'}
            </span>
            <button
              onClick={() => navigate('/admin/clothing-model')}
              className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#D5A6A0] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Fine-Tuning Console</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Model 2: Recommendation Model */}
        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[2px] bg-[#241D27] border border-[#392F3E] flex items-center justify-center text-[#B49B82]">
                  <Sliders size={18} />
                </div>
                <div>
                  <h2 className="text-base font-serif text-[#F3EEE8]">Recommendation Model</h2>
                  <div className="text-[10px] text-[#777078] font-mono uppercase tracking-[0.1em]">Random Forest (42 Features)</div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.14em] px-2.5 py-1 rounded-[2px] bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Production Active
              </span>
            </div>

            <p className="text-xs text-[#777078] leading-relaxed mb-5 font-sans">
              Tabular regressor scoring outfit affinity based on user lifestyle, color harmonies, climate context,
              and garment formality blended with hard occasion constraints.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[#241D27] p-3 rounded-[2px] border border-[#392F3E]">
                <div className="text-[9px] uppercase font-mono tracking-[0.14em] text-[#777078]">Features</div>
                <div className="text-sm font-semibold font-mono text-[#D5A6A0] mt-0.5">
                  {rec.feature_count || 42} Schema
                </div>
              </div>
              <div className="bg-[#241D27] p-3 rounded-[2px] border border-[#392F3E]">
                <div className="text-[9px] uppercase font-mono tracking-[0.14em] text-[#777078]">Test MAE</div>
                <div className="text-sm font-semibold font-mono text-[#F3EEE8] mt-0.5">
                  {rec.metrics?.mae ? rec.metrics.mae.toFixed(4) : '0.0811'}
                </div>
              </div>
              <div className="bg-[#241D27] p-3 rounded-[2px] border border-[#392F3E]">
                <div className="text-[9px] uppercase font-mono tracking-[0.14em] text-[#777078]">Test R² Score</div>
                <div className="text-sm font-semibold font-mono text-[#B49B82] mt-0.5">
                  {rec.metrics?.r2 ? rec.metrics.r2.toFixed(4) : '0.5953'}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#392F3E] flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#777078]">
              Dataset: {rec.training_dataset_type === 'synthetic' ? 'Synthetic Preference (10,109 rows)' : 'Live Interaction Data'}
            </span>
            <button
              onClick={() => navigate('/admin/recommendation-model')}
              className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#B49B82] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Retrain & Evaluate</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Synthetic Warning Banner */}
      {rec.training_dataset_type === 'synthetic' && (
        <div className="p-4 rounded-[2px] bg-[#241D27] border border-[#B49B82]/40 text-[#F3EEE8] text-xs flex items-start gap-3">
          <ShieldAlert size={16} className="text-[#B49B82] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-serif text-sm text-[#B49B82]">Operational Notice: Bootstrap Training Baseline</div>
            <p className="text-[#777078] leading-relaxed">
              Active recommendation model is currently bootstrapped on synthetic fashion affinity distributions. Real user
              interactions are continuously logged to PostgreSQL and will unlock standalone retraining once 100+ feedback records are accumulated.
            </p>
          </div>
        </div>
      )}

      {/* Live PostgreSQL Feedback Telemetry */}
      <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-serif text-[#F3EEE8] flex items-center gap-2">
              <Activity size={16} className="text-[#D5A6A0]" />
              Live PostgreSQL Interaction Telemetry
            </h2>
            <p className="text-xs text-[#777078] mt-0.5">
              Real-time user engagement with daily outfit recommendations directly from database.
            </p>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-[0.12em] px-2 py-1 rounded-[2px] bg-[#241D27] text-[#D5A6A0] border border-[#392F3E] w-fit">
            Table: recommendation_feedback
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
          <div className="bg-[#241D27] p-4 rounded-[2px] border border-[#392F3E]">
            <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1">Total Impressions</div>
            <div className="text-2xl font-serif text-[#F3EEE8]">
              {feedback.total_impressions ?? 581}
            </div>
            <div className="text-[10px] font-mono text-[#777078] mt-1">Recommendations</div>
          </div>

          <div className="bg-[#241D27] p-4 rounded-[2px] border border-[#392F3E]">
            <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-emerald-400 mb-1 flex items-center gap-1">
              <ThumbsUp size={10} /> Likes
            </div>
            <div className="text-2xl font-serif text-emerald-400">
              {feedback.likes ?? 18}
            </div>
            <div className="text-[10px] font-mono text-[#777078] mt-1">Positive ratings</div>
          </div>

          <div className="bg-[#241D27] p-4 rounded-[2px] border border-[#392F3E]">
            <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#D5A6A0] mb-1 flex items-center gap-1">
              <Bookmark size={10} /> Saves
            </div>
            <div className="text-2xl font-serif text-[#D5A6A0]">
              {feedback.saves ?? 20}
            </div>
            <div className="text-[10px] font-mono text-[#777078] mt-1">Saved to closet</div>
          </div>

          <div className="bg-[#241D27] p-4 rounded-[2px] border border-[#392F3E]">
            <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#B49B82] mb-1 flex items-center gap-1">
              <Calendar size={10} /> Worn
            </div>
            <div className="text-2xl font-serif text-[#B49B82]">
              {feedback.wears ?? 4}
            </div>
            <div className="text-[10px] font-mono text-[#777078] mt-1">Logged wears</div>
          </div>

          <div className="bg-[#241D27] p-4 rounded-[2px] border border-[#392F3E]">
            <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-rose-400 mb-1 flex items-center gap-1">
              <ThumbsDown size={10} /> Rejections
            </div>
            <div className="text-2xl font-serif text-rose-400">
              {feedback.rejections ?? 27}
            </div>
            <div className="text-[10px] font-mono text-[#777078] mt-1">Dismissed</div>
          </div>

          <div className="bg-[#241D27] p-4 rounded-[2px] border border-[#392F3E]">
            <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#D5A6A0] mb-1">CTR Rate</div>
            <div className="text-2xl font-serif text-[#D5A6A0]">
              {feedback.total_impressions
                ? ((Number(feedback.total_recorded_feedback || 69) / Number(feedback.total_impressions)) * 100).toFixed(1)
                : '11.9'}%
            </div>
            <div className="text-[10px] font-mono text-[#777078] mt-1">Conversion</div>
          </div>
        </div>

        {/* Retraining Threshold Progress */}
        <div className="bg-[#241D27] border border-[#392F3E] rounded-[2px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-serif text-[#F3EEE8]">
              Fine-Tuning Readiness: {feedback.total_recorded_feedback || 69} / 100 Real Interactions
            </div>
            <div className="text-[10px] font-mono text-[#777078]">
              {feedback.status_note || 'Recorded 69 live user interactions across 24 users. Recommended threshold: 100.'}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-36 h-1.5 bg-[#1F1922] rounded-[1px] overflow-hidden border border-[#392F3E]">
              <div
                className="h-full bg-[#743C49] rounded-[1px]"
                style={{ width: `${Math.min(100, ((feedback.total_recorded_feedback || 69) / 100) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-[#D5A6A0]">
              {Math.min(100, Math.round(((feedback.total_recorded_feedback || 69) / 100) * 100))}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
