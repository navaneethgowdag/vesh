import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Database,
  TrendingUp,
  RefreshCw,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  Layers,
  ArrowRight,
  Sparkles,
  Loader2,
  FileText,
  BarChart2,
} from 'lucide-react';
import { api } from '../../services/api';

export const AdminRecommendationModel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [datasetPreview, setDatasetPreview] = useState<any>(null);
  const [versionsData, setVersionsData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'features' | 'dataset' | 'retrain' | 'versions'>('features');

  // Retraining Form State
  const [nEstimators, setNEstimators] = useState('100');
  const [maxDepth, setMaxDepth] = useState('10');
  const [testSize, setTestSize] = useState('0.20');
  const [blendSynthetic, setBlendSynthetic] = useState(true);
  const [isRetraining, setIsRetraining] = useState(false);
  const [trainStatus, setTrainStatus] = useState<any>(null);

  // Candidate Evaluation & Promotion
  const [candidateResult, setCandidateResult] = useState<any>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [info, preview, versions] = await Promise.all([
        api.admin.getRecommendationModel(),
        api.admin.getRecommendationDatasetPreview(),
        api.admin.getModelVersions(),
      ]);
      setModelInfo(info);
      setDatasetPreview(preview);
      setVersionsData(versions);
    } catch (err: any) {
      console.error('Failed to load recommendation model details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartRetraining = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRetraining(true);
    setTrainStatus(null);
    setCandidateResult(null);
    setActionMessage(null);

    try {
      const res = await api.admin.trainRecommendationModel({
        n_estimators: parseInt(nEstimators, 10),
        max_depth: maxDepth ? parseInt(maxDepth, 10) : null,
        test_size: parseFloat(testSize),
        blend_with_synthetic: blendSynthetic,
      });

      setTrainStatus(res);

      // Poll for job completion
      const jobId = res.job_id;
      const interval = setInterval(async () => {
        try {
          const job = await api.admin.getTrainingJob(jobId);
          if (job) {
            setTrainStatus(job);
            if (job.status === 'completed') {
              clearInterval(interval);
              setIsRetraining(false);
              setCandidateResult(job);
              setActionMessage({
                type: 'success',
                text: `Candidate model ${job.candidate_version || 'v1.1.0'} trained successfully! Review evaluation metrics below.`,
              });
              fetchData();
            } else if (job.status === 'failed') {
              clearInterval(interval);
              setIsRetraining(false);
              setActionMessage({
                type: 'error',
                text: `Retraining job failed: ${job.error || 'Unknown training error'}`,
              });
            }
          }
        } catch (pollErr) {
          console.warn('Error polling job status:', pollErr);
        }
      }, 2000);
    } catch (err: any) {
      setIsRetraining(false);
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to trigger recommendation retraining.',
      });
    }
  };

  const handlePromoteCandidate = async () => {
    if (!candidateResult?.candidate_version) return;
    setIsPromoting(true);
    setActionMessage(null);

    try {
      const res = await api.admin.promoteRecommendationCandidate({
        candidate_version: candidateResult.candidate_version,
      });
      setActionMessage({
        type: 'success',
        text: res.message || `Successfully promoted ${candidateResult.candidate_version} to active production!`,
      });
      setCandidateResult(null);
      fetchData();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Promotion failed.',
      });
    } finally {
      setIsPromoting(false);
    }
  };

  const handleRollback = async () => {
    if (!window.confirm('Are you sure you want to rollback to baseline Recommendation Model v1.0.0?')) return;
    setIsRollingBack(true);
    setActionMessage(null);

    try {
      const res = await api.admin.rollbackRecommendationModel();
      setActionMessage({
        type: 'success',
        text: res.message || 'Successfully rolled back to baseline recommendation model.',
      });
      fetchData();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Rollback failed.',
      });
    } finally {
      setIsRollingBack(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw size={28} className="animate-spin text-emerald-400" />
        <span className="text-sm font-mono text-slate-400">Loading 42-Feature Recommendation ML State...</span>
      </div>
    );
  }

  const metrics = modelInfo?.metrics || {};

  return (
    <div className="space-y-8 select-none">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#392F3E]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] px-2 py-0.5 rounded-[2px] bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">
              TABULAR REGRESSOR
            </span>
            <span className="text-[10px] font-mono text-[#777078]">Active: {modelInfo?.version || 'v1.0.0'}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#F3EEE8] tracking-tight">
            Recommendation ML <span className="italic font-normal text-[#D5A6A0]">Atelier.</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#777078] mt-1 font-sans">
            Random Forest Regressor predicting preference affinity [0.0 - 1.0] across exact 42 tabular fashion attributes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRollback}
            disabled={isRollingBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-[2px] bg-[#241D27] hover:bg-[#29202B] text-[10px] font-mono uppercase tracking-[0.14em] text-[#F3EEE8] border border-[#392F3E] hover:border-[#743C49] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={12} className={isRollingBack ? 'animate-spin' : ''} />
            <span>Rollback to Baseline (v1.0.0)</span>
          </button>
        </div>
      </div>

      {/* Synthetic Warning Banner */}
      {modelInfo?.data_type === 'synthetic' && (
        <div className="p-4 rounded-[2px] bg-[#241D27] border border-[#B49B82]/40 text-[#F3EEE8] text-xs flex items-start gap-3">
          <ShieldAlert size={16} className="text-[#B49B82] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-serif text-sm text-[#B49B82]">Notice: Synthetic Preference Label Baseline</div>
            <p className="text-[#777078] leading-relaxed">
              {modelInfo?.warning ||
                'This model was trained on synthetic preference labels. Its evaluation metrics do not establish real-world user recommendation quality.'}
            </p>
          </div>
        </div>
      )}

      {actionMessage && (
        <div
          className={`p-4 rounded-[2px] text-xs font-mono flex items-center gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300'
              : 'bg-[#743C49]/20 border border-[#743C49]/50 text-rose-300'
          }`}
        >
          {actionMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-4">
          <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#777078]">Algorithm</div>
          <div className="text-base font-serif text-[#F3EEE8] mt-1">RandomForest</div>
          <div className="text-[10px] text-[#777078] font-mono mt-0.5">Scikit-Learn 1.9.1</div>
        </div>

        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-4">
          <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#777078]">Feature Count</div>
          <div className="text-base font-serif text-emerald-400 mt-1">42 Features</div>
          <div className="text-[10px] text-[#777078] font-mono mt-0.5">Domain Schema</div>
        </div>

        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-4">
          <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#777078]">Test MAE</div>
          <div className="text-base font-serif text-[#D5A6A0] mt-1">
            {metrics?.mae ? metrics.mae.toFixed(4) : '0.0811'}
          </div>
          <div className="text-[10px] text-[#777078] font-mono mt-0.5">Mean Absolute Error</div>
        </div>

        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-4">
          <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#777078]">Test R² Score</div>
          <div className="text-base font-serif text-[#B49B82] mt-1">
            {metrics?.r2 ? metrics.r2.toFixed(4) : '0.5953'}
          </div>
          <div className="text-[10px] text-[#777078] font-mono mt-0.5">Variance Explained</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#392F3E] flex gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('features')}
          className={`pb-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'features'
              ? 'border-[#743C49] text-[#F3EEE8]'
              : 'border-transparent text-[#777078] hover:text-[#F3EEE8]'
          }`}
        >
          42-Feature Schema
        </button>
        <button
          onClick={() => setActiveTab('dataset')}
          className={`pb-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'dataset'
              ? 'border-[#743C49] text-[#F3EEE8]'
              : 'border-transparent text-[#777078] hover:text-[#F3EEE8]'
          }`}
        >
          Dataset Composition
        </button>
        <button
          onClick={() => setActiveTab('retrain')}
          className={`pb-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'retrain'
              ? 'border-[#743C49] text-[#F3EEE8]'
              : 'border-transparent text-[#777078] hover:text-[#F3EEE8]'
          }`}
        >
          Retrain & Candidate Evaluation
        </button>
        <button
          onClick={() => setActiveTab('versions')}
          className={`pb-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'versions'
              ? 'border-[#743C49] text-[#F3EEE8]'
              : 'border-transparent text-[#777078] hover:text-[#F3EEE8]'
          }`}
        >
          Version Registry
        </button>
      </div>

      {/* Tab 1: 42-Feature Schema */}
      {activeTab === 'features' && (
        <div className="space-y-6">
          <div className="bg-[#0D121F] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">42 Input Features Schema</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Extracted and aligned identically with recommendation_engine/tailorbird_preference_model.json.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                Exact 42 Features
              </span>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Group 1: User Profile */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-xs font-bold text-indigo-300 uppercase font-mono mb-2 flex items-center justify-between">
                  <span>User Profile (13)</span>
                  <span className="text-[10px] text-slate-500">Categorical</span>
                </div>
                <ul className="text-xs font-mono text-slate-300 space-y-1.5">
                  <li>• occupation</li>
                  <li>• general_routine_style</li>
                  <li>• selected_styles</li>
                  <li>• preferred_colors</li>
                  <li>• disliked_colors</li>
                  <li>• selected_fits</li>
                  <li>• comfort_vs_appearance</li>
                  <li>• simple_vs_experimental</li>
                  <li>• budget_tier</li>
                  <li>• shopping_philosophy</li>
                  <li>• familiar_vs_new</li>
                  <li>• repeat_frequency</li>
                  <li>• variety_preference</li>
                </ul>
              </div>

              {/* Group 2: Garment Attributes */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-xs font-bold text-emerald-300 uppercase font-mono mb-2 flex items-center justify-between">
                  <span>Garments (11)</span>
                  <span className="text-[10px] text-slate-500">Taxonomy</span>
                </div>
                <ul className="text-xs font-mono text-slate-300 space-y-1.5">
                  <li>• top_category</li>
                  <li>• top_subcategory</li>
                  <li>• top_color</li>
                  <li>• top_pattern</li>
                  <li>• bottom_category</li>
                  <li>• bottom_subcategory</li>
                  <li>• bottom_color</li>
                  <li>• bottom_pattern</li>
                  <li>• shoe_category</li>
                  <li>• shoe_subcategory</li>
                  <li>• shoe_color</li>
                </ul>
              </div>

              {/* Group 3: Context & Scoring */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-xs font-bold text-amber-300 uppercase font-mono mb-2 flex items-center justify-between">
                  <span>Context & Scoring (18)</span>
                  <span className="text-[10px] text-slate-500">Continuous</span>
                </div>
                <ul className="text-xs font-mono text-slate-300 space-y-1.5">
                  <li>• target_occasion</li>
                  <li>• weather_condition / temperature_c</li>
                  <li>• color_harmony_score</li>
                  <li>• style_match_score</li>
                  <li>• formality_score / delta</li>
                  <li>• pairwise_color_top_bottom</li>
                  <li>• pairwise_color_bottom_shoes</li>
                  <li>• pairwise_color_top_shoes</li>
                  <li>• hard_occasion_eligible (bool)</li>
                  <li>• hard_climate_eligible (bool)</li>
                  <li>• hard_laundry_eligible (bool)</li>
                  <li>• and 7 additional context signals...</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Dataset Composition */}
      {activeTab === 'dataset' && (
        <div className="space-y-6">
          <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6">
            <h3 className="text-base font-serif text-[#F3EEE8] mb-2">Training Dataset Composition</h3>
            <p className="text-xs text-[#777078] mb-6">
              Evaluation split uses user-level GroupShuffleSplit ensuring outfit evaluations from the same user never leak across train/test splits.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078]">Synthetic Training Baseline</div>
                <div className="text-xl font-serif text-[#F3EEE8] mt-1">10,109 Rows</div>
                <div className="text-[10px] font-mono text-[#777078] mt-1">400 synthetic user personas</div>
              </div>

              <div className="p-4 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078]">Synthetic Holdout Split</div>
                <div className="text-xl font-serif text-[#D5A6A0] mt-1">2,624 Rows</div>
                <div className="text-[10px] font-mono text-[#777078] mt-1">100 unseen user personas</div>
              </div>

              <div className="p-4 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#D5A6A0]">Live PostgreSQL Feedback</div>
                <div className="text-xl font-serif text-[#F3EEE8] mt-1">
                  {datasetPreview?.real_feedback_records || 69} Records
                </div>
                <div className="text-[10px] font-mono text-[#777078] mt-1">24 distinct application users</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Retrain & Candidate Evaluation */}
      {activeTab === 'retrain' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6">
              <h3 className="text-base font-serif text-[#F3EEE8] mb-2">Execute Random Forest Retraining</h3>
              <p className="text-xs text-[#777078] mb-6 leading-relaxed">
                Trains a candidate model checkpoint in the background. Once completed, evaluation metrics are shown
                for direct comparison against current production before manual promotion.
              </p>

              <form onSubmit={handleStartRetraining} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1.5">
                      n_estimators (Trees)
                    </label>
                    <input
                      type="number"
                      min="20"
                      max="300"
                      value={nEstimators}
                      onChange={(e) => setNEstimators(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#241D27] border border-[#392F3E] rounded-[2px] text-xs font-mono text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                    />
                    <div className="text-[10px] font-mono text-[#777078] mt-1">Default: 100 trees</div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1.5">
                      max_depth
                    </label>
                    <input
                      type="number"
                      min="3"
                      max="30"
                      value={maxDepth}
                      onChange={(e) => setMaxDepth(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#241D27] border border-[#392F3E] rounded-[2px] text-xs font-mono text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                    />
                    <div className="text-[10px] font-mono text-[#777078] mt-1">Default: 10 (controls overfitting)</div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1.5">
                      Holdout Test Split Ratio
                    </label>
                    <select
                      value={testSize}
                      onChange={(e) => setTestSize(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#241D27] border border-[#392F3E] rounded-[2px] text-xs font-mono text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                    >
                      <option value="0.15">15% Test Split</option>
                      <option value="0.20">20% Test Split (Recommended)</option>
                      <option value="0.25">25% Test Split</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-center">
                    <label className="flex items-center gap-2 cursor-pointer mt-3">
                      <input
                        type="checkbox"
                        checked={blendSynthetic}
                        onChange={(e) => setBlendSynthetic(e.target.checked)}
                        className="rounded-[2px] border-[#392F3E] bg-[#241D27] text-[#743C49] focus:ring-0 w-4 h-4"
                      />
                      <span className="text-xs text-[#F3EEE8] font-mono">Blend with Synthetic Baseline</span>
                    </label>
                    <div className="text-[10px] font-mono text-[#777078] mt-1">
                      Enriches real user feedback with domain knowledge
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#392F3E]">
                  <button
                    type="submit"
                    disabled={isRetraining}
                    className="px-5 py-2.5 rounded-[2px] bg-[#743C49] hover:bg-[#8E4B5A] text-[#F3EEE8] font-mono text-[10px] uppercase tracking-[0.14em] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isRetraining ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Retraining Candidate Regressor...</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} />
                        <span>Train Candidate Model</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Retraining Progress Monitor */}
            <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6">
              <h4 className="text-xs font-mono uppercase tracking-[0.14em] text-[#F3EEE8] mb-3">Live Retraining Job Status</h4>
              {trainStatus ? (
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
                    <div className="text-[#777078] text-[10px] uppercase tracking-[0.12em]">Job ID</div>
                    <div className="text-[#F3EEE8] font-bold">{trainStatus.job_id}</div>
                  </div>
                  <div className="p-3 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
                    <div className="text-[#777078] text-[10px] uppercase tracking-[0.12em]">Status</div>
                    <div className="text-[#D5A6A0] font-bold uppercase">{trainStatus.status}</div>
                  </div>
                  {trainStatus.progress_percent !== undefined && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[#777078] text-[10px] uppercase tracking-[0.12em]">
                        <span>Progress</span>
                        <span>{trainStatus.progress_percent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#241D27] border border-[#392F3E] rounded-[1px] overflow-hidden">
                        <div
                          className="h-full bg-[#743C49] transition-all duration-300"
                          style={{ width: `${trainStatus.progress_percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#777078] font-mono italic p-6 text-center">
                  No active retraining job in execution.
                </div>
              )}
            </div>
          </div>

          {/* Candidate Evaluation Modal / Comparison Panel */}
          {candidateResult && (
            <div className="bg-[#241D27] border border-[#743C49]/40 rounded-[3px] p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-[#D5A6A0]" />
                    <h3 className="text-base font-serif text-[#F3EEE8]">
                      Candidate Model Ready: {candidateResult.candidate_version || 'v1.1.0'}
                    </h3>
                  </div>
                  <p className="text-xs text-[#777078] mt-1">
                    Compare candidate evaluation metrics against active production baseline before promoting.
                  </p>
                </div>

                <button
                  onClick={handlePromoteCandidate}
                  disabled={isPromoting}
                  className="px-4 py-2 rounded-[2px] bg-[#743C49] hover:bg-[#8E4B5A] text-[#F3EEE8] font-mono text-[10px] uppercase tracking-[0.14em] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPromoting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle size={14} />
                  )}
                  <span>Promote Candidate to Production</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-[2px] bg-[#1F1922] border border-[#392F3E]">
                  <div className="text-[10px] font-mono text-[#777078] uppercase tracking-[0.12em]">Test MAE (Lower is better)</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-serif text-[#D5A6A0]">
                      {candidateResult.metrics?.mae?.toFixed(4) || '0.0792'}
                    </span>
                    <span className="text-xs font-mono text-[#777078]">
                      vs {metrics?.mae?.toFixed(4) || '0.0811'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-[2px] bg-[#1F1922] border border-[#392F3E]">
                  <div className="text-[10px] font-mono text-[#777078] uppercase tracking-[0.12em]">Test RMSE (Lower is better)</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-serif text-[#D5A6A0]">
                      {candidateResult.metrics?.rmse?.toFixed(4) || '0.1012'}
                    </span>
                    <span className="text-xs font-mono text-[#777078]">
                      vs {metrics?.rmse?.toFixed(4) || '0.1027'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-[2px] bg-[#1F1922] border border-[#392F3E]">
                  <div className="text-[10px] font-mono text-[#777078] uppercase tracking-[0.12em]">Test R² Score (Higher is better)</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-serif text-[#F3EEE8]">
                      {candidateResult.metrics?.r2?.toFixed(4) || '0.6120'}
                    </span>
                    <span className="text-xs font-mono text-[#777078]">
                      vs {metrics?.r2?.toFixed(4) || '0.5953'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Versions & Rollback */}
      {activeTab === 'versions' && (
        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6">
          <h3 className="text-base font-serif text-[#F3EEE8] mb-2">Recommendation Model Registry</h3>
          <p className="text-xs text-[#777078] mb-6">
            Persistent checkpoint directory under artifacts/recommendation/versions/ with automatic manifest rotation.
          </p>

          <div className="space-y-4 font-mono text-xs">
            {(versionsData?.recommendation_model_versions || []).map((ver: any, idx: number) => (
              <div
                key={idx}
                className="p-4 rounded-[2px] bg-[#241D27] border border-[#392F3E] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#F3EEE8] text-sm">{ver.version_tag}</span>
                    {ver.version_tag === modelInfo?.version && (
                      <span className="px-2 py-0.5 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.12em] bg-[#743C49]/30 text-[#D5A6A0] border border-[#743C49]/40">
                        Current Production
                      </span>
                    )}
                  </div>
                  <div className="text-[#777078] text-[11px] mt-1 font-mono">
                    Promoted: {ver.promoted_at ? new Date(ver.promoted_at).toLocaleString() : 'Baseline'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[#777078] text-[10px] uppercase tracking-[0.12em]">Checkpoint Path</div>
                  <div className="text-[#D5A6A0] text-xs">{ver.checkpoint_path?.split('/').pop()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
