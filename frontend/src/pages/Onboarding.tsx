import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  User,
  Globe,
  Palette,
  Shirt,
  Compass,
  Sliders,
  Edit2,
  Heart,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { AVATAR_OPTIONS, getDefaultAvatar, AvatarStyle } from '../utils/avatarHelper';

// --- QUESTION DATA DEFINITIONS ---

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male', desc: 'Masculine-styled silhouette fallback' },
  { id: 'female', label: 'Female', desc: 'Feminine-styled silhouette fallback' },
  { id: 'non-binary', label: 'Non-binary', desc: 'Contemporary androgynous silhouette' },
  { id: 'prefer-not-to-say', label: 'Prefer not to say', desc: 'Neutral atelier mannequin fallback' },
];

const STYLE_OPTIONS = [
  { id: 'Casual', label: 'Casual', desc: 'Everyday comfort, quality basics & easy styling' },
  { id: 'Smart casual', label: 'Smart Casual', desc: 'Tailored trousers, fine knitwear & polished ease' },
  { id: 'Formal', label: 'Formal', desc: 'Sharp tailoring, structured silhouettes & evening polish' },
  { id: 'Streetwear', label: 'Streetwear', desc: 'Contemporary oversized fits, statement sneakers & bold accents' },
  { id: 'Minimalist', label: 'Minimalist', desc: 'Clean lines, monochromatic palettes & understated luxury' },
  { id: 'Traditional Indian', label: 'Traditional Indian', desc: 'Sarees, kurtas, lehengas & heritage handcrafted textiles' },
  { id: 'Ethnic fusion', label: 'Ethnic Fusion', desc: 'Indo-western drapes, contemporary kurtis & hybrid aesthetics' },
  { id: 'Sporty', label: 'Sporty', desc: 'Athletic wearability, performance textiles & active movement' },
  { id: 'Vintage', label: 'Vintage', desc: 'Nostalgic cuts, heritage leather & retro aesthetic nuance' },
  { id: 'Elegant', label: 'Elegant', desc: 'Timeless evening wear, silk textures & graceful lines' },
  { id: 'Trendy', label: 'Trendy', desc: 'Runway rotations, seasonal statement pieces & bold silhouettes' },
];

const CATEGORY_OPTIONS = [
  'Shirts',
  'T-shirts',
  'Jeans',
  'Trousers',
  'Dresses',
  'Kurtas',
  'Sarees',
  'Lehengas',
  'Salwar suits',
  'Sherwanis',
  'Sneakers',
  'Formal footwear',
  'Sandals',
  'Accessories',
];

