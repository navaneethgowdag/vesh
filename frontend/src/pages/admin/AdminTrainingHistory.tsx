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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[#392F3E]">
        <div>
          <div className="text-[10px] font-mono tracking-[0.2em] text-[#777078] uppercase mb-1">
            MODEL GOVERNANCE & EXECUTION LEDGER
          </div>
          <h1 className="text-3xl font-serif text-[#F3EEE8]">
            Model Training <span className="italic text-[#D5A6A0]">History.</span>
          </h1>
          <p className="text-xs text-[#777078] mt-1 font-sans">
            Complete audit trail of all background fine-tuning and retraining runs across TailorBird models.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-[2px] bg-[#1F1922] hover:bg-[#241D27] text-[10px] font-mono uppercase tracking-[0.14em] text-[#F3EEE8] border border-[#392F3E] transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin text-[#D5A6A0]' : ''} />
          <span>Refresh History</span>
        </button>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-[#1F1922] border border-[#392F3E] p-4 rounded-[2px]">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078]">
          <Filter size={12} />
          <span>Filters:</span>
        </div>

        <select
          value={modelTypeFilter}
          onChange={(e) => setModelTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-[#241D27] border border-[#392F3E] rounded-[2px] text-xs font-mono text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
        >
          <option value="all">All Models</option>
          <option value="recommendation">Recommendation Model</option>
          <option value="clothing">Clothing Classifier</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-[#241D27] border border-[#392F3E] rounded-[2px] text-xs font-mono text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
        </select>

        <div className="ml-auto text-[10px] font-mono uppercase tracking-[0.14em] text-[#777078]">
          Total Recorded: {jobs.length} Runs
        </div>
      </div>

      {/* History Table */}
      <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="animate-spin text-[#D5A6A0]" />
            <span className="text-xs font-mono text-[#777078]">Fetching training ledger...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#777078] font-mono">
            No training jobs matching active filters found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#241D27] text-[#777078] uppercase font-mono text-[9px] tracking-[0.14em] border-b border-[#392F3E]">
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
              <tbody className="divide-y divide-[#392F3E]/60 font-mono text-[#F3EEE8]">
                {jobs.map((job) => {
                  const isRec = job.model_type === 'recommendation';
                  return (
                    <tr key={job.job_id} className="hover:bg-[#241D27]/40 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-[#F3EEE8]">
                        {job.job_id?.slice(0, 8)}...
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {isRec ? (
                            <Sliders size={14} className="text-[#D5A6A0] shrink-0" />
                          ) : (
                            <Brain size={14} className="text-[#B49B82] shrink-0" />
                          )}
                          <span className="font-sans font-medium text-[#F3EEE8]">
                            {job.model_name || (isRec ? 'Recommendation ML' : 'Clothing Classifier')}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] text-[9px] font-mono uppercase tracking-[0.12em] ${
                            job.status === 'completed'
                              ? 'bg-[#743C49]/30 text-[#D5A6A0] border border-[#743C49]/40'
                              : job.status === 'processing'
                              ? 'bg-[#B49B82]/20 text-[#B49B82] border border-[#B49B82]/30'
                              : job.status === 'failed'
                              ? 'bg-red-950/40 text-red-300 border border-red-800/40'
                              : 'bg-[#241D27] text-[#777078] border border-[#392F3E]'
                          }`}
                        >
                          {job.status === 'processing' && <Loader2 size={10} className="animate-spin" />}
                          {job.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#777078] text-[11px] font-mono">
                        {job.started_at ? new Date(job.started_at).toLocaleString() : 'Queued'}
                      </td>
                      <td className="px-5 py-3.5 text-[#D5A6A0] font-bold">
                        {job.candidate_version || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[11px]">
                        {job.metrics?.mae !== undefined ? (
                          <span>MAE: {job.metrics.mae?.toFixed(4)} | R²: {job.metrics.r2?.toFixed(3)}</span>
                        ) : job.metrics?.accuracy !== undefined ? (
                          <span>Acc: {(job.metrics.accuracy * 100).toFixed(1)}%</span>
                        ) : (
                          <span className="text-[#777078]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleOpenJob(job.job_id)}
                          className="px-2.5 py-1 rounded-[2px] bg-[#241D27] hover:bg-[#743C49] text-[#777078] hover:text-[#F3EEE8] text-[10px] font-mono uppercase tracking-[0.12em] border border-[#392F3E] transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#161218]/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#392F3E] flex items-center justify-between">
              <div>
                <h3 className="text-base font-serif text-[#F3EEE8] flex items-center gap-2">
                  <FileText size={16} className="text-[#D5A6A0]" />
                  Job Trace: {selectedJob.job_id}
                </h3>
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#777078] mt-0.5">
                  Model: {selectedJob.model_name || selectedJob.model_type} | Status: {selectedJob.status}
                </div>
              </div>

              <button
                onClick={() => setSelectedJob(null)}
                className="p-1.5 rounded-[2px] text-[#777078] hover:text-[#F3EEE8] hover:bg-[#241D27] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Metrics Summary */}
              {selectedJob.metrics && Object.keys(selectedJob.metrics).length > 0 && (
                <div className="p-3.5 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
                  <div className="text-[10px] uppercase font-mono tracking-[0.14em] text-[#777078] mb-2">
                    Evaluation Output
                  </div>
                  <pre className="text-xs font-mono text-[#D5A6A0] overflow-x-auto">
                    {JSON.stringify(selectedJob.metrics, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Message */}
              {selectedJob.error && (
                <div className="p-3.5 rounded-[2px] bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Execution Failure:</div>
                    <div className="mt-0.5 font-mono">{selectedJob.error}</div>
                  </div>
                </div>
              )}

              {/* Logs */}
              <div>
                <div className="text-[10px] uppercase font-mono tracking-[0.14em] text-[#777078] mb-2">
                  Execution Log Stream
                </div>
                <div className="p-3.5 rounded-[2px] bg-[#161218] border border-[#392F3E] font-mono text-xs text-[#F3EEE8] space-y-1.5 max-h-60 overflow-y-auto">
                  {(selectedJob.logs || []).length > 0 ? (
                    selectedJob.logs.map((log: string, idx: number) => (
                      <div key={idx} className="text-[#F3EEE8] flex items-start gap-2">
                        <span className="text-[#777078] select-none">[{idx + 1}]</span>
                        <span>{log}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[#777078] italic">No detailed log traces captured for this run.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#392F3E] bg-[#241D27]/40 text-right">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 rounded-[2px] bg-[#241D27] hover:bg-[#392F3E] text-[10px] font-mono uppercase tracking-[0.14em] text-[#F3EEE8] border border-[#392F3E] transition-colors cursor-pointer"
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
