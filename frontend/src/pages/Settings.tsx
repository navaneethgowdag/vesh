import React, { useState } from 'react';
import {
  User,
  Sliders,
  Bell,
  SunMoon,
  Shield,
  Save,
  Lock,
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
  const [passwordState, setPasswordState] = useState({ current: '', new: '', confirm: '' });
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

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordState.new !== passwordState.confirm) {
      showToast('New passwords do not match', 'info');
      return;
    }
    showToast('Password updated securely!', 'success');
    setPasswordState({ current: '', new: '', confirm: '' });
  };

  return (
    <AppShell>
      <PullToRefresh onRefresh={refreshData}>
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[#C3A36B] dark:text-[#D1B47A] block mb-1 font-sans">
            Personalization & Atelier Controls
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-normal text-[#25211E] dark:text-[#F4F0E8] tracking-tight">
            Settings & Aesthetic Profile
          </h1>
          <p className="text-xs sm:text-sm text-[#82796F] dark:text-[#B2AA9E] mt-1 font-sans">
            Configure your style signature, appearance theme, notification cadence, and account identity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Navigation Sidebar */}
          <div className="md:col-span-4 bg-[#FFFFFF] dark:bg-[#22221F] rounded-2xl p-2.5 border border-[#E5DED3] dark:border-[#393832] shadow-subtle space-y-1">
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
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all text-left ${
                    isCurrent
                      ? 'bg-[#25211E] dark:bg-[#F4F0E8] text-[#F7F4EE] dark:text-[#171715] font-semibold shadow-subtle'
                      : 'text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8] hover:bg-[#F7F4EE] dark:hover:bg-[#2A2A26]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isCurrent ? 'text-[#C3A36B] dark:text-[#171715]' : 'text-[#82796F] dark:text-[#B2AA9E]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Form Content Area */}
          <div className="md:col-span-8 bg-[#FFFFFF] dark:bg-[#22221F] rounded-2xl p-6 sm:p-8 border border-[#E5DED3] dark:border-[#393832] shadow-subtle">
            <form onSubmit={handleSaveAll} className="space-y-6">
              {/* 1. ACCOUNT TAB */}
              {activeTab === 'Account' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-[#25211E] dark:text-[#F4F0E8]">
                      Account & Public Profile
                    </h2>
                    <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mt-0.5">
                      Your public presence within the StyleSphere network.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-1">
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
                        className="w-full bg-[#F7F4EE]/60 dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#25211E] dark:text-[#F4F0E8] focus:outline-none focus:ring-2 focus:ring-[#C3A36B]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        disabled
                        value={formData.account.username}
                        className="w-full bg-[#F7F4EE]/30 dark:bg-[#2A2A26]/50 border border-[#E5DED3] dark:border-[#393832] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#82796F] dark:text-[#7E786E] cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        disabled
                        value={formData.account.email}
                        className="w-full bg-[#F7F4EE]/30 dark:bg-[#2A2A26]/50 border border-[#E5DED3] dark:border-[#393832] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#82796F] dark:text-[#7E786E] cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-1">
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
                        className="w-full bg-[#F7F4EE]/60 dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] rounded-xl p-3 text-xs sm:text-sm text-[#25211E] dark:text-[#F4F0E8] focus:outline-none focus:ring-2 focus:ring-[#C3A36B]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-1">
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
                        className="w-full bg-[#F7F4EE]/60 dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#25211E] dark:text-[#F4F0E8] focus:outline-none focus:ring-2 focus:ring-[#C3A36B]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PREFERENCES TAB */}
              {activeTab === 'Preferences' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-[#25211E] dark:text-[#F4F0E8]">
                      Style Profile & Aesthetic Signatures
                    </h2>
                    <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mt-0.5">
                      Used by the Atelier ML Engine to score candidate outfits and daily styling.
                    </p>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-2 font-sans">
                      Aesthetic Vibes
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {STYLES_ALL.map((s) => {
                        const isSelected = formData.preferences.styles.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleStyle(s)}
                            className={`text-xs px-3.5 py-1.5 rounded-full border transition-all ${
                              isSelected
                                ? 'bg-[#25211E] dark:bg-[#F4F0E8] text-[#F7F4EE] dark:text-[#171715] border-[#25211E] dark:border-[#F4F0E8] font-semibold'
                                : 'bg-[#F7F4EE] dark:bg-[#2A2A26] border-[#E5DED3] dark:border-[#393832] text-[#82796F] dark:text-[#B2AA9E] hover:border-[#C3A36B]'
                            }`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] mb-2 font-sans">
                      Preferred Color Palette
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {COLORS_ALL.map((c) => {
                        const isSelected = formData.preferences.preferredColors.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleColor(c)}
                            className={`text-xs px-3.5 py-1.5 rounded-full border transition-all ${
                              isSelected
                                ? 'bg-[#25211E] dark:bg-[#F4F0E8] text-[#F7F4EE] dark:text-[#171715] border-[#25211E] dark:border-[#F4F0E8] font-semibold'
                                : 'bg-[#F7F4EE] dark:bg-[#2A2A26] border-[#E5DED3] dark:border-[#393832] text-[#82796F] dark:text-[#B2AA9E] hover:border-[#C3A36B]'
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
                    <h2 className="font-serif text-lg font-medium text-[#25211E] dark:text-[#F4F0E8]">
                      Notification Alerts
                    </h2>
                    <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mt-0.5">
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
                      className="flex items-center justify-between p-3.5 bg-[#F7F4EE] dark:bg-[#2A2A26] rounded-xl border border-[#E5DED3] dark:border-[#393832]"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[#25211E] dark:text-[#F4F0E8]">{item.title}</p>
                        <p className="text-[11px] text-[#82796F] dark:text-[#B2AA9E]">{item.desc}</p>
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
                        className="w-4 h-4 rounded text-[#C3A36B] focus:ring-[#C3A36B] border-[#E5DED3] dark:border-[#393832]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 4. APPEARANCE TAB (WORKING THEME SELECTOR) */}
              {activeTab === 'Appearance' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-[#25211E] dark:text-[#F4F0E8]">
                      Theme & Visual Aesthetic
                    </h2>
                    <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mt-0.5">
                      Select your preferred display theme. Applies instantly across all devices.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'light' as const,
                        name: 'Warm Ivory (Light)',
                        desc: 'Classic editorial warm neutral with deep espresso typography',
                        icon: Sun,
                      },
                      {
                        id: 'dark' as const,
                        name: 'Obsidian Noir (Dark)',
                        desc: 'Sleek luxury dark surfaces with champagne accents',
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
                          className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 ${
                            isSelected
                              ? 'border-[#C3A36B] dark:border-[#D1B47A] bg-[#C3A36B]/10 ring-2 ring-[#C3A36B]/30'
                              : 'border-[#E5DED3] dark:border-[#393832] bg-[#F7F4EE] dark:bg-[#2A2A26] hover:border-[#C3A36B]/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-[#C3A36B] dark:text-[#D1B47A]' : 'text-[#82796F]'}`} />
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-[#C3A36B] dark:bg-[#D1B47A]" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-[#25211E] dark:text-[#F4F0E8]">{t.name}</p>
                            <p className="text-[11px] text-[#82796F] dark:text-[#B2AA9E] mt-1 font-sans leading-relaxed">
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
                    <h2 className="font-serif text-lg font-medium text-[#25211E] dark:text-[#F4F0E8]">
                      Privacy & Visibility Controls
                    </h2>
                    <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mt-0.5">
                      Control who can inspect your capsule garments and outfit wearing log.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-[#F7F4EE] dark:bg-[#2A2A26] rounded-xl border border-[#E5DED3] dark:border-[#393832]">
                    <div>
                      <p className="text-xs font-semibold text-[#25211E] dark:text-[#F4F0E8]">Private Closet</p>
                      <p className="text-[11px] text-[#82796F] dark:text-[#B2AA9E]">
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
                      className="w-4 h-4 rounded text-[#C3A36B] focus:ring-[#C3A36B] border-[#E5DED3] dark:border-[#393832]"
                    />
                  </div>
                </div>
              )}

              {/* Bottom Action Bar */}
              <div className="pt-4 border-t border-[#E5DED3] dark:border-[#393832] flex items-center justify-between">
                <span className="text-xs text-[#82796F] dark:text-[#B2AA9E]">
                  Stored in Neon PostgreSQL
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSaving}
                  icon={<Save className="w-4 h-4" />}
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
