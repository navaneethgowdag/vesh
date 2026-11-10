import React, { useState, useEffect } from 'react';
import {
  User,
  Sliders,
  Bell,
  SunMoon,
  Shield,
  Save,
  Sun,
  Moon,
  Laptop,
  Sparkles,
  RotateCcw,
  Check,
  TrendingUp,
  Shirt,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp, useCurrentUser } from '../context/AppContext';
import { ProfilePhotoUploader } from '../components/profile/ProfilePhotoUploader';
import { AVATAR_OPTIONS, AvatarStyle } from '../utils/avatarHelper';
import { useTheme } from '../context/ThemeContext';
import { ClothingColor, StyleVibe, UserSettings, LearnedPreferences, LaundrySettings } from '../types';
import { api } from '../services/api';

const STYLES_ALL: StyleVibe[] = [
  'Minimal',
  'Casual',
  'Streetwear',
  'Formal',
  'Vintage',
  'Sporty',
  'Smart Casual',
  'Trendy',
  'Quiet Luxury',
];

const COLORS_ALL: ClothingColor[] = [
  'White',
  'Black',
  'Beige',
  'Brown',
  'Cognac',
  'Navy',
  'Grey',
  'Olive',
  'Denim Blue',
];

export const Settings: React.FC = () => {
  const { userSettings, updateUserSettings, showToast, refreshData } = useApp();
  const currentUser = useCurrentUser();
  const { themePreference, setThemePreference } = useTheme();

  const [activeTab, setActiveTab] = useState<
    'Account' | 'Preferences' | 'Laundry' | 'Personalization' | 'Notifications' | 'Appearance' | 'Privacy'
  >('Account');

  const [formData, setFormData] = useState<UserSettings>(userSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [learnedData, setLearnedData] = useState<LearnedPreferences | null>(null);
  const [isLoadingLearned, setIsLoadingLearned] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Laundry Settings State
  const [laundryData, setLaundryData] = useState<LaundrySettings>({
    default_max_wears: 2,
    default_wash_days: 4,
    category_overrides: {},
    same_item_cooldown_days: 1,
    auto_return_from_laundry: true,
  });
  const [isLoadingLaundry, setIsLoadingLaundry] = useState(false);

  // Derived normalized confidence and feedback metrics for AI Aesthetic Profile
  const rawConfidence = learnedData?.confidence ?? learnedData?.confidenceScore ?? 0;
  const normalizedConfidence =
    typeof rawConfidence === 'number' && Number.isFinite(rawConfidence)
      ? Math.min(1, Math.max(0, rawConfidence))
      : 0;
  const confidencePercent = Math.round(normalizedConfidence * 100);
  const confidenceTier =
    normalizedConfidence < 0.2
      ? 'Cold Start'
      : normalizedConfidence < 0.6
      ? 'Developing'
      : 'Highly Tuned';

  const totalInteractionsCount =
    typeof learnedData?.total_interactions === 'number' &&
    Number.isFinite(learnedData.total_interactions)
      ? learnedData.total_interactions
      : typeof learnedData?.interactionCount === 'number' &&
        Number.isFinite(learnedData.interactionCount)
      ? learnedData.interactionCount
      : 0;

  useEffect(() => {
    if (activeTab === 'Personalization') {
      setIsLoadingLearned(true);
      api.personalization
        .getLearned()
        .then(setLearnedData)
        .catch((err) => console.error('Failed to load learned preferences', err))
        .finally(() => setIsLoadingLearned(false));
    } else if (activeTab === 'Laundry') {
      setIsLoadingLaundry(true);
      api.laundry
        .getSettings()
        .then(setLaundryData)
        .catch((err) => console.error('Failed to load laundry settings', err))
        .finally(() => setIsLoadingLaundry(false));
    }
  }, [activeTab]);

  const toggleStyle = (style: StyleVibe) => {
    setFormData((prev) => {
      const styles = prev.preferences.styles.includes(style)
        ? prev.preferences.styles.filter((s) => s !== style)
        : [...prev.preferences.styles, style];
      return {
        ...prev,
        preferences: { ...prev.preferences, styles },
      };
    });
  };

  const toggleColor = (color: ClothingColor) => {
    setFormData((prev) => {
      const preferredColors = prev.preferences.preferredColors.includes(color)
        ? prev.preferences.preferredColors.filter((c) => c !== color)
        : [...prev.preferences.preferredColors, color];
      return {
        ...prev,
        preferences: { ...prev.preferences, preferredColors },
      };
    });
  };

  const toggleAvoidedColor = (color: string) => {
    setFormData((prev) => {
      const current = prev.preferences.avoidedColors || [];
      const avoidedColors = current.includes(color)
        ? current.filter((c) => c !== color)
        : [...current, color];
      return {
        ...prev,
        preferences: { ...prev.preferences, avoidedColors },
      };
    });
  };

  const toggleDislikedStyle = (style: string) => {
    setFormData((prev) => {
      const current = prev.preferences.dislikedStyles || [];
      const dislikedStyles = current.includes(style)
        ? current.filter((s) => s !== style)
        : [...current, style];
      return {
        ...prev,
        preferences: { ...prev.preferences, dislikedStyles },
      };
    });
  };

  const handleResetPersonalization = async () => {
    if (
      !window.confirm(
        'Reset your AI-learned preference history? This returns recommendations to base compatibility without altering your wardrobe or explicit style choices.'
      )
    ) {
      return;
    }
    setIsResetting(true);
    try {
      await api.personalization.reset();
      const updated = await api.personalization.getLearned();
      setLearnedData(updated);
      showToast('AI inferred preferences reset to cold-start baseline.', 'info');
    } catch {
      showToast('Failed to reset preferences', 'info');
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetLaundryDefaults = () => {
    setLaundryData({
      default_max_wears: 2,
      default_wash_days: 4,
      category_overrides: {},
      same_item_cooldown_days: 1,
      auto_return_from_laundry: true,
    });
    showToast('Reset laundry parameters to default rules. Click "Save Changes" to apply.', 'info');
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (activeTab === 'Laundry') {
        const saved = await api.laundry.updateSettings(laundryData);
        setLaundryData(saved);
        showToast('Laundry and wear rules saved! Active recommendations marked stale.', 'success');
      } else {
        await updateUserSettings(formData);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save settings', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <PullToRefresh onRefresh={refreshData}>
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <span className="text-xs uppercase tracking-widest font-semibold text-[#777C75] dark:text-[#A3ABA0] block mb-1">
            Personalization & Controls
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#202321] dark:text-[#F8F6F1] tracking-tight">
            Settings & Aesthetic Profile
          </h1>
          <p className="text-sm text-[#777C75] dark:text-[#A3ABA0] mt-1 font-sans">
            Configure your style signature, appearance theme, notification cadence, and account identity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Navigation Sidebar */}
          <div className="md:col-span-4 bg-white dark:bg-[#1C201D] rounded-2xl p-2 border border-[#E2DDD3] dark:border-[#2D342F] space-y-1 shadow-xs">
            {[
              { id: 'Account', label: 'Account & Identity', icon: User },
              { id: 'Preferences', label: 'Style & Palette', icon: Sliders },
              { id: 'Laundry', label: 'Laundry & Wear Rules', icon: Shirt },
              { id: 'Personalization', label: 'Adaptive AI Engine', icon: Sparkles },
              { id: 'Notifications', label: 'Notifications', icon: Bell },
              { id: 'Appearance', label: 'Theme & Appearance', icon: SunMoon },
              { id: 'Privacy', label: 'Privacy & Security', icon: Shield },
            ].map((item) => {
              const Icon = item.icon;
              const isCurrent = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-medium transition-all text-left cursor-pointer ${
                    isCurrent
                      ? 'bg-[#202321] dark:bg-[#F8F6F1] text-[#F8F6F1] dark:text-[#202321] font-semibold shadow-xs'
                      : 'text-[#6B7269] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#F8F6F1] dark:hover:bg-[#242A25]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isCurrent ? 'text-[#F8F6F1] dark:text-[#202321]' : 'text-[#777C75]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Form Content Area */}
          <div className="md:col-span-8 bg-white dark:bg-[#1C201D] rounded-2xl p-6 sm:p-8 border border-[#E2DDD3] dark:border-[#2D342F] shadow-xs">
            <form onSubmit={handleSaveAll} className="space-y-6">
              {/* 1. ACCOUNT TAB */}
              {activeTab === 'Account' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-serif font-bold text-[#202321] dark:text-[#F8F6F1]">
                      Account & Public Profile
                    </h2>
                    <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-0.5">
                      Your public presence within the TailorBird network.
                    </p>
                  </div>

                  <ProfilePhotoUploader size="xl" />

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={formData.account.name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            account: { ...formData.account, name: e.target.value },
                          })
                        }
                        className="w-full bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-[#202321] dark:text-[#F8F6F1] focus:outline-none focus:ring-1 focus:ring-[#727D69]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        disabled
                        value={formData.account.username}
                        className="w-full bg-[#E9E6DE]/50 dark:bg-[#141715]/50 border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-[#777C75] dark:text-[#A3ABA0] cursor-not-allowed font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        disabled
                        value={formData.account.email}
                        className="w-full bg-[#E9E6DE]/50 dark:bg-[#141715]/50 border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-[#777C75] dark:text-[#A3ABA0] cursor-not-allowed font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-1">
                        Editorial Bio
                      </label>
                      <textarea
                        rows={3}
                        value={formData.account.bio}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            account: { ...formData.account, bio: e.target.value },
                          })
                        }
                        placeholder="Share your aesthetic philosophy..."
                        className="w-full bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl p-3 text-base sm:text-sm text-[#202321] dark:text-[#F8F6F1] placeholder:text-[#777C75]/60 focus:outline-none focus:ring-1 focus:ring-[#727D69]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-1">
                        Primary Location / City
                      </label>
                      <input
                        type="text"
                        value={formData.account.location}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            account: { ...formData.account, location: e.target.value },
                          })
                        }
                        placeholder="e.g. New York, London, Tokyo"
                        className="w-full bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-[#202321] dark:text-[#F8F6F1] focus:outline-none focus:ring-1 focus:ring-[#727D69]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PREFERENCES TAB */}
              {activeTab === 'Preferences' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-serif font-bold text-[#202321] dark:text-[#F8F6F1]">
                      Style Profile & Aesthetic Signatures
                    </h2>
                    <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-0.5">
                      Used by the recommendation engine to score candidate outfits and daily styling.
                    </p>
                  </div>

                  <div>
                    <span className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-2.5">
                      Aesthetic Vibes
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {STYLES_ALL.map((style) => {
                        const isSelected = formData.preferences.styles.includes(style);
                        return (
                          <button
                            key={style}
                            type="button"
                            onClick={() => toggleStyle(style)}
                            className={`px-4 py-2 min-h-[40px] rounded-full text-xs font-medium transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-[#202321] dark:bg-[#F8F6F1] text-[#F8F6F1] dark:text-[#202321] border-transparent font-semibold shadow-xs'
                                : 'bg-[#F8F6F1] dark:bg-[#242A25] border-[#E2DDD3] dark:border-[#2D342F] text-[#6B7269] dark:text-[#A3ABA0] hover:bg-[#E9E6DE]'
                            }`}
                          >
                            {style}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mb-2.5">
                      Preferred Color Palette
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {COLORS_ALL.map((c) => {
                        const isSelected = formData.preferences.preferredColors.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleColor(c)}
                            className={`px-4 py-2 min-h-[40px] rounded-full text-xs font-medium transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-[#202321] dark:bg-[#F8F6F1] text-[#F8F6F1] dark:text-[#202321] border-transparent font-semibold shadow-xs'
                                : 'bg-[#F8F6F1] dark:bg-[#242A25] border-[#E2DDD3] dark:border-[#2D342F] text-[#6B7269] dark:text-[#A3ABA0] hover:bg-[#E9E6DE]'
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. LAUNDRY & WEAR RULES TAB */}
              {activeTab === 'Laundry' && (
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Shirt className="w-5 h-5 text-indigo-500" />
                        Laundry & Wear Rules
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Define wear limits before washing, clean turnaround durations, and category rules.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetLaundryDefaults}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset to Defaults</span>
                    </button>
                  </div>

                  {/* Global Timing Card */}
                  <div className="p-4 sm:p-5 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Global Wear & Laundry Timing
                    </h3>

                    {/* Global Max Wears */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Default Wear Limit (wears before laundry)
                        </label>
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-600">
                          {laundryData.default_max_wears} {laundryData.default_max_wears === 1 ? 'wear' : 'wears'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={laundryData.default_max_wears}
                        onChange={(e) =>
                          setLaundryData({ ...laundryData, default_max_wears: parseInt(e.target.value) || 1 })
                        }
                        className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                        <span>1 wear (wash immediately)</span>
                        <span>Default: 2 wears</span>
                        <span>30 wears</span>
                      </div>
                    </div>

                    {/* Global Wash Days */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Laundry Turnaround Duration (unavailable days)
                        </label>
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-600">
                          {laundryData.default_wash_days} {laundryData.default_wash_days === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={14}
                        value={laundryData.default_wash_days}
                        onChange={(e) =>
                          setLaundryData({ ...laundryData, default_wash_days: parseInt(e.target.value) || 0 })
                        }
                        className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                        <span>0 days (same-day wash)</span>
                        <span>Default: 4 days</span>
                        <span>14 days</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        Exact day rule: reaching the limit on Monday with 4 wash days keeps the item unavailable Tue–Fri, returning clean Saturday.
                      </p>
                    </div>

                    {/* Cooldown Days */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Same-Item Rest Cooldown (soft penalty for consecutive wearing)
                        </label>
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-600">
                          {laundryData.same_item_cooldown_days} {laundryData.same_item_cooldown_days === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={7}
                        value={laundryData.same_item_cooldown_days}
                        onChange={(e) =>
                          setLaundryData({ ...laundryData, same_item_cooldown_days: parseInt(e.target.value) || 0 })
                        }
                        className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100"
                      />
                    </div>

                    {/* Auto-return toggle */}
                    <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-700">
                      <div>
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
                          Automatic Return from Laundry
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Automatically mark clothes clean once their turnaround date arrives.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={laundryData.auto_return_from_laundry}
                          onChange={(e) =>
                            setLaundryData({ ...laundryData, auto_return_from_laundry: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-zinc-900 dark:peer-checked:bg-zinc-100 dark:peer-checked:after:bg-zinc-900" />
                      </label>
                    </div>
                  </div>

                  {/* Category Overrides Table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Category Overrides
                      </h3>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Resolution: Item Override &gt; Category Override &gt; Global Default
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 uppercase tracking-wider font-semibold">
                          <tr>
                            <th className="px-3.5 py-2.5">Category</th>
                            <th className="px-3.5 py-2.5">Track for Laundry</th>
                            <th className="px-3.5 py-2.5">Max Wears</th>
                            <th className="px-3.5 py-2.5">Wash Days</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                          {[
                            { key: 'tops', label: 'Tops & Shirts', defaultTrack: true },
                            { key: 'bottoms', label: 'Bottoms & Jeans', defaultTrack: true },
                            { key: 'outerwear', label: 'Outerwear & Blazers', defaultTrack: true },
                            { key: 'footwear', label: 'Footwear & Shoes', defaultTrack: false },
                            { key: 'accessories', label: 'Bags & Accessories', defaultTrack: false },
                          ].map((cat) => {
                            const current = laundryData.category_overrides[cat.key] || {};
                            const isTracked = current.track_laundry !== undefined ? current.track_laundry : cat.defaultTrack;
                            const wearsVal = current.max_wears !== undefined ? current.max_wears : '';
                            const washDaysVal = current.wash_days !== undefined ? current.wash_days : '';

                            const updateCat = (field: string, val: any) => {
                              const nextOverrides = { ...laundryData.category_overrides };
                              const catObj = { ...(nextOverrides[cat.key] || {}) };
                              if (val === '' || val === undefined) {
                                delete (catObj as any)[field];
                              } else {
                                (catObj as any)[field] = val;
                              }
                              if (Object.keys(catObj).length === 0) {
                                delete nextOverrides[cat.key];
                              } else {
                                nextOverrides[cat.key] = catObj;
                              }
                              setLaundryData({ ...laundryData, category_overrides: nextOverrides });
                            };

                            return (
                              <tr key={cat.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                                <td className="px-3.5 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                                  {cat.label}
                                </td>
                                <td className="px-3.5 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isTracked}
                                    onChange={(e) => updateCat('track_laundry', e.target.checked)}
                                    className="w-4 h-4 rounded text-zinc-900 focus:ring-zinc-900 border-zinc-300 dark:border-zinc-700"
                                  />
                                </td>
                                <td className="px-3.5 py-2.5">
                                  <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    placeholder={`${laundryData.default_max_wears} (global)`}
                                    value={wearsVal}
                                    disabled={!isTracked}
                                    onChange={(e) =>
                                      updateCat('max_wears', e.target.value === '' ? undefined : parseInt(e.target.value))
                                    }
                                    className="w-24 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 disabled:opacity-40"
                                  />
                                </td>
                                <td className="px-3.5 py-2.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={14}
                                    placeholder={`${laundryData.default_wash_days} (global)`}
                                    value={washDaysVal}
                                    disabled={!isTracked}
                                    onChange={(e) =>
                                      updateCat('wash_days', e.target.value === '' ? undefined : parseInt(e.target.value))
                                    }
                                    className="w-24 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 disabled:opacity-40"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. PERSONALIZATION & CONTINUOUS LEARNING ENGINE TAB */}
              {activeTab === 'Personalization' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      Continuous Learning & Recommendation AI
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Personalizes daily outfit suggestions based on your feedback, wearing history, and wardrobe rotation.
                    </p>
                  </div>

                  {/* 1. Master Personalization Toggle */}
                  <div className="flex items-start justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <div className="pr-4">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Adaptive Recommendation Ranking
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        When enabled, candidate outfits are ranked by balancing core compatibility (w<sub>compat</sub>), your learned style & color affinities (w<sub>pref</sub>), and rotation diversity (w<sub>div</sub>). When disabled, ranking relies purely on deterministic base compatibility.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={formData.preferences.personalizationEnabled ?? true}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              personalizationEnabled: e.target.checked,
                            },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-zinc-900 dark:peer-checked:bg-zinc-100 dark:peer-checked:after:bg-zinc-900"></div>
                    </label>
                  </div>

                  {/* 2. Wardrobe Rotation & Diversity */}
                  <div className="space-y-3 p-4 bg-zinc-50/60 dark:bg-zinc-800/30 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Diversity & Wardrobe Rotation
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        {
                          id: 'balanced' as const,
                          label: 'Balanced',
                          desc: 'Even blend of top favorites and fresh combinations',
                        },
                        {
                          id: 'high' as const,
                          label: 'High Diversity',
                          desc: 'Actively rotates rarely worn items to avoid repetition',
                        },
                        {
                          id: 'low' as const,
                          label: 'High Consistency',
                          desc: 'Strongly emphasizes highest affinity trusted pieces',
                        },
                      ].map((mode) => {
                        const isCurrent = (formData.preferences.diversityPreference || 'balanced') === mode.id;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                preferences: {
                                  ...formData.preferences,
                                  diversityPreference: mode.id,
                                },
                              })
                            }
                            className={`p-3 rounded-md text-left border transition-all ${
                              isCurrent
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50'
                            }`}
                          >
                            <p className="text-xs font-semibold">{mode.label}</p>
                            <p className={`text-[11px] mt-1 ${isCurrent ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
                              {mode.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2">
                      <div className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 mb-1">
                        <span>Recency cooldown window</span>
                        <span className="font-semibold">{formData.preferences.avoidRecentlyWornDays ?? 3} days</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="14"
                        value={formData.preferences.avoidRecentlyWornDays ?? 3}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              avoidRecentlyWornDays: parseInt(e.target.value, 10),
                            },
                          })
                        }
                        className="w-full accent-zinc-900 dark:accent-zinc-100"
                      />
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        Outfits or garments worn within this window receive a rotation penalty to surface different options.
                      </p>
                    </div>
                  </div>

                  {/* 3. Explicit Negative Filters (Avoided Colors & Styles) */}
                  <div className="space-y-4">
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                        Avoided Colors
                      </span>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">
                        Garments featuring these colors will receive strong negative preference weighting.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {COLORS_ALL.map((c) => {
                          const isAvoided = (formData.preferences.avoidedColors || []).includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => toggleAvoidedColor(c)}
                              className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-all border ${
                                isAvoided
                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold'
                                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                              }`}
                            >
                              {isAvoided ? `✕ Avoid ${c}` : c}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                        Disliked Aesthetics
                      </span>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">
                        These styles are filtered or down-weighted during archetype and piece combination scoring.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {STYLES_ALL.map((s) => {
                          const isDisliked = (formData.preferences.dislikedStyles || []).includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleDislikedStyle(s)}
                              className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-all border ${
                                isDisliked
                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold'
                                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                              }`}
                            >
                              {isDisliked ? `✕ Avoid ${s}` : s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 4. AI Inferred Profile Card */}
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                          Learned Aesthetic Profile (Live State)
                        </h3>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium">
                        Neon PostgreSQL
                      </span>
                    </div>

                    {isLoadingLearned ? (
                      <div className="py-6 text-center text-xs text-zinc-500">
                        Inspecting Bayesian affinity matrices...
                      </div>
                    ) : learnedData ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="p-3 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800">
                            <p className="text-[11px] text-zinc-500">Engine Confidence</p>
                            <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                              {confidencePercent}%
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">
                              {confidenceTier}
                            </p>
                          </div>
                          <div className="p-3 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800">
                            <p className="text-[11px] text-zinc-500">Total Feedback</p>
                            <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                              {totalInteractionsCount}
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">Likes, wears, dismissals</p>
                          </div>
                          <div className="p-3 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 col-span-2 sm:col-span-1">
                            <p className="text-[11px] text-zinc-500">Half-Life Decay</p>
                            <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                              30 Days
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">e<sup>-λΔt</sup> adaptive weight</p>
                          </div>
                        </div>

                        {/* Top Inferred Styles */}
                        {learnedData.top_styles && learnedData.top_styles.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                              Top Inferred Style Affinities
                            </p>
                            <div className="space-y-1.5">
                              {learnedData.top_styles.slice(0, 4).map((item, idx) => (
                                <div key={item.style || item.name || idx} className="flex items-center gap-3 text-xs">
                                  <span className="w-24 truncate font-medium text-zinc-700 dark:text-zinc-300">
                                    {item.style}
                                  </span>
                                  <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                                    <div
                                      className="bg-zinc-900 dark:bg-zinc-100 h-full rounded-full transition-all"
                                      style={{ width: `${Math.min(100, Math.max(0, item.score * 100))}%` }}
                                    />
                                  </div>
                                  <span className="w-10 text-right text-zinc-500">
                                    {item.score > 0 ? `+${(item.score * 10).toFixed(1)}` : (item.score * 10).toFixed(1)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Top Inferred Colors */}
                        {learnedData.top_colors && learnedData.top_colors.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                              Top Inferred Color Affinities
                            </p>
                            <div className="space-y-1.5">
                              {learnedData.top_colors.slice(0, 4).map((item, idx) => (
                                <div key={item.color || item.name || idx} className="flex items-center gap-3 text-xs">
                                  <span className="w-24 truncate font-medium text-zinc-700 dark:text-zinc-300">
                                    {item.color}
                                  </span>
                                  <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                                    <div
                                      className="bg-amber-600 dark:bg-amber-400 h-full rounded-full transition-all"
                                      style={{ width: `${Math.min(100, Math.max(0, item.score * 100))}%` }}
                                    />
                                  </div>
                                  <span className="w-10 text-right text-zinc-500">
                                    {item.score > 0 ? `+${(item.score * 10).toFixed(1)}` : (item.score * 10).toFixed(1)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {learnedData.evidence_summary && (
                          <div className="p-3 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 italic">
                            "{learnedData.evidence_summary}"
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">No inferred profile data available yet.</p>
                    )}

                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        isLoading={isResetting}
                        onClick={handleResetPersonalization}
                        icon={<RotateCcw className="w-3.5 h-3.5" />}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        Reset Learned Profile to Cold-Start
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. NOTIFICATIONS TAB */}
              {activeTab === 'Notifications' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      Notification Alerts
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Control which events alert your notification bell.
                    </p>
                  </div>

                  {[
                    { key: 'likes' as const, title: 'Outfit Likes', desc: 'When members like your daily outfit moments or lookbooks' },
                    { key: 'comments' as const, title: 'Comments & Stylist Notes', desc: 'When curators comment on your pieces or styling' },
                    { key: 'followers' as const, title: 'New Followers', desc: 'When new tastemakers follow your style journal' },
                    { key: 'dailyRecommendations' as const, title: 'Daily Fit Morning Briefing', desc: 'When your morning outfit is computed' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-800"
                    >
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.notifications[item.key]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            notifications: {
                              ...formData.notifications,
                              [item.key]: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 rounded text-zinc-900 focus:ring-zinc-900 border-zinc-300 dark:border-zinc-700"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 4. APPEARANCE TAB (WORKING THEME SELECTOR - EXCLUSIVE TO SETTINGS) */}
              {activeTab === 'Appearance' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      Theme & Visual Aesthetic
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Select your preferred display theme. Applies instantly across all devices.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'light' as const,
                        name: 'Light Mode',
                        desc: 'Clean, bright minimal surface with sharp charcoal typography',
                        icon: Sun,
                      },
                      {
                        id: 'dark' as const,
                        name: 'Dark Mode',
                        desc: 'Refined deep zinc surfaces with crisp white typography',
                        icon: Moon,
                      },
                      {
                        id: 'system' as const,
                        name: 'System Automatic',
                        desc: 'Follows your operating system preference automatically',
                        icon: Laptop,
                      },
                    ].map((t) => {
                      const Icon = t.icon;
                      const isSelected = themePreference === t.id;

                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            setThemePreference(t.id);
                            setFormData({
                              ...formData,
                              appearance: { theme: t.id },
                            });
                          }}
                          className={`p-4 rounded-md border cursor-pointer transition-all space-y-2 ${
                            isSelected
                              ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 ring-2 ring-zinc-900/20 dark:ring-zinc-100/20'
                              : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 hover:border-zinc-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`} />
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{t.name}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                              {t.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. PRIVACY TAB */}
              {activeTab === 'Privacy' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      Privacy & Visibility Controls
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Control who can inspect your capsule garments and outfit wearing log.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-800">
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Private Closet</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Only approved followers can view your individual wardrobe pieces
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.privacy.isPrivateAccount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          privacy: { ...formData.privacy, isPrivateAccount: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-zinc-900 focus:ring-zinc-900 border-zinc-300 dark:border-zinc-700"
                    />
                  </div>
                </div>
              )}

              {/* Bottom Action Bar */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Stored in Neon PostgreSQL
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSaving}
                  icon={<Save className="w-4 h-4" />}
                  className="min-h-[44px]"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      </PullToRefresh>
    </AppShell>
  );
};