const COLOR_SWATCHES = [
  { name: 'Black', hex: '#18181B' },
  { name: 'White', hex: '#FFFFFF', border: true },
  { name: 'Gray', hex: '#71717A' },
  { name: 'Navy', hex: '#1E3A8A' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Red', hex: '#DC2626' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Brown', hex: '#78350F' },
  { name: 'Beige', hex: '#D4B996' },
  { name: 'Cream', hex: '#FDFBF7', border: true },
  { name: 'Purple', hex: '#9333EA' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Multicolor', gradient: true },
  { name: 'No preference', none: true },
];

const OCCASION_OPTIONS = [
  'Office / Work',
  'College',
  'Casual outings',
  'Parties',
  'Weddings and functions',
  'Traditional occasions',
  'Travel',
  'Sports / Gym',
  'Dates',
  'Family gatherings',
];

const FIT_OPTIONS = ['Slim', 'Regular', 'Relaxed', 'Oversized', 'No preference'];

const OUTFIT_STYLE_OPTIONS = [
  'Simple and comfortable',
  'Coordinated colors',
  'Bold combinations',
  'Classic and formal',
  'Trend-focused',
  'No preference',
];

const BUDGET_OPTIONS = ['Budget-conscious', 'Mid-range', 'Premium', 'No preference'];

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { refreshData, showToast } = useApp();
  const currentUser = useCurrentUser();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Basic Profile
  const [displayName, setDisplayName] = useState(currentUser?.name || '');
  const [gender, setGender] = useState<string>('prefer-not-to-say');
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('neutral');
  const [country, setCountry] = useState(currentUser?.location || '');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [dob, setDob] = useState('');

  // Step 2: Fashion preferences
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['Minimalist', 'Smart casual']);

  // Step 3: Clothing interests
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Shirts', 'Trousers', 'Sneakers']);

  // Step 4: Preferred colors
  const [selectedColors, setSelectedColors] = useState<string[]>(['Black', 'White', 'Beige']);

  // Step 5: Lifestyle and occasions
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(['Office / Work', 'Casual outings']);

  // Step 6: Fit and styling
  const [selectedFit, setSelectedFit] = useState<string>('Regular');
  const [selectedOutfitStyle, setSelectedOutfitStyle] = useState<string>('Simple and comfortable');
  const [selectedBudget, setSelectedBudget] = useState<string>('Mid-range');

  // Toggle multi-select helper
  const toggleSelection = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (item === 'No preference') {
      setter(['No preference']);
      return;
    }
    const cleanList = list.filter((i) => i !== 'No preference');
    if (cleanList.includes(item)) {
      const next = cleanList.filter((i) => i !== item);
      setter(next.length > 0 ? next : ['No preference']);
    } else {
      setter([...cleanList, item]);
    }
  };

  const handleGenderSelect = (val: string) => {
    setGender(val);
    if (val === 'male') setAvatarStyle('masculine');
    else if (val === 'female') setAvatarStyle('feminine');
    else if (val === 'non-binary') setAvatarStyle('androgynous');
    else setAvatarStyle('neutral');
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      await api.users.completeOnboarding({
        display_name: displayName.trim() || undefined,
        gender,
        avatar_style: avatarStyle,
        country: country.trim() || undefined,
        preferred_language: preferredLanguage,
        date_of_birth: dob.trim() || undefined,
        preferred_styles: selectedStyles,
        preferred_categories: selectedCategories,
        preferred_colors: selectedColors,
        preferred_occasions: selectedOccasions,
        preferred_fit: selectedFit,
        styling_preference: selectedOutfitStyle,
        budget_preference: selectedBudget,
      });

      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#18181B', '#D97706', '#71717A', '#F4F4F5'],
      });

      showToast('Your style profile is set! Welcome to TailorBird.', 'success');
      await refreshData();
      navigate('/home', { replace: true });
    } catch (err: any) {
      showToast(err?.message || 'Failed to complete onboarding. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand-50 dark:bg-zinc-950 flex flex-col justify-between py-6 px-4 sm:px-8">
      {/* Top Header */}
      <div className="max-w-3xl mx-auto w-full flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-zinc-100 dark:text-zinc-900 font-bold text-sm tracking-wider">
            T
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            TailorBird
          </span>
        </div>

        {/* 7-Step Progress Indicator */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <div
              key={s}
              onClick={() => s < step && setStep(s)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-7 bg-zinc-900 dark:bg-zinc-100'
                  : s < step
                  ? 'w-3.5 bg-zinc-600 dark:bg-zinc-400 cursor-pointer'
                  : 'w-3.5 bg-zinc-200 dark:bg-zinc-800'
              }`}
            />
          ))}
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 ml-2">
            Step {step} of 7
          </span>
        </div>
      </div>

      {/* Main Multi-Step Form Body */}
      <div className="max-w-2xl mx-auto w-full my-auto py-6">
        <AnimatePresence mode="wait">
          {/* STEP 1: BASIC PROFILE & GENDER */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                  Step 1 &middot; Welcome
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Configure Your Profile
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Tell us a bit about yourself. Gender selection is optional and solely chooses your default faceless avatar.
                </p>
              </div>

              {/* Avatar Preview */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <Avatar
                  size="xl"
                  gender={gender}
                  avatarStyle={avatarStyle}
                  alt={displayName || 'Your avatar'}
                  className="ring-2 ring-zinc-200 dark:ring-zinc-700"
                />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
                    Your Faceless Default Avatar
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">
                    Illustrated fallback when no profile photo is uploaded. You can customize this or upload your own photo anytime.
                  </p>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Clara Vane"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                  <User className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                </div>
              </div>

              {/* Gender Selection (Optional) */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Gender Selection <span className="font-normal text-zinc-400">(Optional &middot; For default avatar styling only)</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleGenderSelect(opt.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        gender === opt.id
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <span className="block text-xs font-bold">{opt.label}</span>
                      <span className={`text-[11px] block mt-0.5 line-clamp-1 ${gender === opt.id ? 'opacity-80' : 'text-zinc-400'}`}>
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Country & Language */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Country / Region <span className="font-normal text-zinc-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. India, United States"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Preferred Language
                  </label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="Spanish">Spanish (Español)</option>
                    <option value="French">French (Français)</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: FASHION PREFERENCES (STYLES) */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                  Step 2 &middot; Aesthetics
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  What styles do you usually prefer?
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Select all aesthetics that resonate with you. TailorBird uses these to curate daily outfit recommendations.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {STYLE_OPTIONS.map((s) => {
                  const selected = selectedStyles.includes(s.label);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSelection(selectedStyles, s.label, setSelectedStyles)}
                      className={`p-3.5 rounded-xl border text-left flex items-start justify-between gap-2.5 transition-all ${
                        selected
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900/5 dark:bg-zinc-100/10 ring-1 ring-zinc-900 dark:ring-zinc-100'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300'
                      }`}
                    >
                      <div>
                        <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {s.label}
                        </span>
                        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {s.desc}
                        </span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border ${
                          selected
                            ? 'bg-zinc-900 dark:bg-zinc-100 border-transparent text-white dark:text-zinc-900'
                            : 'border-zinc-300 dark:border-zinc-700'
                        }`}
                      >
                        {selected && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 3: CLOTHING INTERESTS (CATEGORIES) */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                  Step 3 &middot; Wardrobe Staples
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Which items do you commonly wear?
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  All categories are open to everyone without gender restrictions.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => {
                  const selected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleSelection(selectedCategories, cat, setSelectedCategories)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                        selected
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 4: PREFERRED COLORS */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                  Step 4 &middot; Color Palette
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Which colors do you enjoy wearing?
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Select your go-to hues. TailorBird balances these with high-contrast color harmony rules.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {COLOR_SWATCHES.map((swatch) => {
                  const selected = selectedColors.includes(swatch.name);
                  return (
                    <button
                      key={swatch.name}
                      type="button"
                      onClick={() => toggleSelection(selectedColors, swatch.name, setSelectedColors)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-all ${
                        selected
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900/5 dark:bg-zinc-100/10 ring-1 ring-zinc-900 dark:ring-zinc-100'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                          swatch.border ? 'border border-zinc-300' : ''
                        }`}
                        style={{
                          backgroundColor: swatch.hex,
                          background: swatch.gradient
                            ? 'linear-gradient(135deg, #EC4899, #3B82F6, #10B981, #F59E0B)'
                            : swatch.hex,
                        }}
                      >
                        {selected && (
                          <Check
                            className={`w-3 h-3 ${
                              swatch.name === 'White' || swatch.name === 'Cream' || swatch.name === 'Yellow'
                                ? 'text-zinc-900'
                                : 'text-white'
                            }`}
                          />
                        )}
                      </div>
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                        {swatch.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 5: LIFESTYLE & OCCASIONS */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                  Step 5 &middot; Lifestyle
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Which situations do you commonly dress for?
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Helps TailorBird match your daily routines and calendar context.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {OCCASION_OPTIONS.map((occ) => {
                  const selected = selectedOccasions.includes(occ);
                  return (
                    <button
                      key={occ}
                      type="button"
                      onClick={() => toggleSelection(selectedOccasions, occ, setSelectedOccasions)}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                        selected
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <span className="text-xs font-bold">{occ}</span>
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                          selected
                            ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white border-transparent'
                            : 'border-zinc-300 dark:border-zinc-700'
                        }`}
                      >
                        {selected && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 6: FIT & STYLING PREFERENCES */}
          {step === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                  Step 6 &middot; Fit & Sensitivity
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Fit & Styling Preferences
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Fine-tune your silhouette cut and outfit assembly vibe.
                </p>
              </div>

              {/* Preferred Fit */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Preferred Garment Fit
                </label>
                <div className="flex flex-wrap gap-2">
                  {FIT_OPTIONS.map((fit) => (
                    <button
                      key={fit}
                      type="button"
                      onClick={() => setSelectedFit(fit)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        selectedFit === fit
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {fit}
                    </button>
                  ))}
                </div>
              </div>

              {/* Outfit Assembly Style */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Preferred Outfit Assembly Style
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OUTFIT_STYLE_OPTIONS.map((ostyle) => (
                    <button
                      key={ostyle}
                      type="button"
                      onClick={() => setSelectedOutfitStyle(ostyle)}
                      className={`p-2.5 rounded-lg border text-left text-xs font-bold transition-all ${
                        selectedOutfitStyle === ostyle
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      {ostyle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Budget Sensitivity */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Shopping & Acquisition Sensitivity <span className="font-normal text-zinc-400">(Optional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_OPTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSelectedBudget(b)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        selectedBudget === b
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 7: SUMMARY & CONFIRMATION */}
          {step === 7 && (
            <motion.div
              key="step7"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                  Step 7 &middot; Profile Review
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Your Personalized Style Blueprint
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Review your answers below. You can easily adjust individual sections now or update them later in Settings.
                </p>
              </div>

              <div className="space-y-3.5 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs">
                {/* Profile summary */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <Avatar size="md" gender={gender} avatarStyle={avatarStyle} />
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-zinc-100">{displayName || 'Fashion Enthusiast'}</p>
                      <p className="text-zinc-400 text-[11px]">
                        Gender: {gender.replace('-', ' ')} &middot; {country || 'Global'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setStep(1)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold flex items-center gap-1">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                </div>

                {/* Styles */}
                <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 block mb-1">Preferred Aesthetics</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedStyles.map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-semibold">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setStep(2)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold flex items-center gap-1">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                </div>

                {/* Categories */}
                <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 block mb-1">Wardrobe Staples</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedCategories.map((c) => (
                        <span key={c} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-semibold">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setStep(3)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold flex items-center gap-1">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                </div>

                {/* Colors */}
                <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 block mb-1">Color Palette</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedColors.map((col) => (
                        <span key={col} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-semibold">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setStep(4)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold flex items-center gap-1">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                </div>

                {/* Occasions & Fit */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 block mb-1">Fit & Occasions</span>
                    <p className="text-zinc-500 text-[11px]">
                      Fit: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedFit}</span> &middot; Style: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedOutfitStyle}</span>
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedOccasions.map((o) => (
                        <span key={o} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-semibold">
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setStep(5)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold flex items-center gap-1">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Sticky Navigation */}
      <div className="max-w-2xl mx-auto w-full pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
        {step > 1 ? (
          <Button
            size="md"
            variant="outline"
            onClick={() => setStep(step - 1)}
            className="flex items-center gap-1.5 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {step < 7 && (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-2 font-medium"
            >
              Skip
            </button>
          )}

          {step < 7 ? (
            <Button
              size="md"
              variant="primary"
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 text-xs px-6"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="md"
              variant="primary"
              isLoading={isSubmitting}
              onClick={handleFinish}
              className="flex items-center gap-1.5 text-xs px-8 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 shadow-md font-bold"
            >
              <Sparkles className="w-4 h-4" />
              Finish & Unlock Recommendations
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
