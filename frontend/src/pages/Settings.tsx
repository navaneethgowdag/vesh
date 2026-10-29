import React, { useState } from 'react';
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
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { ClothingColor, StyleVibe, UserSettings } from '../types';

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
  const { themePreference, setThemePreference } = useTheme();

  const [activeTab, setActiveTab] = useState<'Account' | 'Preferences' | 'Notifications' | 'Appearance' | 'Privacy'>(
    'Account'
  );

  const [formData, setFormData] = useState<UserSettings>(userSettings);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateUserSettings(formData);
    } catch {
      // Surfaced via toast
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <PullToRefresh onRefresh={refreshData}>
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
            Personalization & Controls
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Settings & Aesthetic Profile
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Configure your style signature, appearance theme, notification cadence, and account identity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Navigation Sidebar */}
          <div className="md:col-span-4 bg-white dark:bg-zinc-900 rounded-lg p-2.5 border border-zinc-200 dark:border-zinc-800 space-y-1">
            {[
              { id: 'Account', label: 'Account & Identity', icon: User },
              { id: 'Preferences', label: 'Style & Palette', icon: Sliders },
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
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-md text-xs sm:text-sm font-medium transition-all text-left ${
                    isCurrent
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isCurrent ? 'text-white dark:text-zinc-900' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Form Content Area */}
          <div className="md:col-span-8 bg-white dark:bg-zinc-900 rounded-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
            <form onSubmit={handleSaveAll} className="space-y-6">
              {/* 1. ACCOUNT TAB */}
              {activeTab === 'Account' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      Account & Public Profile
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Your public presence within the StyleSphere network.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
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
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        disabled
                        value={formData.account.username}
                        className="w-full bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        disabled
                        value={formData.account.email}
                        className="w-full bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
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
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md p-3 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
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
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PREFERENCES TAB */}
              {activeTab === 'Preferences' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      Style Profile & Aesthetic Signatures
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Used by the recommendation engine to score candidate outfits and daily styling.
                    </p>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
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
                            className={`px-3.5 py-2 min-h-[40px] rounded-md text-xs sm:text-sm font-medium transition-all border ${
                              isSelected
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                                : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100'
                            }`}
                          >
                            {style}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
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
                            className={`px-3.5 py-2 min-h-[40px] rounded-md text-xs sm:text-sm font-medium transition-all border ${
                              isSelected
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                                : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100'
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
