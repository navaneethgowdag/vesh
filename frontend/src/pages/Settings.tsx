import React, { useState } from 'react';
import {
  User,
  Sliders,
  Bell,
  SunMoon,
  Shield,
  Save,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';
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
  const { userSettings, updateUserSettings, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'Account' | 'Preferences' | 'Notifications' | 'Appearance' | 'Privacy'>(
    'Account'
  );

  const [formData, setFormData] = useState<UserSettings>(userSettings);
  const [passwordState, setPasswordState] = useState({ current: '', new: '', confirm: '' });

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

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateUserSettings(formData);
    } catch {
      // Context already surfaced the failure via a toast.
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
          Settings & Taste Profile
        </h1>
        <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
          Configure your style algorithm, notification preferences, privacy, and account data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Settings Navigation Sidebar */}
        <div className="md:col-span-4 bg-cream-50 rounded-3xl p-3 border border-sand-200/90 shadow-soft space-y-1">
          {[
            { id: 'Account', label: 'Account & Identity', icon: User },
            { id: 'Preferences', label: 'Style & Sizing', icon: Sliders },
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all text-left ${
                  isCurrent
                    ? 'bg-charcoal-900 text-cream-50 shadow-soft-sm'
                    : 'text-charcoal-600 hover:text-charcoal-900 hover:bg-sand-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isCurrent ? 'text-cream-50' : 'text-charcoal-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panel */}
        <div className="md:col-span-8 bg-cream-50 rounded-3xl p-6 sm:p-8 border border-sand-200/90 shadow-soft">
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. ACCOUNT TAB */}
            {activeTab === 'Account' && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-serif text-lg font-bold text-charcoal-900">
                    Account Information
                  </h2>
                  <p className="text-xs text-charcoal-500 mt-0.5">
                    Update your display name, username, and editorial bio.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                      Full Name
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
                      className="w-full bg-cream-100/60 border border-sand-300 rounded-xl px-3.5 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      value={formData.account.username}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          account: { ...formData.account, username: e.target.value },
                        })
                      }
                      className="w-full bg-cream-100/60 border border-sand-300 rounded-xl px-3.5 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.account.email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        account: { ...formData.account, email: e.target.value },
                      })
                    }
                    className="w-full bg-cream-100/60 border border-sand-300 rounded-xl px-3.5 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                    Location
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
                    className="w-full bg-cream-100/60 border border-sand-300 rounded-xl px-3.5 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
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
                    className="w-full bg-cream-100/60 border border-sand-300 rounded-xl px-3.5 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600 resize-none"
                  />
                </div>
              </div>
            )}

            {/* 2. PREFERENCES TAB */}
            {activeTab === 'Preferences' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-serif text-lg font-bold text-charcoal-900">
                    Style & Sizing Matrix
                  </h2>
                  <p className="text-xs text-charcoal-500 mt-0.5">
                    Tweak the taste factors used by the AI Daily Fit recommendation engine.
                  </p>
                </div>

                {/* Style vibes */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-2">
                    Style Aesthetics (Select multiple)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {STYLES_ALL.map((style) => {
                      const isSelected = formData.preferences.styles.includes(style);
                      return (
                        <button
                          key={style}
                          type="button"
                          onClick={() => toggleStyle(style)}
                          className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-colors ${
                            isSelected
                              ? 'bg-charcoal-900 text-cream-50 font-bold'
                              : 'bg-sand-100 text-charcoal-700 hover:bg-sand-200'
                          }`}
                        >
                          {isSelected ? `✓ ${style}` : `+ ${style}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preferred colors */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-2">
                    Palette Preferences
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS_ALL.map((c) => {
                      const isSelected = formData.preferences.preferredColors.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleColor(c)}
                          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                            isSelected
                              ? 'bg-cognac-700 text-white font-bold'
                              : 'bg-sand-100 text-charcoal-700 hover:bg-sand-200'
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sizes */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-2">
                    Clothing Sizes
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase font-bold block mb-1">
                        Tops
                      </span>
                      <input
                        type="text"
                        value={formData.preferences.clothingSizes.tops}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              clothingSizes: {
                                ...formData.preferences.clothingSizes,
                                tops: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full bg-cream-100/60 border border-sand-300 rounded-xl px-3 py-1.5 text-xs text-charcoal-900"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase font-bold block mb-1">
                        Bottoms
                      </span>
                      <input
                        type="text"
                        value={formData.preferences.clothingSizes.bottoms}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              clothingSizes: {
                                ...formData.preferences.clothingSizes,
                                bottoms: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full bg-cream-100/60 border border-sand-300 rounded-xl px-3 py-1.5 text-xs text-charcoal-900"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase font-bold block mb-1">
                        Shoes
                      </span>
                      <input
                        type="text"
                        value={formData.preferences.clothingSizes.shoes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              clothingSizes: {
                                ...formData.preferences.clothingSizes,
                                shoes: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full bg-cream-100/60 border border-sand-300 rounded-xl px-3 py-1.5 text-xs text-charcoal-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. NOTIFICATIONS TAB */}
            {activeTab === 'Notifications' && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-serif text-lg font-bold text-charcoal-900">
                    Notification Preferences
                  </h2>
                  <p className="text-xs text-charcoal-500 mt-0.5">
                    Choose what triggers alerts in your notification feed.
                  </p>
                </div>

                {[
                  {
                    key: 'likes' as const,
                    title: 'Outfit Likes',
                    desc: 'Notify when members like your daily outfit posts',
                  },
                  {
                    key: 'comments' as const,
                    title: 'Comments & Questions',
                    desc: 'Notify when users ask about pieces or styling',
                  },
                  {
                    key: 'followers' as const,
                    title: 'New Followers',
                    desc: 'Notify when new creators follow your style journal',
                  },
                  {
                    key: 'dailyRecommendations' as const,
                    title: 'Daily Fit Morning Alert',
                    desc: 'Morning notification when your AI recommendation is prepared',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3.5 bg-sand-50 rounded-2xl border border-sand-200"
                  >
                    <div>
                      <p className="text-xs font-bold text-charcoal-900">{item.title}</p>
                      <p className="text-[11px] text-charcoal-500">{item.desc}</p>
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
                      className="w-4 h-4 rounded text-cognac-600 focus:ring-cognac-500 border-sand-300"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 4. APPEARANCE TAB */}
            {activeTab === 'Appearance' && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-serif text-lg font-bold text-charcoal-900">
                    Theme & Aesthetic
                  </h2>
                  <p className="text-xs text-charcoal-500 mt-0.5">
                    Select how StyleSphere renders on your devices.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'light', name: 'Warm Cream (Default)', desc: 'Editorial warm neutral' },
                    { id: 'dark', name: 'Charcoal Dark', desc: 'Sleek luxury black' },
                    { id: 'system', name: 'System Auto', desc: 'Sync with OS setting' },
                  ].map((t) => (
                    <div
                      key={t.id}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          appearance: { theme: t.id as any },
                        })
                      }
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        formData.appearance.theme === t.id
                          ? 'border-cognac-700 bg-cognac-50/80 ring-2 ring-cognac-500/20'
                          : 'border-sand-200 bg-sand-50 hover:bg-sand-100'
                      }`}
                    >
                      <p className="font-bold text-xs text-charcoal-900">{t.name}</p>
                      <p className="text-[10px] text-charcoal-500 mt-1">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. PRIVACY TAB */}
            {activeTab === 'Privacy' && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-serif text-lg font-bold text-charcoal-900">
                    Privacy Controls
                  </h2>
                  <p className="text-xs text-charcoal-500 mt-0.5">
                    Control who can see your wardrobe pieces and daily fit logs.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-sand-50 rounded-2xl border border-sand-200">
                  <div>
                    <p className="text-xs font-bold text-charcoal-900">Private Account</p>
                    <p className="text-[11px] text-charcoal-500">
                      Only approved followers can inspect your outfits and closet pieces
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
                    className="w-4 h-4 rounded text-cognac-600 focus:ring-cognac-500 border-sand-300"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-sand-50 rounded-2xl border border-sand-200">
                  <div>
                    <p className="text-xs font-bold text-charcoal-900">Show Activity Status</p>
                    <p className="text-[11px] text-charcoal-500">
                      Allow followers to see when you last logged a daily fit
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.privacy.showActivity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        privacy: { ...formData.privacy, showActivity: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-cognac-600 focus:ring-cognac-500 border-sand-300"
                  />
                </div>
              </div>
            )}

            {/* Bottom Save Action */}
            <div className="pt-5 border-t border-sand-200 flex items-center justify-between">
              <span className="text-xs text-charcoal-400">Changes are saved to your account</span>
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={<Save className="w-4 h-4" />}
              >
                Save Preferences
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
};

