import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Briefcase,
  Calendar,
  Palette,
  Layers,
  ShoppingBag,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

export const StylingProfileManager: React.FC = () => {
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for sections
  const [lifestyleForm, setLifestyleForm] = useState({
    occupation: 'working_professional',
    industry: 'Technology',
    dressCode: 'Smart Casual',
    workMode: 'Hybrid',
  });

  const [routineForm, setRoutineForm] = useState<any[]>([]);
  const [stylesForm, setStylesForm] = useState<string[]>([]);
  const [colorsForm, setColorsForm] = useState<{ preferred: string[]; disliked: string[] }>({
    preferred: [],
    disliked: [],
  });
  const [fitForm, setFitForm] = useState<{
    fits: string[];
    comfort_vs_appearance: string;
    simple_vs_experimental: string;
  }>({
    fits: ['Regular'],
    comfort_vs_appearance: 'balanced',
    simple_vs_experimental: 'balanced',
  });
  const [occasionsForm, setOccasionsForm] = useState<string[]>([]);
  const [shoppingForm, setShoppingForm] = useState({
    budget_tier: 'mid_range',
    shopping_philosophy: 'balanced',
    preferred_platforms: ['Zara', 'Uniqlo'],
  });
  const [recSettingsForm, setRecSettingsForm] = useState({
    comfort_priority: 0.5,
    familiar_vs_new: 'balanced',
    repeat_frequency: 'moderate',
    variety_preference: 'balanced',
  });

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await api.users.getStylingProfile();
      setProfile(data);

      if (data) {
        setLifestyleForm({
          occupation: data.lifestyle_occupation?.occupation || 'working_professional',
          industry: data.lifestyle_occupation?.details?.industry || 'Technology',
          dressCode: data.lifestyle_occupation?.details?.dressCode || 'Smart Casual',
          workMode: data.lifestyle_occupation?.details?.workMode || 'Hybrid',
        });

        setRoutineForm(data.weekly_routine || []);
        setStylesForm(data.fashion_preferences?.styles || []);
        setColorsForm({
          preferred: data.fashion_preferences?.preferred_colors || [],
          disliked: data.fashion_preferences?.disliked_colors || [],
        });
        setFitForm({
          fits: data.fashion_preferences?.fits || ['Regular'],
          comfort_vs_appearance: data.fashion_preferences?.comfort_vs_appearance || 'balanced',
          simple_vs_experimental: data.fashion_preferences?.simple_vs_experimental || 'balanced',
        });
        setOccasionsForm(data.occasion_preferences?.regular_occasions || []);
        setShoppingForm({
          budget_tier: data.shopping_preferences?.budget_tier || 'mid_range',
          shopping_philosophy: data.shopping_preferences?.shopping_philosophy || 'balanced',
          preferred_platforms: data.shopping_preferences?.preferred_platforms || ['Zara', 'Uniqlo'],
        });
        setRecSettingsForm({
          comfort_priority: data.recommendation_settings?.comfort_priority ?? 0.5,
          familiar_vs_new: data.recommendation_settings?.familiar_vs_new || 'balanced',
          repeat_frequency: data.recommendation_settings?.repeat_frequency || 'moderate',
          variety_preference: data.recommendation_settings?.variety_preference || 'balanced',
        });
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not load styling profile', 'info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const saveSection = async (sectionName: string, updatePayload: any) => {
    setIsSaving(true);
    try {
      const updated = await api.users.updateStylingProfile(updatePayload);
      setProfile(updated);
      setEditingSection(null);
      showToast('Styling profile updated!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update section', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-zinc-500">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
        Loading your personal styling profile...
      </div>
    );
  }

  const isProfileComplete = profile?.onboarding_completed;

  return (
    <div className="space-y-6">
      {/* Incomplete Profile Banner */}
      {!isProfileComplete && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Styling Profile Incomplete
              </h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Complete your routine and occasion preferences to receive highly personalized Daily Fit recommendations.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => window.location.assign('/onboarding')}
            className="self-start sm:self-auto shrink-0"
          >
            Complete Setup
          </Button>
        </div>
      )}

      {/* 8 EDITABLE SUBSECTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subsection 1: Basic Lifestyle & Occupation */}
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Lifestyle & Occupation
              </h3>
            </div>
            {editingSection !== 'lifestyle' ? (
              <button
                onClick={() => setEditingSection('lifestyle')}
                className="text-xs text-primary-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    saveSection('lifestyle', {
                      lifestyle_occupation: {
                        occupation: lifestyleForm.occupation,
                        details: {
                          industry: lifestyleForm.industry,
                          dressCode: lifestyleForm.dressCode,
                          workMode: lifestyleForm.workMode,
                        },
                      },
                    })
                  }
                  disabled={isSaving}
                  className="text-xs text-emerald-600 font-bold flex items-center gap-0.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  onClick={() => setEditingSection(null)}
                  className="text-xs text-zinc-400 flex items-center gap-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {editingSection === 'lifestyle' ? (
            <div className="space-y-3 text-xs pt-1">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Occupation</label>
                <select
                  value={lifestyleForm.occupation}
                  onChange={(e) => setLifestyleForm({ ...lifestyleForm, occupation: e.target.value })}
                  className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 font-medium"
                >
                  <option value="working_professional">Working Professional</option>
                  <option value="student">Student</option>
                  <option value="freelancer">Freelancer</option>
                  <option value="homemaker">Homemaker</option>
                  <option value="job_seeker">Job Seeker</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Industry</label>
                  <input
                    type="text"
                    value={lifestyleForm.industry}
                    onChange={(e) => setLifestyleForm({ ...lifestyleForm, industry: e.target.value })}
                    className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Dress Code</label>
                  <select
                    value={lifestyleForm.dressCode}
                    onChange={(e) => setLifestyleForm({ ...lifestyleForm, dressCode: e.target.value })}
                    className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800"
                  >
                    <option value="Smart Casual">Smart Casual</option>
                    <option value="Business Casual">Business Casual</option>
                    <option value="Business Formal">Business Formal</option>
                    <option value="Casual">Casual</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5 pt-1">
              <p>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">Activity: </span>
                {profile?.lifestyle_occupation?.occupation?.replace('_', ' ').toUpperCase() || 'Not specified'}
              </p>
              <p>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">Workplace Dress Code: </span>
                {profile?.lifestyle_occupation?.details?.dressCode || 'Smart Casual'}
              </p>
              <p>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">Mode: </span>
                {profile?.lifestyle_occupation?.details?.workMode || 'Hybrid'}
              </p>
            </div>
          )}
        </div>

        {/* Subsection 2: Style Aesthetics */}
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Style Aesthetics
              </h3>
            </div>
            {editingSection !== 'styles' ? (
              <button
                onClick={() => setEditingSection('styles')}
                className="text-xs text-primary-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    saveSection('styles', {
                      fashion_preferences: {
                        styles: stylesForm,
                        disliked_styles: [],
                        preferred_colors: colorsForm.preferred,
                        disliked_colors: colorsForm.disliked,
                        fits: fitForm.fits,
                        comfort_vs_appearance: fitForm.comfort_vs_appearance,
                        simple_vs_experimental: fitForm.simple_vs_experimental,
                      },
                    })
                  }
                  disabled={isSaving}
                  className="text-xs text-emerald-600 font-bold flex items-center gap-0.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  onClick={() => setEditingSection(null)}
                  className="text-xs text-zinc-400 flex items-center gap-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {['Minimalist', 'Classic', 'Smart casual', 'Streetwear', 'Traditional Indian', 'Bohemian', 'Sporty'].map(
              (st) => {
                const isSelected = editingSection === 'styles' ? stylesForm.includes(st) : profile?.fashion_preferences?.styles?.includes(st);
                return (
                  <span
                    key={st}
                    onClick={() => {
                      if (editingSection === 'styles') {
                        setStylesForm(
                          stylesForm.includes(st) ? stylesForm.filter((s) => s !== st) : [...stylesForm, st]
                        );
                      }
                    }}
                    className={`text-xs px-2.5 py-1 rounded-md border font-medium ${
                      isSelected
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                    } ${editingSection === 'styles' ? 'cursor-pointer hover:opacity-80' : ''}`}
                  >
                    {st}
                  </span>
                );
              }
            )}
          </div>
        </div>

        {/* Subsection 3: Color Preferences */}
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Colors & Palettes
              </h3>
            </div>
            {editingSection !== 'colors' ? (
              <button
                onClick={() => setEditingSection('colors')}
                className="text-xs text-primary-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    saveSection('colors', {
                      fashion_preferences: {
                        styles: stylesForm,
                        disliked_styles: [],
                        preferred_colors: colorsForm.preferred,
                        disliked_colors: colorsForm.disliked,
                        fits: fitForm.fits,
                        comfort_vs_appearance: fitForm.comfort_vs_appearance,
                        simple_vs_experimental: fitForm.simple_vs_experimental,
                      },
                    })
                  }
                  disabled={isSaving}
                  className="text-xs text-emerald-600 font-bold flex items-center gap-0.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  onClick={() => setEditingSection(null)}
                  className="text-xs text-zinc-400 flex items-center gap-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Preferred: </span>
              <span className="text-zinc-600 dark:text-zinc-400">
                {profile?.fashion_preferences?.preferred_colors?.join(', ') || 'None selected'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-rose-600">Avoided / Disliked: </span>
              <span className="text-zinc-600 dark:text-zinc-400">
                {profile?.fashion_preferences?.disliked_colors?.length > 0
                  ? profile?.fashion_preferences?.disliked_colors?.join(', ')
                  : 'None (all colors welcome)'}
              </span>
            </div>
          </div>
        </div>

        {/* Subsection 4: Occasions Routine */}
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Occasion Preferences
              </h3>
            </div>
            {editingSection !== 'occasions' ? (
              <button
                onClick={() => setEditingSection('occasions')}
                className="text-xs text-primary-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    saveSection('occasions', {
                      occasion_preferences: {
                        regular_occasions: occasionsForm,
                        occasion_notes: {},
                      },
                    })
                  }
                  disabled={isSaving}
                  className="text-xs text-emerald-600 font-bold flex items-center gap-0.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  onClick={() => setEditingSection(null)}
                  className="text-xs text-zinc-400 flex items-center gap-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {profile?.occasion_preferences?.regular_occasions?.length > 0 ? (
              profile.occasion_preferences.regular_occasions.map((occ: string) => (
                <span
                  key={occ}
                  className="text-[11px] px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium"
                >
                  {occ}
                </span>
              ))
            ) : (
              <span className="text-xs text-zinc-500">Everyday, Office, Casual outings</span>
            )}
          </div>
        </div>

        {/* Subsection 5: Shopping & Budget Habits */}
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Shopping & Gap Preferences
              </h3>
            </div>
            {editingSection !== 'shopping' ? (
              <button
                onClick={() => setEditingSection('shopping')}
                className="text-xs text-primary-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    saveSection('shopping', {
                      shopping_preferences: shoppingForm,
                    })
                  }
                  disabled={isSaving}
                  className="text-xs text-emerald-600 font-bold flex items-center gap-0.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  onClick={() => setEditingSection(null)}
                  className="text-xs text-zinc-400 flex items-center gap-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5 pt-1">
            <p>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Budget Tier: </span>
              <span className="capitalize">{profile?.shopping_preferences?.budget_tier?.replace('_', ' ') || 'Mid-range'}</span>
            </p>
            <p>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Philosophy: </span>
              <span className="capitalize">{profile?.shopping_preferences?.shopping_philosophy?.replace('_', ' ') || 'Essentials first'}</span>
            </p>
          </div>
        </div>

        {/* Subsection 6: Recommendation Behaviour */}
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Stylist Behaviour Tuning
              </h3>
            </div>
            {editingSection !== 'tuning' ? (
              <button
                onClick={() => setEditingSection('tuning')}
                className="text-xs text-primary-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    saveSection('tuning', {
                      recommendation_settings: recSettingsForm,
                    })
                  }
                  disabled={isSaving}
                  className="text-xs text-emerald-600 font-bold flex items-center gap-0.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  onClick={() => setEditingSection(null)}
                  className="text-xs text-zinc-400 flex items-center gap-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5 pt-1">
            <p>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Repeat Avoidance: </span>
              <span className="capitalize">{profile?.recommendation_settings?.repeat_frequency || 'Moderate (staples ok)'}</span>
            </p>
            <p>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Pairing Style: </span>
              <span className="capitalize">{profile?.recommendation_settings?.familiar_vs_new || 'Balanced'}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
