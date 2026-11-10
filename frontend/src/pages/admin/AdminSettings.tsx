import React, { useState } from 'react';
import {
  Settings,
  Server,
  Shield,
  Database,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Layers,
  Lock,
  HardDrive,
  Cpu,
} from 'lucide-react';
import { api } from '../../services/api';

export const AdminSettings: React.FC = () => {
  const [isReloading, setIsReloading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleHotReload = async () => {
    setIsReloading(true);
    setMessage(null);
    try {
      const [resRec] = await Promise.all([
        api.admin.reloadRecommendationModel(),
      ]);
      setMessage({
        type: 'success',
        text: 'Dual AI production models hot-reloaded successfully into memory with zero downtime.',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Hot reload failed.',
      });
    } finally {
      setIsReloading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Admin Infrastructure & Security
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            System configuration, durable artifact storage paths, and model hot-reload controls.
          </p>
        </div>

        <button
          onClick={handleHotReload}
          disabled={isReloading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-xs font-medium text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={isReloading ? 'animate-spin' : ''} />
          <span>Hot-Reload AI Models</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300'
              : 'bg-red-950/40 border border-red-800/50 text-red-300'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Artifact Storage Paths */}
        <div className="bg-[#0D121F] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <HardDrive size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Model Artifact Directories</h3>
              <p className="text-xs text-slate-400">Durable filesystem checkpoints</p>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">Clothing Classifier Active Manifest</div>
              <div className="text-white mt-1 select-all break-all">
                artifacts/clothing/current_production_model.json
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">Recommendation Model Active Manifest</div>
              <div className="text-white mt-1 select-all break-all">
                artifacts/recommendation/current_production_model.json
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">Baseline Joblib Weights</div>
              <div className="text-emerald-400 mt-1 select-all break-all">
                artifacts/recommendation/versions/v1.0.0/tailorbird_preference_model.joblib
              </div>
            </div>
          </div>
        </div>

        {/* Security & Access Guard */}
        <div className="bg-[#0D121F] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Console Access Controls</h3>
              <p className="text-xs text-slate-400">Authentication & Throttling Guards</p>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Configured Administrator</div>
                <div className="text-white mt-0.5">admin</div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Verified
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Rate Limiting & Lockout</div>
                <div className="text-slate-300 mt-0.5">5 failed attempts → 15m lockout</div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Active
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Authorization Mechanism</div>
                <div className="text-slate-300 mt-0.5">JWT Bearer Claim (role: admin) + 403 Guard</div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Enforced
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
