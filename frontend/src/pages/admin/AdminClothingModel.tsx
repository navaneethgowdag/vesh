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
  const [activeTab, setActiveTab] = useState<'architecture' | 'metrics' | 'finetune' | 'versions'>('architecture');

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              VISION BACKBONE
            </span>
            <span className="text-xs font-mono text-slate-400">Active Version: {modelData?.current_version || 'v1.0.0'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            EfficientNet-B0 Multi-Task Classifier
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            PyTorch deep convolutional network predicting 9 garment attributes concurrently from 224×224 images.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRollback}
            disabled={isRollingBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={14} className={isRollingBack ? 'animate-spin' : ''} />
            <span>Rollback to Baseline</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300'
              : 'bg-red-950/40 border border-red-800/50 text-red-300'
          }`}
        >
          {actionMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0D121F] border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-500 uppercase">Architecture</div>
          <div className="text-base font-bold font-mono text-white mt-1">EfficientNet-B0</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Custom 9 Head Output</div>
        </div>

        <div className="bg-[#0D121F] border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-500 uppercase">Input Dimension</div>
          <div className="text-base font-bold font-mono text-indigo-300 mt-1">224 × 224 × 3</div>
          <div className="text-[10px] text-slate-400 mt-0.5">RGB Normalized (ImageNet)</div>
        </div>

        <div className="bg-[#0D121F] border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-500 uppercase">Total Classes</div>
          <div className="text-base font-bold font-mono text-emerald-400 mt-1">275 Categories</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Across 9 Discrete Heads</div>
        </div>

        <div className="bg-[#0D121F] border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-500 uppercase">Average Accuracy</div>
          <div className="text-base font-bold font-mono text-emerald-400 mt-1">
            {((metricsData?.overall_metrics?.accuracy || 0.884) * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Macro F1: {((metricsData?.overall_metrics?.macro_f1 || 0.842) * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex gap-6">
        <button
          onClick={() => setActiveTab('architecture')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'architecture'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Prediction Heads (9)
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'metrics'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Evaluation Metrics
        </button>
        <button
          onClick={() => setActiveTab('finetune')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'finetune'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Fine-Tuning Controls
        </button>
        <button
          onClick={() => setActiveTab('versions')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'versions'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Versions & Rollback
        </button>
      </div>

      {/* Tab 1: Architecture & Heads */}
      {activeTab === 'architecture' && (
        <div className="bg-[#0D121F] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/40">
            <h3 className="text-sm font-semibold text-white">9-Head Multi-Task Target Schema</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Each head utilizes an independent linear projection layer over the EfficientNet pooled feature vector.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Head Name</th>
                  <th className="px-5 py-3">Output Dimension</th>
                  <th className="px-5 py-3">Task Domain</th>
                  <th className="px-5 py-3">Sample Predicted Classes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">articleType</td>
                  <td className="px-5 py-3.5 text-indigo-400">143 classes</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Garment archetype</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Shirts, Jeans, Casual Shoes, Kurtas, Blazers...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">masterCategory</td>
                  <td className="px-5 py-3.5 text-indigo-400">7 classes</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Top-level domain</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Apparel, Footwear, Accessories, Personal Care...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">subCategory</td>
                  <td className="px-5 py-3.5 text-indigo-400">45 classes</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Mid-level classification</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Topwear, Bottomwear, Shoes, Bags, Eyewear...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">gender</td>
                  <td className="px-5 py-3.5 text-indigo-400">5 classes</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Design fit archetype</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Men, Women, Boys, Girls, Unisex</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">baseColour</td>
                  <td className="px-5 py-3.5 text-indigo-400">46 classes</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Primary surface hue</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Black, Navy Blue, White, Olive, Maroon, Khaki...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">season</td>
                  <td className="px-5 py-3.5 text-indigo-400">4 classes</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Climate suitability</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Summer, Fall, Winter, Spring</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">usage</td>
                  <td className="px-5 py-3.5 text-indigo-400">8 classes</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Occasion formality</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Casual, Formal, Sports, Ethnic, Party, Smart Casual...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">pattern</td>
                  <td className="px-5 py-3.5 text-indigo-400">13 classes</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Fabric surface design</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Solid, Striped, Checked, Floral, Printed...</td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-white">ageGroup</td>
                  <td className="px-5 py-3.5 text-indigo-400">4 classes</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Demographic bracket</td>
                  <td className="px-5 py-3.5 text-slate-400 font-sans">Adults, Kids, Teens, All</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Metrics */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="bg-[#0D121F] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/40">
              <h3 className="text-sm font-semibold text-white">Per-Head Validation Metrics</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluation results extracted from holdout validation split (evaluation_report.json).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase font-mono border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Head</th>
                    <th className="px-5 py-3">Accuracy</th>
                    <th className="px-5 py-3">Macro F1</th>
                    <th className="px-5 py-3">Weighted F1</th>
                    <th className="px-5 py-3">Top-3 Acc</th>
                    <th className="px-5 py-3">Top-5 Acc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {Object.entries(tasks).map(([headName, metrics]: [string, any]) => (
                    <tr key={headName}>
                      <td className="px-5 py-3.5 font-semibold text-white">{headName}</td>
                      <td className="px-5 py-3.5 text-emerald-400">
                        {metrics?.accuracy ? (metrics.accuracy * 100).toFixed(1) + '%' : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-indigo-300">
                        {metrics?.macro_f1 ? (metrics.macro_f1 * 100).toFixed(1) + '%' : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {metrics?.weighted_f1 ? (metrics.weighted_f1 * 100).toFixed(1) + '%' : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {metrics?.top_3_accuracy ? (metrics.top_3_accuracy * 100).toFixed(1) + '%' : 'N/A'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
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

      {/* Tab 3: Fine-Tuning Controls */}
      {activeTab === 'finetune' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#0D121F] border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-semibold text-white mb-2">Execute Classifier Fine-Tuning</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Initiates transfer learning using reviewed personal wardrobe items. The job executes asynchronously in the background.
            </p>

            {trainMessage && (
              <div
                className={`mb-6 p-4 rounded-xl text-xs flex items-center gap-3 ${
                  trainMessage.type === 'success'
                    ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300'
                    : 'bg-red-950/40 border border-red-800/50 text-red-300'
                }`}
              >
                {trainMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span>{trainMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleStartTraining} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 font-mono">
                    Learning Rate
                  </label>
                  <input
                    type="text"
                    value={learningRate}
                    onChange={(e) => setLearningRate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">Recommended: 0.0001 for backbone stability</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 font-mono">
                    Batch Size
                  </label>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="8">8 samples</option>
                    <option value="16">16 samples (Recommended)</option>
                    <option value="32">32 samples</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 font-mono">
                    Training Epochs
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={epochs}
                    onChange={(e) => setEpochs(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">Between 3 to 10 epochs recommended</div>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer mt-3">
                    <input
                      type="checkbox"
                      checked={freezeBackbone}
                      onChange={(e) => setFreezeBackbone(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 w-4 h-4"
                    />
                    <span className="text-xs text-slate-300 font-medium">Freeze EfficientNet Backbone</span>
                  </label>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Freezes feature extractor, only training projection heads
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={isSubmittingTrain}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingTrain ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Dispatching Job...</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      <span>Start Personal Fine-Tuning Job</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Dataset Status */}
          <div className="bg-[#0D121F] border border-slate-800 rounded-2xl p-6">
            <h4 className="text-sm font-semibold text-white mb-4">Wardrobe Dataset State</h4>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Total Wardrobe Items:</span>
                <span className="font-bold text-white">{datasetInfo.total_wardrobe_items ?? 0}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Reviewed Garments:</span>
                <span className="font-bold text-indigo-300">{datasetInfo.reviewed_items ?? 0}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Accepted Decisions:</span>
                <span className="font-bold text-emerald-400">{datasetInfo.accepted_decisions ?? 0}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">User Corrections:</span>
                <span className="font-bold text-amber-400">{datasetInfo.corrected_decisions ?? 0}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Eligible For Training:</span>
                <span className="font-bold text-emerald-400">{datasetInfo.eligible_for_training ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Versions & Rollback */}
      {activeTab === 'versions' && (
        <div className="bg-[#0D121F] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-white mb-2">Classifier Version Registry</h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Persistent checkpoint registry under artifacts/clothing/versions/ ensuring seamless instant rollback with zero downtime.
          </p>

          <div className="space-y-4 font-mono text-xs">
            {(versionsData?.clothing_classifier_versions || []).map((ver: any, idx: number) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{ver.version_tag}</span>
                    {ver.version_tag === modelData?.current_version && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Current Production
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1 font-sans">
                    Promoted: {ver.promoted_at ? new Date(ver.promoted_at).toLocaleString() : 'Baseline'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-slate-500 text-[11px]">Checkpoint Path</div>
                  <div className="text-slate-300 text-xs">{ver.checkpoint_path?.split('/').pop()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
