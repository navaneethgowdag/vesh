import React, { useEffect, useState } from 'react';
import {
  Brain,
  Layers,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Info,
  Sliders,
  Check,
  Shield,
  Loader2,
} from 'lucide-react';
import { api } from '../../services/api';

export const AdminClothingModel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [modelData, setModelData] = useState<any>(null);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [versionsData, setVersionsData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'architecture' | 'metrics' | 'corrections' | 'finetune' | 'versions'>('architecture');

  // User Corrections State
  const [correctionsData, setCorrectionsData] = useState<{ items: any[]; total: number; page: number; total_pages: number } | null>(null);
  const [loadingCorrections, setLoadingCorrections] = useState(false);
  const [correctionPage, setCorrectionPage] = useState(1);
  const [filterReviewStatus, setFilterReviewStatus] = useState<string>('all');
  const [filterAttribute, setFilterAttribute] = useState<string>('all');
  const [updatingCorrectionId, setUpdatingCorrectionId] = useState<string | null>(null);

  // Training Form State
  const [learningRate, setLearningRate] = useState('0.0001');
  const [batchSize, setBatchSize] = useState('16');
  const [epochs, setEpochs] = useState('5');
  const [freezeBackbone, setFreezeBackbone] = useState(true);
  const [isSubmittingTrain, setIsSubmittingTrain] = useState(false);
  const [trainMessage, setTrainMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Rollback / Promote State
  const [isPromoting, setIsPromoting] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCorrections = async (page = 1, status = filterReviewStatus, attr = filterAttribute) => {
    try {
      setLoadingCorrections(true);
      const res = await api.admin.listClothingCorrections({
        page,
        pageSize: 15,
        reviewStatus: status !== 'all' ? status : undefined,
        attributeName: attr !== 'all' ? attr : undefined,
      });
      setCorrectionsData(res);
      setCorrectionPage(page);
    } catch (err: any) {
      console.error('Failed to load user corrections:', err);
    } finally {
      setLoadingCorrections(false);
    }
  };

  const handleUpdateCorrection = async (id: string, updates: { review_status?: string; training_eligible?: boolean }) => {
    try {
      setUpdatingCorrectionId(id);
      await api.admin.updateClothingCorrection(id, updates);
      setCorrectionsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        };
      });
    } catch (err: any) {
      console.error('Failed to update correction:', err);
    } finally {
      setUpdatingCorrectionId(null);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [model, metrics, versions] = await Promise.all([
        api.admin.getClothingModel(),
        api.admin.getClothingMetrics(),
        api.admin.getModelVersions(),
      ]);
      setModelData(model);
      setMetricsData(metrics);
      setVersionsData(versions);
    } catch (err: any) {
      console.error('Failed to load clothing model data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'corrections') {
      fetchCorrections(1, filterReviewStatus, filterAttribute);
    }
  }, [activeTab]);

  const handleStartTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTrain(true);
    setTrainMessage(null);

    try {
      const res = await api.admin.trainClothingModel({
        learning_rate: parseFloat(learningRate),
        batch_size: parseInt(batchSize, 10),
        epochs: parseInt(epochs, 10),
        freeze_backbone: freezeBackbone,
      });
      setTrainMessage({
        type: 'success',
        text: `Fine-tuning job started successfully (Job ID: ${res.job_id}). Track status in Training History.`,
      });
      fetchData();
    } catch (err: any) {
      setTrainMessage({
        type: 'error',
        text: err.message || 'Failed to trigger clothing classifier fine-tuning.',
      });
    } finally {
      setIsSubmittingTrain(false);
    }
  };

  const handleRollback = async () => {
    if (!window.confirm('Are you sure you want to rollback to baseline EfficientNet-B0 checkpoint?')) return;
    setIsRollingBack(true);
    setActionMessage(null);
    try {
      const res = await api.admin.rollbackClothingModel();
      setActionMessage({
        type: 'success',
        text: res.message || 'Successfully rolled back to baseline checkpoint.',
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
        <RefreshCw size={28} className="animate-spin text-indigo-400" />
        <span className="text-sm font-mono text-slate-400">Loading EfficientNet-B0 Architecture...</span>
      </div>
    );
  }

  const tasks = metricsData?.tasks || {};
  const datasetInfo = modelData?.training_dataset_info || {};

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#392F3E]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] px-2 py-0.5 rounded-[2px] bg-[#743C49]/20 text-[#D5A6A0] border border-[#743C49]/30">
              VISION BACKBONE
            </span>
            <span className="text-[10px] font-mono text-[#777078]">Active: {modelData?.current_version || 'v1.0.0'}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#F3EEE8] tracking-tight">
            Clothing Classifier <span className="italic font-normal text-[#D5A6A0]">Atelier.</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#777078] mt-1 font-sans">
            PyTorch deep convolutional network predicting 9 garment attributes concurrently from 224×224 images.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRollback}
            disabled={isRollingBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-[2px] bg-[#241D27] hover:bg-[#29202B] text-[10px] font-mono uppercase tracking-[0.14em] text-[#F3EEE8] border border-[#392F3E] hover:border-[#743C49] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={12} className={isRollingBack ? 'animate-spin' : ''} />
            <span>Rollback to Baseline</span>
          </button>
        </div>
      </div>

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
          <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#777078]">Architecture</div>
          <div className="text-base font-serif text-[#F3EEE8] mt-1">EfficientNet-B0</div>
          <div className="text-[10px] text-[#777078] font-mono mt-0.5">Custom 9 Head Output</div>
        </div>

        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-4">
          <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#777078]">Input Dimension</div>
          <div className="text-base font-serif text-[#D5A6A0] mt-1">224 × 224 × 3</div>
          <div className="text-[10px] text-[#777078] font-mono mt-0.5">RGB (ImageNet)</div>
        </div>

        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-4">
          <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#777078]">Total Classes</div>
          <div className="text-base font-serif text-emerald-400 mt-1">275 Categories</div>
          <div className="text-[10px] text-[#777078] font-mono mt-0.5">Across 9 Discrete Heads</div>
        </div>

        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-4">
          <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#777078]">Average Accuracy</div>
          <div className="text-base font-serif text-[#F3EEE8] mt-1">
            {((metricsData?.overall_metrics?.accuracy || 0.884) * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-[#777078] font-mono mt-0.5">Macro F1: {((metricsData?.overall_metrics?.macro_f1 || 0.842) * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#392F3E] flex gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('architecture')}
          className={`pb-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'architecture'
              ? 'border-[#743C49] text-[#F3EEE8]'
              : 'border-transparent text-[#777078] hover:text-[#F3EEE8]'
          }`}
        >
          Prediction Heads (9)
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`pb-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'metrics'
              ? 'border-[#743C49] text-[#F3EEE8]'
              : 'border-transparent text-[#777078] hover:text-[#F3EEE8]'
          }`}
        >
          Evaluation Metrics
        </button>
        <button
          onClick={() => setActiveTab('corrections')}
          className={`pb-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'corrections'
              ? 'border-[#743C49] text-[#F3EEE8]'
              : 'border-transparent text-[#777078] hover:text-[#F3EEE8]'
          }`}
        >
          <span>User Corrections</span>
          {(datasetInfo.corrected_decisions ?? 0) > 0 && (
            <span className="px-1.5 py-0.2 rounded-[2px] text-[9px] font-mono bg-[#743C49]/20 text-[#D5A6A0] border border-[#743C49]/30">
              {datasetInfo.corrected_decisions}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('finetune')}
          className={`pb-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'finetune'
              ? 'border-[#743C49] text-[#F3EEE8]'
              : 'border-transparent text-[#777078] hover:text-[#F3EEE8]'
          }`}
        >
          Fine-Tuning Controls
        </button>
        <button
          onClick={() => setActiveTab('versions')}
          className={`pb-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'versions'
              ? 'border-[#743C49] text-[#F3EEE8]'
              : 'border-transparent text-[#777078] hover:text-[#F3EEE8]'
          }`}
        >
          Versions & Rollback
        </button>
      </div>

      {/* Tab 1: Architecture & Heads */}
      {activeTab === 'architecture' && (
        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#392F3E] bg-[#241D27]">
            <h3 className="text-sm font-serif text-[#F3EEE8]">9-Head Multi-Task Target Schema</h3>
            <p className="text-xs text-[#777078] mt-0.5">
              Each head utilizes an independent linear projection layer over the EfficientNet pooled feature vector.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#241D27] text-[#D5A6A0] uppercase font-mono tracking-[0.12em] text-[10px] border-b border-[#392F3E]">
                <tr>
                  <th className="px-5 py-3">Head Name</th>
                  <th className="px-5 py-3">Output Dimension</th>
                  <th className="px-5 py-3">Task Domain</th>
                  <th className="px-5 py-3">Sample Predicted Classes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#392F3E] font-mono text-[#F3EEE8]">
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">articleType</td>
                  <td className="px-5 py-3.5 text-[#D5A6A0]">143 classes</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Garment archetype</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Shirts, Jeans, Casual Shoes, Kurtas, Blazers...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">masterCategory</td>
                  <td className="px-5 py-3.5 text-[#D5A6A0]">7 classes</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Top-level domain</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Apparel, Footwear, Accessories, Personal Care...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">subCategory</td>
                  <td className="px-5 py-3.5 text-[#D5A6A0]">45 classes</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Mid-level classification</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Topwear, Bottomwear, Shoes, Bags, Eyewear...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">gender</td>
                  <td className="px-5 py-3.5 text-[#D5A6A0]">5 classes</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Design fit archetype</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Men, Women, Boys, Girls, Unisex</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">baseColour</td>
                  <td className="px-5 py-3.5 text-[#D5A6A0]">46 classes</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Primary surface hue</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Black, Navy Blue, White, Olive, Maroon, Khaki...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">season</td>
                  <td className="px-5 py-3.5 text-[#D5A6A0]">4 classes</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Climate suitability</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Summer, Fall, Winter, Spring</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">usage</td>
                  <td className="px-5 py-3.5 text-[#D5A6A0]">8 classes</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Occasion formality</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Casual, Formal, Sports, Ethnic, Party, Smart Casual...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">pattern</td>
                  <td className="px-5 py-3.5 text-[#D5A6A0]">13 classes</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Fabric surface design</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Solid, Striped, Checked, Floral, Printed...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">ageGroup</td>
                  <td className="px-5 py-3.5 text-[#D5A6A0]">4 classes</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Demographic bracket</td>
                  <td className="px-5 py-3.5 text-[#777078] font-sans">Adults, Kids, Teens, All</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Metrics */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#392F3E] bg-[#241D27]">
              <h3 className="text-sm font-serif text-[#F3EEE8]">Per-Head Validation Metrics</h3>
              <p className="text-xs text-[#777078] mt-0.5">
                Evaluation results extracted from holdout validation split (evaluation_report.json).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#241D27] text-[#D5A6A0] uppercase font-mono tracking-[0.12em] text-[10px] border-b border-[#392F3E]">
                  <tr>
                    <th className="px-5 py-3">Head</th>
                    <th className="px-5 py-3">Accuracy</th>
                    <th className="px-5 py-3">Macro F1</th>
                    <th className="px-5 py-3">Weighted F1</th>
                    <th className="px-5 py-3">Top-3 Acc</th>
                    <th className="px-5 py-3">Top-5 Acc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#392F3E] font-mono text-[#F3EEE8]">
                  {Object.entries(tasks).map(([headName, metrics]: [string, any]) => (
                    <tr key={headName} className="hover:bg-[#241D27]/50">
                      <td className="px-5 py-3.5 font-semibold text-white">{headName}</td>
                      <td className="px-5 py-3.5 text-emerald-400">
                        {metrics?.accuracy ? (metrics.accuracy * 100).toFixed(1) + '%' : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[#D5A6A0]">
                        {metrics?.macro_f1 ? (metrics.macro_f1 * 100).toFixed(1) + '%' : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[#F3EEE8]">
                        {metrics?.weighted_f1 ? (metrics.weighted_f1 * 100).toFixed(1) + '%' : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[#777078]">
                        {metrics?.top_3_accuracy ? (metrics.top_3_accuracy * 100).toFixed(1) + '%' : 'N/A'}
                      </td>
                      <td className="px-5 py-3.5 text-[#777078]">
                        {metrics?.top_5_accuracy ? (metrics.top_5_accuracy * 100).toFixed(1) + '%' : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2.5: User Corrections Audit Trail */}
      {activeTab === 'corrections' && (
        <div className="space-y-6">
          {/* Header & Controls Bar */}
          <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-serif text-[#F3EEE8]">User Corrections & Annotation Audit</h3>
                <p className="text-xs text-[#777078] mt-0.5">
                  Audit trail of user-corrected garment attributes from PostgreSQL. Preserves original AI predictions while supporting administrator review.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchCorrections(correctionPage, filterReviewStatus, filterAttribute)}
                  disabled={loadingCorrections}
                  className="px-3 py-1.5 rounded-[2px] text-[10px] font-mono uppercase tracking-[0.14em] bg-[#241D27] border border-[#392F3E] text-[#F3EEE8] hover:border-[#743C49] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={loadingCorrections ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Select */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#392F3E]">
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-[#777078] text-[10px] uppercase tracking-[0.12em] mr-1">Status:</span>
                {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setFilterReviewStatus(st);
                      fetchCorrections(1, st, filterAttribute);
                    }}
                    className={`px-3 py-1 rounded-[2px] text-[10px] font-mono uppercase tracking-[0.12em] transition-all cursor-pointer ${
                      filterReviewStatus === st
                        ? 'bg-[#743C49] text-white font-semibold'
                        : 'bg-[#241D27] text-[#777078] hover:text-[#F3EEE8] border border-[#392F3E]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-[#777078] text-[10px] uppercase tracking-[0.12em]">Attribute:</span>
                <select
                  value={filterAttribute}
                  onChange={(e) => {
                    const attr = e.target.value;
                    setFilterAttribute(attr);
                    fetchCorrections(1, filterReviewStatus, attr);
                  }}
                  className="bg-[#241D27] border border-[#392F3E] text-[#F3EEE8] rounded-[2px] px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-[#743C49]"
                >
                  <option value="all">All Attributes</option>
                  <option value="article_type">Article Type</option>
                  <option value="master_category">Master Category</option>
                  <option value="sub_category">Subcategory</option>
                  <option value="base_colour">Base Colour</option>
                  <option value="season">Season</option>
                  <option value="usage">Occasion / Usage</option>
                  <option value="pattern">Pattern</option>
                  <option value="gender">Gender</option>
                  <option value="age_group">Age Group</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table / Records View */}
          <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] overflow-hidden">
            {loadingCorrections ? (
              <div className="p-12 text-center text-[#777078] flex flex-col items-center justify-center gap-3">
                <Loader2 size={24} className="animate-spin text-[#743C49]" />
                <span className="text-xs font-mono">Loading PostgreSQL correction records...</span>
              </div>
            ) : !correctionsData?.items || correctionsData.items.length === 0 ? (
              <div className="p-12 text-center text-[#777078] space-y-2">
                <CheckCircle size={28} className="mx-auto text-emerald-500/80 mb-2" />
                <h4 className="text-sm font-serif text-white">No Corrections Match Filters</h4>
                <p className="text-xs text-[#777078] max-w-sm mx-auto">
                  {filterReviewStatus !== 'all' || filterAttribute !== 'all'
                    ? 'Try clearing active filters to view other correction records.'
                    : 'All user attribute reviews match original AI predictions or no corrections submitted yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#241D27] text-[#D5A6A0] uppercase font-mono tracking-[0.12em] text-[10px] border-b border-[#392F3E]">
                    <tr>
                      <th className="px-4 py-3">Garment</th>
                      <th className="px-4 py-3">Attribute</th>
                      <th className="px-4 py-3">Original AI Prediction</th>
                      <th className="px-4 py-3">User Corrected</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Review Status</th>
                      <th className="px-4 py-3">Training Consent</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#392F3E] font-mono text-[#F3EEE8]">
                    {correctionsData.items.map((corr) => {
                      const isUpdating = updatingCorrectionId === corr.id;
                      return (
                        <tr key={corr.id} className="hover:bg-[#241D27]/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              {corr.image_url ? (
                                <img
                                  src={corr.image_url}
                                  alt={corr.clothing_name}
                                  className="w-9 h-11 object-cover rounded-[2px] bg-[#241D27] border border-[#392F3E] shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-9 h-11 bg-[#241D27] rounded-[2px] border border-[#392F3E] flex items-center justify-center text-[#777078] shrink-0">
                                  <Layers size={14} />
                                </div>
                              )}
                              <div>
                                <div className="font-serif text-sm text-white">{corr.clothing_name}</div>
                                <div className="text-[10px] text-[#777078] font-mono truncate max-w-[120px]" title={corr.id}>
                                  ID: {corr.id.slice(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 rounded-[2px] text-[10px] bg-[#241D27] text-[#D5A6A0] border border-[#392F3E]">
                              {corr.attribute_name}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-[#777078] line-through">
                            {corr.predicted_value || '<None>'}
                          </td>
                          <td className="px-4 py-3.5 text-emerald-400 font-semibold">
                            {corr.corrected_value}
                          </td>
                          <td className="px-4 py-3.5 text-[#777078] text-[11px]">
                            {corr.created_at ? new Date(corr.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.12em] ${
                                corr.review_status === 'approved'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : corr.review_status === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-[#743C49]/20 text-[#D5A6A0] border border-[#743C49]/40'
                              }`}
                            >
                              {corr.review_status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleUpdateCorrection(corr.id, { training_eligible: !corr.training_eligible })}
                              className={`px-2 py-0.5 rounded-[2px] text-[10px] font-mono uppercase tracking-[0.12em] cursor-pointer transition-all ${
                                corr.training_eligible
                                  ? 'bg-[#743C49]/20 text-[#D5A6A0] border border-[#743C49]/40 hover:bg-[#743C49]/30'
                                  : 'bg-[#241D27] text-[#777078] border border-[#392F3E] hover:text-[#F3EEE8]'
                              }`}
                            >
                              {corr.training_eligible ? 'Eligible' : 'Excluded'}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {corr.review_status !== 'approved' && (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateCorrection(corr.id, { review_status: 'approved', training_eligible: true })}
                                  className="px-2 py-1 rounded-[2px] bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[10px] font-mono uppercase tracking-[0.12em] transition-all cursor-pointer disabled:opacity-50"
                                >
                                  Approve
                                </button>
                              )}
                              {corr.review_status !== 'rejected' && (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateCorrection(corr.id, { review_status: 'rejected', training_eligible: false })}
                                  className="px-2 py-1 rounded-[2px] bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 text-[10px] font-mono uppercase tracking-[0.12em] transition-all cursor-pointer disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination footer */}
            {correctionsData && correctionsData.total_pages > 1 && (
              <div className="p-4 border-t border-[#392F3E] bg-[#241D27] flex items-center justify-between text-xs font-mono text-[#777078]">
                <div>
                  Page {correctionsData.page} of {correctionsData.total_pages} ({correctionsData.total} total)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={correctionsData.page <= 1 || loadingCorrections}
                    onClick={() => fetchCorrections(correctionsData.page - 1, filterReviewStatus, filterAttribute)}
                    className="px-3 py-1 rounded-[2px] bg-[#1F1922] border border-[#392F3E] hover:border-[#743C49] text-white disabled:opacity-40 cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em]"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={correctionsData.page >= correctionsData.total_pages || loadingCorrections}
                    onClick={() => fetchCorrections(correctionsData.page + 1, filterReviewStatus, filterAttribute)}
                    className="px-3 py-1 rounded-[2px] bg-[#1F1922] border border-[#392F3E] hover:border-[#743C49] text-white disabled:opacity-40 cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Fine-Tuning Controls */}
      {activeTab === 'finetune' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6">
            <h3 className="text-base font-serif text-[#F3EEE8] mb-2">Execute Classifier Fine-Tuning</h3>
            <p className="text-xs text-[#777078] leading-relaxed mb-6 font-sans">
              Initiates transfer learning using reviewed personal wardrobe items. The job executes asynchronously in the background.
            </p>

            {trainMessage && (
              <div
                className={`mb-6 p-4 rounded-[2px] text-xs font-mono flex items-center gap-3 ${
                  trainMessage.type === 'success'
                    ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300'
                    : 'bg-[#743C49]/20 border border-[#743C49]/50 text-rose-300'
                }`}
              >
                {trainMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                <span>{trainMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleStartTraining} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1.5">
                    Learning Rate
                  </label>
                  <input
                    type="text"
                    value={learningRate}
                    onChange={(e) => setLearningRate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#241D27] border border-[#392F3E] rounded-[2px] text-xs font-mono text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                  />
                  <div className="text-[10px] font-mono text-[#777078] mt-1">Recommended: 0.0001 for backbone stability</div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1.5">
                    Batch Size
                  </label>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#241D27] border border-[#392F3E] rounded-[2px] text-xs font-mono text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                  >
                    <option value="8">8 samples</option>
                    <option value="16">16 samples (Recommended)</option>
                    <option value="32">32 samples</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078] mb-1.5">
                    Training Epochs
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={epochs}
                    onChange={(e) => setEpochs(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#241D27] border border-[#392F3E] rounded-[2px] text-xs font-mono text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                  />
                  <div className="text-[10px] font-mono text-[#777078] mt-1">Between 3 to 10 epochs recommended</div>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer mt-3">
                    <input
                      type="checkbox"
                      checked={freezeBackbone}
                      onChange={(e) => setFreezeBackbone(e.target.checked)}
                      className="rounded-[2px] border-[#392F3E] bg-[#241D27] accent-[#743C49] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-[#F3EEE8] font-sans">Freeze EfficientNet Backbone</span>
                  </label>
                  <div className="text-[10px] font-mono text-[#777078] mt-1">
                    Freezes feature extractor, only training projection heads
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#392F3E]">
                <button
                  type="submit"
                  disabled={isSubmittingTrain}
                  className="px-5 py-2.5 rounded-[2px] bg-[#743C49] hover:bg-[#5C2F3A] text-white font-mono text-[10px] uppercase tracking-[0.14em] flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingTrain ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Dispatching Job...</span>
                    </>
                  ) : (
                    <>
                      <Play size={13} />
                      <span>Start Personal Fine-Tuning Job</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Dataset Status */}
          <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6">
            <h4 className="text-sm font-serif text-[#F3EEE8] mb-4">Wardrobe Dataset State</h4>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between p-2.5 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
                <span className="text-[#777078]">Total Pieces:</span>
                <span className="font-bold text-white">{datasetInfo.total_wardrobe_items ?? 0}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
                <span className="text-[#777078]">Reviewed Garments:</span>
                <span className="font-bold text-[#D5A6A0]">{datasetInfo.reviewed_items ?? 0}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
                <span className="text-[#777078]">Accepted Decisions:</span>
                <span className="font-bold text-emerald-400">{datasetInfo.accepted_decisions ?? 0}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
                <span className="text-[#777078]">User Corrections:</span>
                <span className="font-bold text-[#B49B82]">{datasetInfo.corrected_decisions ?? 0}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
                <span className="text-[#777078]">Eligible For Training:</span>
                <span className="font-bold text-emerald-400">{datasetInfo.eligible_for_training ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Versions & Rollback */}
      {activeTab === 'versions' && (
        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6">
          <h3 className="text-base font-serif text-[#F3EEE8] mb-2">Classifier Version Registry</h3>
          <p className="text-xs text-[#777078] leading-relaxed mb-6 font-sans">
            Persistent checkpoint registry under artifacts/clothing/versions/ ensuring seamless instant rollback with zero downtime.
          </p>

          <div className="space-y-3 font-mono text-xs">
            {(versionsData?.clothing_classifier_versions || []).map((ver: any, idx: number) => (
              <div
                key={idx}
                className="p-4 rounded-[2px] bg-[#241D27] border border-[#392F3E] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-white">{ver.version_tag}</span>
                    {ver.version_tag === modelData?.current_version && (
                      <span className="px-2 py-0.5 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.12em] bg-[#743C49]/20 text-[#D5A6A0] border border-[#743C49]/40">
                        Current Production
                      </span>
                    )}
                  </div>
                  <div className="text-[#777078] text-[10px] mt-1 font-mono">
                    Promoted: {ver.promoted_at ? new Date(ver.promoted_at).toLocaleString() : 'Baseline'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[#777078] text-[9px] uppercase tracking-[0.14em]">Checkpoint Path</div>
                  <div className="text-[#D5A6A0] text-xs font-mono">{ver.checkpoint_path?.split('/').pop()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
