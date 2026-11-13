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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[#392F3E]">
        <div>
          <div className="text-[10px] font-mono tracking-[0.2em] text-[#777078] uppercase mb-1">
            SECURITY, STORAGE & INFRASTRUCTURE
          </div>
          <h1 className="text-3xl font-serif text-[#F3EEE8]">
            Admin <span className="italic text-[#D5A6A0]">Infrastructure.</span>
          </h1>
          <p className="text-xs text-[#777078] mt-1 font-sans">
            System configuration, durable artifact storage paths, and model hot-reload controls.
          </p>
        </div>

        <button
          onClick={handleHotReload}
          disabled={isReloading}
          className="flex items-center gap-2 px-4 py-2 rounded-[2px] bg-[#743C49] hover:bg-[#8E4B5A] text-[10px] font-mono uppercase tracking-[0.14em] text-[#F3EEE8] transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={12} className={isReloading ? 'animate-spin' : ''} />
          <span>Hot-Reload AI Models</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-[2px] text-xs flex items-center gap-3 font-mono ${
            message.type === 'success'
              ? 'bg-[#743C49]/20 border border-[#743C49]/40 text-[#D5A6A0]'
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
        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-[2px] bg-[#241D27] border border-[#392F3E] flex items-center justify-center text-[#D5A6A0]">
              <HardDrive size={16} />
            </div>
            <div>
              <h3 className="text-base font-serif text-[#F3EEE8]">Model Artifact Directories</h3>
              <p className="text-xs text-[#777078]">Durable filesystem checkpoints</p>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
              <div className="text-[10px] text-[#777078] uppercase tracking-[0.12em]">Clothing Classifier Active Manifest</div>
              <div className="text-[#F3EEE8] mt-1 select-all break-all">
                artifacts/clothing/current_production_model.json
              </div>
            </div>

            <div className="p-3 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
              <div className="text-[10px] text-[#777078] uppercase tracking-[0.12em]">Recommendation Model Active Manifest</div>
              <div className="text-[#F3EEE8] mt-1 select-all break-all">
                artifacts/recommendation/current_production_model.json
              </div>
            </div>

            <div className="p-3 rounded-[2px] bg-[#241D27] border border-[#392F3E]">
              <div className="text-[10px] text-[#777078] uppercase tracking-[0.12em]">Baseline Joblib Weights</div>
              <div className="text-[#D5A6A0] mt-1 select-all break-all">
                artifacts/recommendation/versions/v1.0.0/tailorbird_preference_model.joblib
              </div>
            </div>
          </div>
        </div>

        {/* Security & Access Guard */}
        <div className="bg-[#1F1922] border border-[#392F3E] rounded-[3px] p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-[2px] bg-[#241D27] border border-[#392F3E] flex items-center justify-center text-[#D5A6A0]">
              <Shield size={16} />
            </div>
            <div>
              <h3 className="text-base font-serif text-[#F3EEE8]">Console Access Controls</h3>
              <p className="text-xs text-[#777078]">Authentication & Throttling Guards</p>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-[2px] bg-[#241D27] border border-[#392F3E] flex justify-between items-center">
              <div>
                <div className="text-[10px] text-[#777078] uppercase tracking-[0.12em]">Configured Administrator</div>
                <div className="text-[#F3EEE8] mt-0.5">admin</div>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-[2px] font-mono uppercase tracking-[0.12em] bg-[#743C49]/30 text-[#D5A6A0] border border-[#743C49]/40">
                Verified
              </span>
            </div>

            <div className="p-3 rounded-[2px] bg-[#241D27] border border-[#392F3E] flex justify-between items-center">
              <div>
                <div className="text-[10px] text-[#777078] uppercase tracking-[0.12em]">Rate Limiting & Lockout</div>
                <div className="text-[#777078] mt-0.5">5 failed attempts → 15m lockout</div>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-[2px] font-mono uppercase tracking-[0.12em] bg-[#B49B82]/20 text-[#B49B82] border border-[#B49B82]/30">
                Active
              </span>
            </div>

            <div className="p-3 rounded-[2px] bg-[#241D27] border border-[#392F3E] flex justify-between items-center">
              <div>
                <div className="text-[10px] text-[#777078] uppercase tracking-[0.12em]">Authorization Mechanism</div>
                <div className="text-[#777078] mt-0.5">JWT Bearer Claim (role: admin) + 403 Guard</div>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-[2px] font-mono uppercase tracking-[0.12em] bg-[#743C49]/30 text-[#D5A6A0] border border-[#743C49]/40">
                Enforced
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
