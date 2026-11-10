import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Check,
  X,
  Layers,
  BarChart3,
  TrendingUp,
  Sliders,
  Terminal,
  ShieldAlert,
  HelpCircle,
  Clock,
  ArrowRight,
  Info,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { cn } from '../utils/cn';

const HEAD_NAMES: Record<string, string> = {
  article_type: 'Article Type',
  master_category: 'Master Category',
  sub_category: 'Subcategory',
  gender: 'Gender',
  base_colour: 'Base Colour',
  season: 'Season',
  usage: 'Occasion / Usage',
  pattern: 'Pattern',
  age_group: 'Age Group',
};

export const ModelLearning: React.FC = () => {
  const { showToast } = useApp();

  // State
  const [stats, setStats] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedHead, setSelectedHead] = useState<string>('article_type');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStartingTraining, setIsStartingTraining] = useState<boolean>(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobData, setActiveJobData] = useState<any>(null);

  // Training Hyperparameters Modal
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [epochs, setEpochs] = useState<number>(5);
  const [learningRate, setLearningRate] = useState<string>('0.0001');
  const [batchSize, setBatchSize] = useState<number>(16);

  // Confirmation Modals
  const [showPromoteModal, setShowPromoteModal] = useState<boolean>(false);
  const [showRollbackModal, setShowRollbackModal] = useState<boolean>(false);
  const [selectedCandidateTag, setSelectedCandidateTag] = useState<string>('');
  const [isPromoting, setIsPromoting] = useState<boolean>(false);
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);

  // Fetch all overview data
  const fetchData = useCallback(async () => {
    try {
      const [statsRes, versionsRes, compRes, jobsRes] = await Promise.all([
        api.modelLearning.getStats(),
        api.modelLearning.listVersions(),
        api.modelLearning.getComparison(),
        api.modelLearning.listJobs(5),
      ]);
      setStats(statsRes);
      setVersions(versionsRes || []);
      setComparison(compRes);
      setJobs(jobsRes || []);

      // Check if there is an active running job
      const runningJob = jobsRes?.find((j: any) => j.status === 'queued' || j.status === 'processing');
      if (runningJob) {
        setActiveJobId(runningJob.id);
        setActiveJobData(runningJob);
      }
    } catch (err: any) {
      console.warn('Failed to load Model Learning data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling effect for active training job
  useEffect(() => {
    if (!activeJobId) return;

    const interval = setInterval(async () => {
      try {
        const job = await api.modelLearning.getJob(activeJobId);
        setActiveJobData(job);
        if (job.status === 'completed' || job.status === 'failed') {
          setActiveJobId(null);
          showToast(
            job.status === 'completed'
              ? 'Personal model fine-tuning completed successfully!'
              : `Training job failed: ${job.error_message || 'Unknown error'}`,
            job.status === 'completed' ? 'success' : 'info'
          );
          fetchData();
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeJobId, fetchData, showToast]);

  // Handle Starting Training
  const handleStartTraining = async () => {
    setIsStartingTraining(true);
    setShowConfigModal(false);
    try {
      const res = await api.modelLearning.startTraining({
        epochs,
        learning_rate: parseFloat(learningRate) || 0.0001,
        batch_size: batchSize,
      });
      showToast('Training job queued in background.', 'success');
      setActiveJobId(res.job_id);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to start training job.', 'info');
    } finally {
      setIsStartingTraining(false);
    }
  };

  // Handle Candidate Promotion
  const handlePromoteCandidate = async () => {
    if (!selectedCandidateTag) return;
    setIsPromoting(true);
    try {
      await api.modelLearning.promoteCandidate(selectedCandidateTag);
      showToast(`Model candidate "${selectedCandidateTag}" is now active in production!`, 'success');
      setShowPromoteModal(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to promote candidate.', 'info');
    } finally {
      setIsPromoting(false);
    }
  };

  // Handle Rollback
  const handleRollback = async () => {
    setIsRollingBack(true);
    try {
      const res = await api.modelLearning.rollback();
      showToast(`Successfully rolled back to "${res.active_version}"!`, 'success');
      setShowRollbackModal(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to roll back production model.', 'info');
    } finally {
      setIsRollingBack(false);
    }
  };

  // Handle Candidate Rejection
  const handleRejectCandidate = async (tag: string) => {
    try {
      await api.modelLearning.rejectCandidate(tag);
      showToast(`Candidate "${tag}" rejected.`, 'info');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject candidate.', 'info');
    }
  };

  const activeProductionVersion = versions.find((v) => v.is_active_production) || {
    version_tag: 'v1.0.0',
    model_name: 'efficientnet_b0_multitask',
    promoted_at: '2026-11-08',
  };

  const activeCandidate = comparison?.has_candidate ? comparison.candidate : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 border border-zinc-700/50 shadow-xl text-white">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-800 dark:bg-zinc-800/80 border border-zinc-700 text-teal-400">
              <Cpu className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Model Learning & Classifier Optimization
            </h1>
          </div>
          <p className="text-sm text-zinc-300 max-w-2xl">
            Personal fine-tuning pipeline for TailorBird's Multi-Task EfficientNet-B0 clothing classifier.
            Learns from your confirmed attribute reviews to improve your wardrobe recommendations.
          </p>
        </div>

        {/* Active Production Status Pill */}
        <div className="flex items-center gap-3 bg-zinc-800/80 dark:bg-zinc-900/90 border border-zinc-700/80 rounded-xl px-4 py-3 shrink-0">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Production Model
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
            <div className="text-sm font-bold text-white font-mono">
              {activeProductionVersion.version_tag}
            </div>
          </div>
        </div>
      </div>

      {/* Dataset Overview Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Personal Wardrobe Dataset
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Reviewed Garments
            </span>
            <div className="mt-2 text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
              {stats?.total_reviewed_garments ?? 0}
            </div>
            <span className="text-[11px] text-zinc-500 mt-1 block">
              Out of {stats?.total_wardrobe_items ?? 0} total wardrobe items
            </span>
          </Card>

          <Card className="p-5 border-zinc-200 dark:border-zinc-800 bg-teal-50/30 dark:bg-teal-950/20 border-teal-200/50 dark:border-teal-900/30">
            <span className="text-xs font-medium text-teal-700 dark:text-teal-400 uppercase tracking-wider">
              Eligible Training Samples
            </span>
            <div className="mt-2 text-3xl font-extrabold text-teal-900 dark:text-teal-300">
              {stats?.total_eligible_training_examples ?? 0}
            </div>
            <span className="text-[11px] text-teal-600/80 dark:text-teal-400/70 mt-1 block">
              With confirmed labels & original images
            </span>
          </Card>

          <Card className="p-5 border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Confirmed Attributes
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats?.total_accepted_attributes ?? 0}
              </span>
              <span className="text-xs text-zinc-400">accepted</span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats?.total_corrected_attributes ?? 0}
              </span>
              <span className="text-xs text-zinc-400">corrected</span>
            </div>
            <span className="text-[11px] text-zinc-500 mt-1 block">
              {stats?.total_unconfirmed_attributes ?? 0} unconfirmed (masked from loss)
            </span>
          </Card>

          <Card className="p-5 border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Dataset Readiness
            </span>
            <div className="mt-2 flex items-center gap-2">
              {stats?.dataset_ready ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    Ready to Fine-Tune
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                  <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                    Awaiting Reviews
                  </span>
                </>
              )}
            </div>
            <span className="text-[11px] text-zinc-500 mt-1 block truncate" title={stats?.readiness_summary}>
              {stats?.readiness_summary || 'Review garments in wardrobe to enable training.'}
            </span>
          </Card>
        </div>

        {/* Head Class Representation Explorer */}
        {stats?.class_counts_per_head && (
          <Card className="p-5 border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Class Distribution per Prediction Head
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Inspect confirmed samples per class. Classes with &lt; 3 samples are marked as insufficient for reliable evaluation.
                </p>
              </div>

              {/* Head Selector Tabs */}
              <select
                value={selectedHead}
                onChange={(e) => setSelectedHead(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
              >
                {Object.entries(HEAD_NAMES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label} ({Object.keys(stats.class_counts_per_head[k] || {}).length} classes)
                  </option>
                ))}
              </select>
            </div>

            {/* Class Badges Grid */}
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.keys(stats.class_counts_per_head[selectedHead] || {}).length === 0 ? (
                <div className="text-xs text-zinc-500 italic py-2">
                  No confirmed attributes for {HEAD_NAMES[selectedHead]} yet.
                </div>
              ) : (
                Object.entries(stats.class_counts_per_head[selectedHead] || {}).map(([cls, count]: any) => {
                  const isInsufficient = count < 3;
                  return (
                    <div
                      key={cls}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                        isInsufficient
                          ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
                      )}
                    >
                      <span>{cls}</span>
                      <span
                        className={cn(
                          'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                          isInsufficient
                            ? 'bg-amber-200/60 dark:bg-amber-800/50 text-amber-900 dark:text-amber-200'
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                        )}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Training Controls & Live Log Terminal */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Personal Fine-Tuning Execution
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfigModal(true)}
              disabled={Boolean(activeJobId) || isStartingTraining}
              icon={<Sliders className="w-4 h-4" />}
            >
              Configure (Epochs: {epochs}, LR: {learningRate})
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartTraining}
              disabled={Boolean(activeJobId) || isStartingTraining || !stats?.dataset_ready}
              icon={<Play className="w-4 h-4" />}
            >
              {activeJobId ? 'Training in Progress...' : 'Start Fine-Tuning'}
            </Button>
          </div>
        </div>

        {/* Live Job Banner / Terminal */}
        {activeJobData && (
          <Card className="p-5 border-zinc-800 bg-zinc-950 text-zinc-200 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-zinc-100">Training Job Console</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                    activeJobData.status === 'processing'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                      : activeJobData.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  )}
                >
                  {activeJobData.status}
                </span>
              </div>
              <span className="text-zinc-500 text-[10px]">Job ID: {activeJobData.id}</span>
            </div>

            {/* Log Stream Window */}
            <div className="max-h-56 overflow-y-auto space-y-1 p-2 rounded bg-zinc-900/60 border border-zinc-800 text-[11px] leading-relaxed">
              {activeJobData.logs && activeJobData.logs.length > 0 ? (
                activeJobData.logs.map((log: string, idx: number) => (
                  <div key={idx} className="text-zinc-300">
                    <span className="text-emerald-500 select-none mr-1">›</span>
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-zinc-500 italic">Waiting for training job logs...</div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Model Comparison & Promotion Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Model Comparison (Candidate vs Active Production)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRollbackModal(true)}
              disabled={isRollingBack || versions.length < 2}
              icon={<RotateCcw className="w-4 h-4" />}
            >
              Rollback Production
            </Button>
          </div>
        </div>

        {activeCandidate ? (
          <Card className="p-6 border-zinc-200 dark:border-zinc-800 space-y-6">
            {/* Promotion Eligibility Banner */}
            <div
              className={cn(
                'flex items-center justify-between p-4 rounded-xl border',
                comparison.comparison?.promotion_eligible
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
              )}
            >
              <div className="flex items-center gap-3">
                {comparison.comparison?.promotion_eligible ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-sm">
                    {comparison.comparison?.promotion_eligible
                      ? 'Candidate Passed Evaluation Criteria'
                      : 'Candidate Has Metric Regressions'}
                  </div>
                  <div className="text-xs opacity-90 mt-0.5">
                    {comparison.comparison?.eligibility_summary}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRejectCandidate(activeCandidate.version_tag)}
                  icon={<X className="w-4 h-4" />}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSelectedCandidateTag(activeCandidate.version_tag);
                    setShowPromoteModal(true);
                  }}
                  icon={<Check className="w-4 h-4" />}
                >
                  Promote Candidate
                </Button>
              </div>
            </div>

            {/* Overall Metrics Side-by-Side */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-center">
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Overall Accuracy
                </span>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="text-xl font-mono text-zinc-600 dark:text-zinc-400">
                    {(comparison.comparison?.production_overall_accuracy * 100).toFixed(1)}%
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-400" />
                  <span className="text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {(comparison.comparison?.candidate_overall_accuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <div
                  className={cn(
                    'text-xs font-bold mt-1',
                    comparison.comparison?.delta_overall_accuracy >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {comparison.comparison?.delta_overall_accuracy >= 0 ? '+' : ''}
                  {(comparison.comparison?.delta_overall_accuracy * 100).toFixed(1)}% Delta
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-center">
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Overall Macro F1
                </span>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="text-xl font-mono text-zinc-600 dark:text-zinc-400">
                    {(comparison.comparison?.production_overall_macro_f1 * 100).toFixed(1)}%
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-400" />
                  <span className="text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {(comparison.comparison?.candidate_overall_macro_f1 * 100).toFixed(1)}%
                  </span>
                </div>
                <div
                  className={cn(
                    'text-xs font-bold mt-1',
                    comparison.comparison?.delta_overall_macro_f1 >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {comparison.comparison?.delta_overall_macro_f1 >= 0 ? '+' : ''}
                  {(comparison.comparison?.delta_overall_macro_f1 * 100).toFixed(1)}% Delta
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-center">
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Held-Out Test Set Size
                </span>
                <div className="mt-2 text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {comparison.comparison?.test_sample_count ?? 0} samples
                </div>
                <span className="text-xs text-zinc-500 mt-1 block">
                  Isolated held-out test split
                </span>
              </div>
            </div>

            {/* Per-Head Comparison Breakdown Table */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-2.5 px-4">Prediction Head</th>
                    <th className="py-2.5 px-4 text-center">Production Acc</th>
                    <th className="py-2.5 px-4 text-center">Candidate Acc</th>
                    <th className="py-2.5 px-4 text-center">Δ Accuracy</th>
                    <th className="py-2.5 px-4 text-center">Δ Macro F1</th>
                    <th className="py-2.5 px-4 text-right">Test Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {Object.entries(HEAD_NAMES).map(([headKey, headLabel]) => {
                    const headData = comparison.comparison?.heads?.[headKey];
                    if (!headData) return null;
                    const deltaAcc = headData.delta_accuracy;
                    const deltaF1 = headData.delta_macro_f1;

                    return (
                      <tr key={headKey} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="py-2.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                          {headLabel}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-zinc-600 dark:text-zinc-400">
                          {(headData.production?.accuracy * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {(headData.candidate?.accuracy * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded font-mono font-bold text-[11px]',
                              deltaAcc > 0
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                : deltaAcc < 0
                                ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                                : 'text-zinc-500'
                            )}
                          >
                            {deltaAcc > 0 ? '+' : ''}
                            {(deltaAcc * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded font-mono font-bold text-[11px]',
                              deltaF1 > 0
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                : deltaF1 < 0
                                ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                                : 'text-zinc-500'
                            )}
                          >
                            {deltaF1 > 0 ? '+' : ''}
                            {(deltaF1 * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-zinc-500">
                          {headData.candidate?.support ?? 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="p-8 border-zinc-200 dark:border-zinc-800 text-center space-y-3">
            <Cpu className="w-10 h-10 text-zinc-400 mx-auto" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              No Candidate Model Available for Comparison
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Fine-tune a candidate model above to evaluate accuracy improvements side-by-side with your active production model.
            </p>
          </Card>
        )}
      </div>

      {/* Model Versions Audit Trail */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Model Version Repository
        </h2>

        <Card className="border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-3 px-4">Version Tag</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Base Checkpoint</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {versions.map((v) => (
                <tr key={v.version_tag} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {v.version_tag}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                        v.status === 'production'
                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : v.status === 'candidate'
                          ? 'bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                          : v.status === 'rejected'
                          ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      )}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-500">
                    {v.created_at ? new Date(v.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-500 truncate max-w-xs" title={v.checkpoint_path}>
                    {v.checkpoint_path?.split(/[\\/]/).pop()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {v.status === 'candidate' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCandidateTag(v.version_tag);
                          setShowPromoteModal(true);
                        }}
                      >
                        Promote
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Hyperparameters Config Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Training Hyperparameters"
        subtitle="Configure personal fine-tuning parameters for MultiTask EfficientNet-B0."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Epochs
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={epochs}
              onChange={(e) => setEpochs(parseInt(e.target.value) || 5)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
            />
            <span className="text-[11px] text-zinc-500 mt-1 block">
              Recommended: 5 to 10 epochs for controlled fine-tuning without overfitting.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Learning Rate
            </label>
            <input
              type="text"
              value={learningRate}
              onChange={(e) => setLearningRate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
            />
            <span className="text-[11px] text-zinc-500 mt-1 block">
              Default: 0.0001 (gentle fine-tuning rate).
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Batch Size
            </label>
            <input
              type="number"
              min={1}
              max={64}
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 16)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="ghost" onClick={() => setShowConfigModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setShowConfigModal(false)}>
              Save & Apply
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Candidate Promotion */}
      <Modal
        isOpen={showPromoteModal}
        onClose={() => setShowPromoteModal(false)}
        title="Confirm Candidate Promotion"
        subtitle={`Promote candidate "${selectedCandidateTag}" to active production.`}
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
            <strong>Warning:</strong> Promoting this candidate model will immediately update the active production checkpoint.
            All future garment uploads and AI predictions will use this model. You can roll back at any time.
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="ghost" onClick={() => setShowPromoteModal(false)} disabled={isPromoting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handlePromoteCandidate} disabled={isPromoting}>
              {isPromoting ? 'Promoting...' : 'Confirm Promotion'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Rollback */}
      <Modal
        isOpen={showRollbackModal}
        onClose={() => setShowRollbackModal(false)}
        title="Confirm Production Rollback"
        subtitle="Revert the active production model to the previous checkpoint or baseline v1.0.0."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
            The active production model will be reverted to the previous working production checkpoint or baseline <code>best_model.pt</code>.
            Live predictions will immediately switch back.
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="ghost" onClick={() => setShowRollbackModal(false)} disabled={isRollingBack}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRollback} disabled={isRollingBack}>
              {isRollingBack ? 'Rolling back...' : 'Confirm Rollback'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
