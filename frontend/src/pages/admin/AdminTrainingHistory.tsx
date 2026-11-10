import React, { useEffect, useState } from 'react';
import {
  Clock,
  Filter,
  RefreshCw,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Brain,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../services/api';

export const AdminTrainingHistory: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [modelTypeFilter, setModelTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [loadingJobDetail, setLoadingJobDetail] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (modelTypeFilter !== 'all') params.model_type = modelTypeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await api.admin.getTrainingHistory(params);
      setJobs(res || []);
    } catch (err: any) {
      console.error('Failed to load training history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [modelTypeFilter, statusFilter]);

  const handleOpenJob = async (jobId: string) => {
    try {
      setLoadingJobDetail(true);
      const detail = await api.admin.getTrainingJob(jobId);
      setSelectedJob(detail);
    } catch (err) {
      console.error('Failed to fetch job details:', err);
    } finally {
      setLoadingJobDetail(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Model Training History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Complete audit trail of all background fine-tuning and retraining runs across TailorBird models.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-medium text-slate-200 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-400' : ''} />
          <span>Refresh History</span>
        </button>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-[#0D121F] border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Filter size={14} />
          <span>Filters:</span>
        </div>

        <select
          value={modelTypeFilter}
          onChange={(e) => setModelTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Models</option>
          <option value="recommendation">Recommendation Model</option>
          <option value="clothing">Clothing Classifier</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
        </select>

        <div className="ml-auto text-xs font-mono text-slate-500">
          Total Recorded: {jobs.length} Runs
        </div>
      </div>

      {/* History Table */}
      <div className="bg-[#0D121F] border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="animate-spin text-indigo-400" />
            <span className="text-xs font-mono text-slate-400">Fetching training ledger...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 font-mono">
            No training jobs matching active filters found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Job ID</th>
                  <th className="px-5 py-3">Model</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Started / Finished</th>
                  <th className="px-5 py-3">Candidate Version</th>
                  <th className="px-5 py-3">Key Metrics</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {jobs.map((job) => {
                  const isRec = job.model_type === 'recommendation';
                  return (
                    <tr key={job.job_id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-white">
                        {job.job_id?.slice(0, 8)}...
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {isRec ? (
                            <Sliders size={14} className="text-emerald-400 shrink-0" />
                          ) : (
                            <Brain size={14} className="text-indigo-400 shrink-0" />
                          )}
                          <span className="font-sans font-medium text-slate-200">
                            {job.model_name || (isRec ? 'Recommendation ML' : 'Clothing Classifier')}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            job.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : job.status === 'processing'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : job.status === 'failed'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {job.status === 'processing' && <Loader2 size={10} className="animate-spin" />}
                          {job.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-[11px] font-sans">
                        {job.started_at ? new Date(job.started_at).toLocaleString() : 'Queued'}
                      </td>
                      <td className="px-5 py-3.5 text-indigo-300 font-bold">
                        {job.candidate_version || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[11px]">
                        {job.metrics?.mae !== undefined ? (
                          <span>MAE: {job.metrics.mae?.toFixed(4)} | R²: {job.metrics.r2?.toFixed(3)}</span>
                        ) : job.metrics?.accuracy !== undefined ? (
                          <span>Acc: {(job.metrics.accuracy * 100).toFixed(1)}%</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleOpenJob(job.job_id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-sans transition-colors cursor-pointer"
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Job Detail & Logs Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0D121F] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <FileText size={16} className="text-indigo-400" />
                  Job Trace: {selectedJob.job_id}
                </h3>
                <div className="text-xs font-mono text-slate-400 mt-0.5">
                  Model: {selectedJob.model_name || selectedJob.model_type} | Status: {selectedJob.status}
                </div>
              </div>

              <button
                onClick={() => setSelectedJob(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Metrics Summary */}
              {selectedJob.metrics && Object.keys(selectedJob.metrics).length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-xs font-semibold text-slate-300 uppercase font-mono mb-2">
                    Evaluation Output
                  </div>
                  <pre className="text-xs font-mono text-emerald-400 overflow-x-auto">
                    {JSON.stringify(selectedJob.metrics, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Message */}
              {selectedJob.error && (
                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Execution Failure:</div>
                    <div className="mt-0.5 font-mono">{selectedJob.error}</div>
                  </div>
                </div>
              )}

              {/* Logs */}
              <div>
                <div className="text-xs font-semibold text-slate-300 uppercase font-mono mb-2">
                  Execution Log Stream
                </div>
                <div className="p-3.5 rounded-xl bg-[#070A12] border border-slate-800 font-mono text-xs text-slate-300 space-y-1.5 max-h-60 overflow-y-auto">
                  {(selectedJob.logs || []).length > 0 ? (
                    selectedJob.logs.map((log: string, idx: number) => (
                      <div key={idx} className="text-slate-300 flex items-start gap-2">
                        <span className="text-slate-600 select-none">[{idx + 1}]</span>
                        <span>{log}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 italic">No detailed log traces captured for this run.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40 text-right">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
