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
import { AppShell } from '../components/layout/AppShell';
import { EditorialPageHeader } from '../components/editorial/EditorialPageHeader';
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
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 space-y-8 select-none">
        {/* Editorial Header */}
        <EditorialPageHeader
          eyebrow="MACHINE LEARNING & ADAPTIVE CLASSIFICATION"
          title="Model Learning"
          italicTitle="Studio."
          description="Personal fine-tuning pipeline for TailorBird's Multi-Task EfficientNet-B0 clothing classifier. Learns from your confirmed attribute reviews to improve your wardrobe recommendations."
          actions={
            <div className="flex items-center gap-3 bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] px-3.5 py-2">
              <div className="w-2 h-2 rounded-full bg-[#743C49] animate-pulse" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0]">
                    Active Production
                  </span>
                  <span className="px-1.5 py-0.2 rounded-[2px] text-[9px] font-mono font-semibold bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0] border border-[#743C49]/30">
                    LIVE
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-[#29202B] dark:text-[#F3EEE8]">
                  {activeProductionVersion.version_tag}
                </div>
              </div>
            </div>
          }
        />

        {/* Dataset Overview Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#743C49]" />
              <h2 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
                Personal Wardrobe Training Set
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
            >
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E]">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0] block">
                Reviewed Garments
              </span>
              <div className="mt-2 text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8]">
                {stats?.total_reviewed_garments ?? 0}
              </div>
              <span className="text-[10px] font-mono text-[#777078] dark:text-[#A89E9B] mt-1 block">
                Out of {stats?.total_wardrobe_items ?? 0} total wardrobe pieces
              </span>
            </div>

            <div className="p-5 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E]">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#743C49] dark:text-[#D5A6A0] block">
                Eligible Training Samples
              </span>
              <div className="mt-2 text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8]">
                {stats?.total_eligible_training_examples ?? 0}
              </div>
              <span className="text-[10px] font-mono text-[#777078] dark:text-[#A89E9B] mt-1 block">
                With confirmed labels & original images
              </span>
            </div>

            <div className="p-5 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E]">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0] block">
                Confirmed Attributes
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-serif text-emerald-600 dark:text-emerald-400">
                  {stats?.total_accepted_attributes ?? 0}
                </span>
                <span className="text-[10px] font-mono text-[#777078]">acc</span>
                <span className="text-[#DCD4CC] dark:text-[#392F3E]">·</span>
                <span className="text-2xl font-serif text-[#743C49] dark:text-[#D5A6A0]">
                  {stats?.total_corrected_attributes ?? 0}
                </span>
                <span className="text-[10px] font-mono text-[#777078]">corr</span>
              </div>
              <span className="text-[10px] font-mono text-[#777078] dark:text-[#A89E9B] mt-1 block">
                {stats?.total_unconfirmed_attributes ?? 0} unconfirmed (masked from loss)
              </span>
            </div>

            <div className="p-5 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E]">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0] block">
                Dataset Readiness
              </span>
              <div className="mt-2 flex items-center gap-2">
                {stats?.dataset_ready ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-serif font-medium text-emerald-700 dark:text-emerald-300">
                      Ready to Fine-Tune
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-[#B49B82]" />
                    <span className="text-sm font-serif font-medium text-[#743C49] dark:text-[#D5A6A0]">
                      Awaiting Reviews
                    </span>
                  </>
                )}
              </div>
              <span className="text-[10px] font-mono text-[#777078] dark:text-[#A89E9B] mt-1 block truncate" title={stats?.readiness_summary}>
                {stats?.readiness_summary || 'Review garments in wardrobe to enable training.'}
              </span>
            </div>
          </div>

          {/* Head Class Representation Explorer */}
          {stats?.class_counts_per_head && (
            <div className="p-5 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
                    Class Distribution per Prediction Head
                  </h3>
                  <p className="text-xs text-[#777078] dark:text-[#A89E9B]">
                    Inspect confirmed samples per class. Classes with &lt; 3 samples are marked as insufficient for reliable evaluation.
                  </p>
                </div>

                {/* Head Selector Tabs */}
                <select
                  value={selectedHead}
                  onChange={(e) => setSelectedHead(e.target.value)}
                  className="px-3 py-1.5 rounded-[2px] text-xs font-mono bg-[#FAF6F0] dark:bg-[#2A222D] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
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
                  <div className="text-xs font-mono uppercase tracking-[0.1em] text-[#777078] italic py-2">
                    No confirmed attributes for {HEAD_NAMES[selectedHead]} yet.
                  </div>
                ) : (
                  Object.entries(stats.class_counts_per_head[selectedHead] || {}).map(([cls, count]: any) => {
                    const isInsufficient = count < 3;
                    return (
                      <div
                        key={cls}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-mono border transition-colors',
                          isInsufficient
                            ? 'bg-[#FAF6F0] dark:bg-[#2A222D] text-[#743C49] dark:text-[#D5A6A0] border-[#743C49]/30'
                            : 'bg-white dark:bg-[#1F1922] text-[#29202B] dark:text-[#F3EEE8] border-[#DCD4CC] dark:border-[#392F3E]'
                        )}
                      >
                        <span>{cls}</span>
                        <span
                          className={cn(
                            'px-1.5 py-0.2 rounded-[2px] text-[10px] font-mono font-bold',
                            isInsufficient
                              ? 'bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0]'
                              : 'bg-[#FAF6F0] dark:bg-[#2A222D] text-[#777078] dark:text-[#A89E9B]'
                          )}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Training Controls & Live Log Terminal */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#743C49]" />
              <h2 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
                Personal Fine-Tuning Execution
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfigModal(true)}
                disabled={Boolean(activeJobId) || isStartingTraining}
                icon={<Sliders className="w-3.5 h-3.5" />}
                className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
              >
                Configure (Epochs: {epochs}, LR: {learningRate})
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartTraining}
                disabled={Boolean(activeJobId) || isStartingTraining || !stats?.dataset_ready}
                icon={<Play className="w-3.5 h-3.5" />}
                className="bg-[#743C49] hover:bg-[#5C2F3A] text-white rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
              >
                {activeJobId ? 'Training in Progress...' : 'Start Fine-Tuning'}
              </Button>
            </div>
          </div>

          {/* Live Job Banner / Terminal */}
          {activeJobData && (
            <div className="p-5 rounded-[3px] border border-[#392F3E] bg-[#1F1922] text-[#F3EEE8] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#392F3E] pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#D5A6A0]" />
                  <span className="font-serif text-sm text-[#F3EEE8]">Training Job Console</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.14em]',
                      activeJobData.status === 'processing'
                        ? 'bg-[#B49B82]/20 text-[#D5A6A0] border border-[#B49B82]/40 animate-pulse'
                        : activeJobData.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-[#743C49]/20 text-rose-300 border border-[#743C49]/40'
                    )}
                  >
                    {activeJobData.status}
                  </span>
                </div>
                <span className="text-[#777078] text-[10px]">Job ID: {activeJobData.id}</span>
              </div>

              {/* Log Stream Window */}
              <div className="max-h-56 overflow-y-auto space-y-1 p-3 rounded-[2px] bg-[#161218] border border-[#392F3E] text-[11px] leading-relaxed">
                {activeJobData.logs && activeJobData.logs.length > 0 ? (
                  activeJobData.logs.map((log: string, idx: number) => (
                    <div key={idx} className="text-[#DCD4CC]">
                      <span className="text-[#D5A6A0] select-none mr-1.5">›</span>
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="text-[#777078] italic">Waiting for training job logs...</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Model Comparison & Promotion Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#743C49]" />
              <h2 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
                Model Comparison (Candidate vs Active Production)
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRollbackModal(true)}
                disabled={isRollingBack || versions.length < 2}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
              >
                Rollback Production
              </Button>
            </div>
          </div>

          {activeCandidate ? (
            <div className="p-6 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] space-y-6">
              {/* Promotion Eligibility Banner */}
              <div
                className={cn(
                  'flex items-center justify-between p-4 rounded-[2px] border',
                  comparison.comparison?.promotion_eligible
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                    : 'bg-[#FAF6F0] dark:bg-[#2A222D] border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8]'
                )}
              >
                <div className="flex items-center gap-3">
                  {comparison.comparison?.promotion_eligible ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-[#743C49] shrink-0" />
                  )}
                  <div>
                    <div className="font-serif text-sm">
                      {comparison.comparison?.promotion_eligible
                        ? 'Candidate Passed Evaluation Criteria'
                        : 'Candidate Has Metric Regressions'}
                    </div>
                    <div className="text-xs text-[#777078] dark:text-[#A89E9B] mt-0.5">
                      {comparison.comparison?.eligibility_summary}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRejectCandidate(activeCandidate.version_tag)}
                    icon={<X className="w-3.5 h-3.5" />}
                    className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
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
                    icon={<Check className="w-3.5 h-3.5" />}
                    className="bg-[#743C49] hover:bg-[#5C2F3A] text-white rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
                  >
                    Promote Candidate
                  </Button>
                </div>
              </div>

              {/* Overall Metrics Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-center">
                  <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0] block">
                    Overall Accuracy
                  </span>
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <span className="text-lg font-mono text-[#777078]">
                      {(comparison.comparison?.production_overall_accuracy * 100).toFixed(1)}%
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#777078]" />
                    <span className="text-2xl font-serif text-[#29202B] dark:text-[#F3EEE8]">
                      {(comparison.comparison?.candidate_overall_accuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div
                    className={cn(
                      'text-[10px] font-mono uppercase tracking-[0.1em] font-semibold mt-1',
                      comparison.comparison?.delta_overall_accuracy >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-[#743C49] dark:text-[#D5A6A0]'
                    )}
                  >
                    {comparison.comparison?.delta_overall_accuracy >= 0 ? '+' : ''}
                    {(comparison.comparison?.delta_overall_accuracy * 100).toFixed(1)}% Delta
                  </div>
                </div>

                <div className="p-4 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-center">
                  <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0] block">
                    Overall Macro F1
                  </span>
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <span className="text-lg font-mono text-[#777078]">
                      {(comparison.comparison?.production_overall_macro_f1 * 100).toFixed(1)}%
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#777078]" />
                    <span className="text-2xl font-serif text-[#29202B] dark:text-[#F3EEE8]">
                      {(comparison.comparison?.candidate_overall_macro_f1 * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div
                    className={cn(
                      'text-[10px] font-mono uppercase tracking-[0.1em] font-semibold mt-1',
                      comparison.comparison?.delta_overall_macro_f1 >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-[#743C49] dark:text-[#D5A6A0]'
                    )}
                  >
                    {comparison.comparison?.delta_overall_macro_f1 >= 0 ? '+' : ''}
                    {(comparison.comparison?.delta_overall_macro_f1 * 100).toFixed(1)}% Delta
                  </div>
                </div>

                <div className="p-4 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-center">
                  <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] dark:text-[#D5A6A0] block">
                    Held-Out Test Set Size
                  </span>
                  <div className="mt-2 text-2xl font-serif text-[#29202B] dark:text-[#F3EEE8]">
                    {comparison.comparison?.test_sample_count ?? 0} samples
                  </div>
                  <span className="text-[10px] font-mono text-[#777078] mt-1 block">
                    Isolated held-out test split
                  </span>
                </div>
              </div>

              {/* Per-Head Comparison Breakdown Table */}
              <div className="border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF6F0] dark:bg-[#2A222D] text-[#777078] dark:text-[#D5A6A0] font-mono uppercase tracking-[0.12em] text-[10px] border-b border-[#DCD4CC] dark:border-[#392F3E]">
                      <th className="py-2.5 px-4">Prediction Head</th>
                      <th className="py-2.5 px-4 text-center">Production Acc</th>
                      <th className="py-2.5 px-4 text-center">Candidate Acc</th>
                      <th className="py-2.5 px-4 text-center">Δ Accuracy</th>
                      <th className="py-2.5 px-4 text-center">Δ Macro F1</th>
                      <th className="py-2.5 px-4 text-right">Test Support</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCD4CC] dark:divide-[#392F3E]">
                    {Object.entries(HEAD_NAMES).map(([headKey, headLabel]) => {
                      const headData = comparison.comparison?.heads?.[headKey];
                      if (!headData) return null;
                      const deltaAcc = headData.delta_accuracy;
                      const deltaF1 = headData.delta_macro_f1;

                      return (
                        <tr key={headKey} className="hover:bg-[#FAF6F0]/50 dark:hover:bg-[#241D27]">
                          <td className="py-2.5 px-4 font-serif text-sm text-[#29202B] dark:text-[#F3EEE8]">
                            {headLabel}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-[#777078]">
                            {(headData.production?.accuracy * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                            {(headData.candidate?.accuracy * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded-[2px] font-mono font-semibold text-[10px]',
                                deltaAcc > 0
                                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                  : deltaAcc < 0
                                  ? 'bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0] border border-[#743C49]/30'
                                  : 'text-[#777078]'
                              )}
                            >
                              {deltaAcc > 0 ? '+' : ''}
                              {(deltaAcc * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded-[2px] font-mono font-semibold text-[10px]',
                                deltaF1 > 0
                                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                  : deltaF1 < 0
                                  ? 'bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0] border border-[#743C49]/30'
                                  : 'text-[#777078]'
                              )}
                            >
                              {deltaF1 > 0 ? '+' : ''}
                              {(deltaF1 * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-[#777078]">
                            {headData.candidate?.support ?? 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] text-center space-y-3">
              <Cpu className="w-8 h-8 text-[#777078] mx-auto" />
              <h3 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
                No Candidate Model Available for Comparison
              </h3>
              <p className="text-xs text-[#777078] dark:text-[#A89E9B] max-w-md mx-auto">
                Fine-tune a candidate model above to evaluate accuracy improvements side-by-side with your active production model.
              </p>
            </div>
          )}
        </div>

        {/* Model Versions Audit Trail */}
        <div className="space-y-4">
          <h2 className="text-base font-serif text-[#29202B] dark:text-[#F3EEE8]">
            Model Version Repository
          </h2>

          <div className="border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] overflow-hidden bg-white dark:bg-[#1F1922]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF6F0] dark:bg-[#2A222D] text-[#777078] dark:text-[#D5A6A0] font-mono uppercase tracking-[0.12em] text-[10px] border-b border-[#DCD4CC] dark:border-[#392F3E]">
                  <th className="py-3 px-4">Version Tag</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Base Checkpoint</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCD4CC] dark:divide-[#392F3E]">
                {versions.map((v) => (
                  <tr key={v.version_tag} className="hover:bg-[#FAF6F0]/50 dark:hover:bg-[#241D27]">
                    <td className="py-3 px-4 font-mono font-bold text-[#29202B] dark:text-[#F3EEE8]">
                      {v.version_tag}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.12em]',
                          v.status === 'production'
                            ? 'bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0] border border-[#743C49]/30'
                            : v.status === 'candidate'
                            ? 'bg-[#B49B82]/20 text-[#29202B] dark:text-[#DCD4CC] border border-[#B49B82]/40'
                            : v.status === 'rejected'
                            ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                            : 'bg-[#FAF6F0] dark:bg-[#2A222D] text-[#777078]'
                        )}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#777078] font-mono text-[11px]">
                      {v.created_at ? new Date(v.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#777078] text-[11px] truncate max-w-xs" title={v.checkpoint_path}>
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
                          className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
                        >
                          Promote
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1">
                Epochs
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={epochs}
                onChange={(e) => setEpochs(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 rounded-[2px] text-sm bg-[#FAF6F0] dark:bg-[#2A222D] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
              />
              <span className="text-[10px] font-mono text-[#777078] mt-1 block">
                Recommended: 5 to 10 epochs for controlled fine-tuning without overfitting.
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1">
                Learning Rate
              </label>
              <input
                type="text"
                value={learningRate}
                onChange={(e) => setLearningRate(e.target.value)}
                className="w-full px-3 py-2 rounded-[2px] text-sm bg-[#FAF6F0] dark:bg-[#2A222D] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] font-mono focus:outline-none focus:border-[#743C49]"
              />
              <span className="text-[10px] font-mono text-[#777078] mt-1 block">
                Default: 0.0001 (gentle fine-tuning rate).
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1">
                Batch Size
              </label>
              <input
                type="number"
                min={1}
                max={64}
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 16)}
                className="w-full px-3 py-2 rounded-[2px] text-sm bg-[#FAF6F0] dark:bg-[#2A222D] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#DCD4CC] dark:border-[#392F3E]">
              <Button variant="ghost" onClick={() => setShowConfigModal(false)} className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]">
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setShowConfigModal(false)} className="bg-[#743C49] text-white rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]">
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
            <div className="p-4 rounded-[2px] bg-[#FAF6F0] dark:bg-[#2A222D] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] text-xs leading-relaxed">
              <strong className="font-serif">Notice:</strong> Promoting this candidate model will immediately update the active production checkpoint.
              All future garment uploads and AI predictions will use this model. You can roll back at any time.
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#DCD4CC] dark:border-[#392F3E]">
              <Button variant="ghost" onClick={() => setShowPromoteModal(false)} disabled={isPromoting} className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]">
                Cancel
              </Button>
              <Button variant="primary" onClick={handlePromoteCandidate} disabled={isPromoting} className="bg-[#743C49] text-white rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]">
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
            <div className="p-4 rounded-[2px] bg-[#FAF6F0] dark:bg-[#2A222D] border border-[#DCD4CC] dark:border-[#392F3E] text-xs text-[#29202B] dark:text-[#F3EEE8] leading-relaxed">
              The active production model will be reverted to the previous working production checkpoint or baseline <code>best_model.pt</code>.
              Live predictions will immediately switch back.
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#DCD4CC] dark:border-[#392F3E]">
              <Button variant="ghost" onClick={() => setShowRollbackModal(false)} disabled={isRollingBack} className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]">
                Cancel
              </Button>
              <Button variant="primary" onClick={handleRollback} disabled={isRollingBack} className="bg-[#743C49] text-white rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]">
                {isRollingBack ? 'Rolling back...' : 'Confirm Rollback'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
};
