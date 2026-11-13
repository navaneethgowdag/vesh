import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Briefcase,
  GraduationCap,
  Calendar,
  Palette,
  Layers,
  ShoppingBag,
  Sliders,
  CheckCircle2,
  Clock,
  Heart,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '../components/ui/Button';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';

// --- CONSTANTS & TAXONOMIES ---

const OCCUPATION_OPTIONS = [
  { id: 'student', label: 'Student', icon: GraduationCap, desc: 'College, university, or high school campus life' },
  { id: 'working_professional', label: 'Working Professional', icon: Briefcase, desc: 'Corporate, tech, healthcare, or office environments' },
  { id: 'freelancer', label: 'Freelancer / Consultant', icon: Layers, desc: 'Flexible schedule, hybrid client meetings & remote work' },
  { id: 'homemaker', label: 'Homemaker', icon: Heart, desc: 'Comfort-first daily routines and family management' },
  { id: 'job_seeker', label: 'Job Seeker', icon: Sparkles, desc: 'Preparing for interviews, networking, and career transitions' },
  { id: 'other', label: 'Other', icon: Calendar, desc: 'Unique lifestyle, artistic, or custom daily routines' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say', icon: Sliders, desc: 'Keep styling general without lifestyle specifics' },
];

const STYLE_AESTHETICS = [
  { id: 'Minimalist', label: 'Minimalist', desc: 'Clean silhouettes, neutral tones & uncluttered tailoring' },
  { id: 'Classic', label: 'Classic / Timeless', desc: 'Structured essentials, enduring cuts & refined polish' },
  { id: 'Smart casual', label: 'Smart Casual', desc: 'Chinos, blazers, polos & polished everyday versatility' },
  { id: 'Casual', label: 'Casual / Effortless', desc: 'Everyday comfort, quality denim & relaxed basics' },
  { id: 'Streetwear', label: 'Streetwear', desc: 'Contemporary oversized cuts, statement sneakers & graphic pieces' },
  { id: 'Traditional Indian', label: 'Traditional / Ethnic', desc: 'Sarees, kurtas, lehengas & heritage handcrafted textiles' },
  { id: 'Bohemian', label: 'Bohemian', desc: 'Flowing drapes, relaxed textures & artisanal flair' },
  { id: 'Sporty', label: 'Athletic / Sporty', desc: 'Active performance wear, joggers & technical fabrics' },
  { id: 'Bold', label: 'Bold / Statement', desc: 'Expressive colors, dramatic cuts & runway-inspired styling' },
  { id: 'Vintage', label: 'Vintage / Retro', desc: 'Nostalgic eras, heritage denim & textured throwback pieces' },
];

const COLOR_PALETTES = [
  { name: 'Black', hex: '#18181B' },
  { name: 'White', hex: '#FFFFFF', border: true },
  { name: 'Navy', hex: '#1E3A8A' },
  { name: 'Grey', hex: '#71717A' },
  { name: 'Beige / Khaki', hex: '#D4B996' },
  { name: 'Brown', hex: '#78350F' },
  { name: 'Olive Green', hex: '#4D7C0F' },
  { name: 'Pastels', hex: '#FBCFE8' },
  { name: 'Jewel Tones', hex: '#047857' },
  { name: 'Vibrant / Bright', hex: '#EA580C' },
];

const OCCASIONS_LIST = [
  'Everyday',
  'College',
  'Office',
  'Business meetings',
  'Presentations',
  'Casual outings',
  'Parties',
  'Dates',
  'Weddings',
  'Festivals',
  'Family gatherings',
  'Gym / Sports',
  'Travel',
  'Interviews',
  'Formal events',
];

const DEFAULT_WEEKLY_ROUTINE = [
  { day: 'Monday', activity: 'Work', time_range: '09:00 - 18:00', dress_code: 'Smart Casual' },
  { day: 'Tuesday', activity: 'Work', time_range: '09:00 - 18:00', dress_code: 'Business Casual' },
  { day: 'Wednesday', activity: 'Work', time_range: '09:00 - 18:00', dress_code: 'Smart Casual' },
  { day: 'Thursday', activity: 'Work', time_range: '09:00 - 18:00', dress_code: 'Smart Casual' },
  { day: 'Friday', activity: 'Work', time_range: '09:00 - 17:00', dress_code: 'Casual' },
  { day: 'Saturday', activity: 'Outing', time_range: '11:00 - 22:00', dress_code: 'Casual' },
  { day: 'Sunday', activity: 'Rest', time_range: 'All Day', dress_code: 'Casual' },
];

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { refreshData, showToast } = useApp();
  const currentUser = useCurrentUser();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Lifestyle & Occupation
  const [occupation, setOccupation] = useState<string>('working_professional');
  const [studentDetails, setStudentDetails] = useState({
    institution: 'College / University',
    fieldOfStudy: '',
    campusDress: 'Casual',
  });
  const [workDetails, setWorkDetails] = useState({
    industry: 'Technology',
    dressCode: 'Smart Casual',
    workMode: 'Hybrid',
  });
  const [freelancerDetails, setFreelancerDetails] = useState({
    field: 'Creative / Tech',
    meetingFrequency: 'A few times a week',
  });
  const [generalRoutineStyle, setGeneralRoutineStyle] = useState('Mixed / Flexible');

  // Step 2: Daily Routine & Weekly Schedule
  const [weeklyRoutine, setWeeklyRoutine] = useState(DEFAULT_WEEKLY_ROUTINE);

  // Step 3: Fashion Preferences
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['Minimalist', 'Smart casual']);
  const [preferredColors, setPreferredColors] = useState<string[]>(['Black', 'White', 'Navy']);
  const [dislikedColors, setDislikedColors] = useState<string[]>([]);
  const [selectedFits, setSelectedFits] = useState<string[]>(['Regular', 'Relaxed']);
  const [comfortVsAppearance, setComfortVsAppearance] = useState<'comfort' | 'balanced' | 'style'>('balanced');
  const [simpleVsExperimental, setSimpleVsExperimental] = useState<'simple' | 'balanced' | 'experimental'>('balanced');

  // Step 4: Occasion Preferences
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([
    'Everyday',
    'Office',
    'Casual outings',
    'Dates',
  ]);

  // Step 5: Shopping & Wardrobe Preferences (Optional)
  const [budgetTier, setBudgetTier] = useState<string>('mid_range');
  const [shoppingPhilosophy, setShoppingPhilosophy] = useState<string>('essentials_first');
  const [preferredCategories, setPreferredCategories] = useState<string[]>([
    'Tops & Shirts',
    'Bottoms & Jeans',
    'Footwear',
  ]);
  const [preferredPlatforms, setPreferredPlatforms] = useState<string[]>(['Myntra', 'Zara', 'Uniqlo']);

  // Step 6: Recommendation Tuning
  const [comfortPriority, setComfortPriority] = useState<number>(0.5);
  const [familiarVsNew, setFamiliarVsNew] = useState<string>('balanced');
  const [repeatFrequency, setRepeatFrequency] = useState<string>('moderate');
  const [varietyPreference, setVarietyPreference] = useState<string>('balanced');

  // Multi-select toggle helpers
  const toggleItem = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  // Quick routine template application
  const applyRoutineTemplate = (type: 'work' | 'college' | 'hybrid' | 'casual') => {
    if (type === 'work') {
      setWeeklyRoutine([
        { day: 'Monday', activity: 'Work', time_range: '09:00 - 18:00', dress_code: 'Smart Casual' },
        { day: 'Tuesday', activity: 'Work', time_range: '09:00 - 18:00', dress_code: 'Business Casual' },
        { day: 'Wednesday', activity: 'Work', time_range: '09:00 - 18:00', dress_code: 'Smart Casual' },
        { day: 'Thursday', activity: 'Work', time_range: '09:00 - 18:00', dress_code: 'Smart Casual' },
        { day: 'Friday', activity: 'Work', time_range: '09:00 - 17:00', dress_code: 'Casual' },
        { day: 'Saturday', activity: 'Outing', time_range: '12:00 - 22:00', dress_code: 'Casual' },
        { day: 'Sunday', activity: 'Rest', time_range: 'All Day', dress_code: 'Casual' },
      ]);
    } else if (type === 'college') {
      setWeeklyRoutine([
        { day: 'Monday', activity: 'College', time_range: '09:00 - 16:00', dress_code: 'Casual' },
        { day: 'Tuesday', activity: 'College', time_range: '09:00 - 16:00', dress_code: 'Casual' },
        { day: 'Wednesday', activity: 'College', time_range: '09:00 - 16:00', dress_code: 'Casual' },
        { day: 'Thursday', activity: 'College', time_range: '09:00 - 16:00', dress_code: 'Casual' },
        { day: 'Friday', activity: 'College', time_range: '09:00 - 15:00', dress_code: 'Casual' },
        { day: 'Saturday', activity: 'Outing', time_range: '14:00 - 22:00', dress_code: 'Casual' },
        { day: 'Sunday', activity: 'Rest', time_range: 'All Day', dress_code: 'Casual' },
      ]);
    } else if (type === 'hybrid') {
      setWeeklyRoutine([
        { day: 'Monday', activity: 'Work (Home)', time_range: '09:00 - 18:00', dress_code: 'Casual' },
        { day: 'Tuesday', activity: 'Work (Office)', time_range: '09:00 - 18:00', dress_code: 'Smart Casual' },
        { day: 'Wednesday', activity: 'Work (Office)', time_range: '09:00 - 18:00', dress_code: 'Smart Casual' },
        { day: 'Thursday', activity: 'Work (Home)', time_range: '09:00 - 18:00', dress_code: 'Casual' },
        { day: 'Friday', activity: 'Work (Office)', time_range: '09:00 - 17:00', dress_code: 'Smart Casual' },
        { day: 'Saturday', activity: 'Outing', time_range: '12:00 - 21:00', dress_code: 'Casual' },
        { day: 'Sunday', activity: 'Rest', time_range: 'All Day', dress_code: 'Casual' },
      ]);
    }
    showToast('Routine template applied!', 'success');
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      const occDetails =
        occupation === 'student'
          ? studentDetails
          : occupation === 'working_professional'
          ? workDetails
          : occupation === 'freelancer'
          ? freelancerDetails
          : { routineStyle: generalRoutineStyle };

      const payload = {
        display_name: currentUser?.name || undefined,
        lifestyle_occupation: {
          occupation,
          details: occDetails,
        },
        occupation_details: occDetails,
        weekly_routine: weeklyRoutine,
        preferred_styles: selectedStyles,
        disliked_styles: [],
        preferred_colors: preferredColors,
        disliked_colors: dislikedColors,
        avoided_colors: dislikedColors,
        preferred_fits: selectedFits,
        preferred_occasions: selectedOccasions,
        shopping_preferences: {
          budget_tier: budgetTier,
          shopping_philosophy: shoppingPhilosophy,
          preferred_categories: preferredCategories,
          preferred_platforms: preferredPlatforms,
        },
        recommendation_settings: {
          comfort_priority: comfortPriority,
          familiar_vs_new: familiarVsNew,
          repeat_frequency: repeatFrequency,
          variety_preference: varietyPreference,
          comfort_vs_appearance: comfortVsAppearance,
          simple_vs_experimental: simpleVsExperimental,
        },
      };

      await api.users.completeOnboarding(payload);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      showToast('Styling profile configured! Welcome to TailorBird.', 'success');
      await refreshData();
      navigate('/home', { replace: true });
    } catch (err: any) {
      showToast(err?.message || 'Could not save profile.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3EEE8] dark:bg-[#1A151C] text-[#29202B] dark:text-[#F3EEE8] flex flex-col justify-between p-4 sm:p-6 lg:p-8 transition-colors duration-200">
      {/* Top Header */}
      <div className="max-w-3xl mx-auto w-full flex items-center justify-between pb-4 border-b border-[#DCD4CC] dark:border-[#392F3E]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[2px] bg-[#29202B] dark:bg-[#F3EEE8] text-[#FFFFFF] dark:text-[#29202B] flex items-center justify-center font-serif font-bold text-base shadow-xs">
            T
          </div>
          <div>
            <h1 className="text-base font-serif font-bold text-[#29202B] dark:text-[#F3EEE8]">TailorBird Atelier Setup</h1>
            <p className="text-[11px] font-sans uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B]">Step {step} of 6</p>
          </div>
        </div>

        {/* Step Indicator dots */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={`h-1 rounded-[1px] transition-all duration-300 ${
                i === step
                  ? 'w-7 bg-[#743C49] dark:bg-[#D5A6A0]'
                  : i < step
                  ? 'w-2.5 bg-[#6D7068]'
                  : 'w-2.5 bg-[#DCD4CC] dark:bg-[#392F3E]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Form Content */}
      <div className="max-w-3xl mx-auto w-full py-8 flex-1">
        <AnimatePresence mode="wait">
          {/* ------------------------------------------------------------- */}
          {/* STEP 1: LIFESTYLE & OCCUPATION */}
          {/* ------------------------------------------------------------- */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <span className="text-[10px] font-sans font-semibold text-[#743C49] dark:text-[#D5A6A0] uppercase tracking-[0.2em] block">
                  Lifestyle Foundation
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight mt-1">
                  <span>What is your</span>{' '}
                  <span className="italic font-normal font-serif text-[#743C49] dark:text-[#D5A6A0]">
                    primary daily activity?
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] mt-1 font-sans">
                  TailorBird adapts recommendations around your real day-to-day lifestyle.
                </p>
              </div>

              {/* Occupation Radio Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OCCUPATION_OPTIONS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = occupation === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setOccupation(item.id)}
                      className={`p-4 rounded-[4px] border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#FAF6F0] text-[#29202B] dark:bg-[#2E2432] dark:text-[#F3EEE8] border-[#743C49] dark:border-[#D5A6A0] ring-1 ring-[#743C49] dark:ring-[#D5A6A0] shadow-xs'
                          : 'bg-[#FFFFFF] dark:bg-[#241D27] border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49]/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-[#743C49] dark:text-[#D5A6A0]' : 'text-[#6D7068] dark:text-[#A89E9B]'}`} />
                        <span className="font-semibold text-sm font-sans">{item.label}</span>
                      </div>
                      <p className={`text-xs mt-2 font-sans ${isSelected ? 'text-[#6D7068] dark:text-[#D5A6A0]' : 'text-[#6D7068] dark:text-[#A89E9B]'}`}>
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Conditional Questions */}
              {occupation === 'student' && (
                <div className="p-4 rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] space-y-4">
                  <h3 className="text-[10px] font-sans font-semibold uppercase tracking-[0.16em] text-[#743C49] dark:text-[#D5A6A0]">
                    Student Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                    <div>
                      <label className="block font-medium mb-1 text-[#6D7068] dark:text-[#A89E9B]">Campus Environment</label>
                      <select
                        value={studentDetails.campusDress}
                        onChange={(e) => setStudentDetails({ ...studentDetails, campusDress: e.target.value })}
                        className="w-full p-2.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] bg-[#FAF6F0] dark:bg-[#1A151C] text-[#29202B] dark:text-[#F3EEE8] focus:border-[#743C49]"
                      >
                        <option value="Casual">Casual / Relaxed</option>
                        <option value="Smart casual">Smart Casual</option>
                        <option value="Strict formal / Uniform">Uniform / Strict Formal</option>
                        <option value="Creative / Expressive">Creative & Expressive</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-[#6D7068] dark:text-[#A89E9B]">Major or Field (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Design, Law, Computer Science"
                        value={studentDetails.fieldOfStudy}
                        onChange={(e) => setStudentDetails({ ...studentDetails, fieldOfStudy: e.target.value })}
                        className="w-full p-2.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] bg-[#FAF6F0] dark:bg-[#1A151C] text-[#29202B] dark:text-[#F3EEE8] focus:border-[#743C49]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {occupation === 'working_professional' && (
                <div className="p-4 rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] space-y-4">
                  <h3 className="text-[10px] font-sans font-semibold uppercase tracking-[0.16em] text-[#743C49] dark:text-[#D5A6A0]">
                    Workplace Context
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-sans">
                    <div>
                      <label className="block font-medium mb-1 text-[#6D7068] dark:text-[#A89E9B]">Industry</label>
                      <select
                        value={workDetails.industry}
                        onChange={(e) => setWorkDetails({ ...workDetails, industry: e.target.value })}
                        className="w-full p-2.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] bg-[#FAF6F0] dark:bg-[#1A151C] text-[#29202B] dark:text-[#F3EEE8] focus:border-[#743C49]"
                      >
                        <option value="Technology">Technology</option>
                        <option value="Finance & Corporate">Finance & Corporate</option>
                        <option value="Creative & Design">Creative & Design</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Education">Education</option>
                        <option value="Legal & Consulting">Legal & Consulting</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-[#6D7068] dark:text-[#A89E9B]">Workplace Dress Code</label>
                      <select
                        value={workDetails.dressCode}
                        onChange={(e) => setWorkDetails({ ...workDetails, dressCode: e.target.value })}
                        className="w-full p-2.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] bg-[#FAF6F0] dark:bg-[#1A151C] text-[#29202B] dark:text-[#F3EEE8] focus:border-[#743C49]"
                      >
                        <option value="Smart Casual">Smart Casual</option>
                        <option value="Business Casual">Business Casual</option>
                        <option value="Business Formal">Business Formal / Suits</option>
                        <option value="Tech Casual">Tech Casual</option>
                        <option value="Uniform / Scrubs">Uniform / Scrubs</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-[#6D7068] dark:text-[#A89E9B]">Work Mode</label>
                      <select
                        value={workDetails.workMode}
                        onChange={(e) => setWorkDetails({ ...workDetails, workMode: e.target.value })}
                        className="w-full p-2.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] bg-[#FAF6F0] dark:bg-[#1A151C] text-[#29202B] dark:text-[#F3EEE8] focus:border-[#743C49]"
                      >
                        <option value="Hybrid">Hybrid (2-3 days office)</option>
                        <option value="In-office">In-Office Full Time</option>
                        <option value="Remote">Fully Remote</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 2: DAILY ROUTINE & WEEKLY SCHEDULE */}
          {/* ------------------------------------------------------------- */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <span className="text-[10px] font-sans font-semibold text-[#743C49] dark:text-[#D5A6A0] uppercase tracking-[0.2em] block">
                  Weekly Rhythm
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight mt-1">
                  <span>Your Typical</span>{' '}
                  <span className="italic font-normal font-serif text-[#743C49] dark:text-[#D5A6A0]">
                    Monday to Sunday Routine
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] mt-1 font-sans">
                  On days without calendar events, Daily Fit uses this schedule to tailor your outfit dress code.
                </p>
              </div>

              {/* Template Shortcuts */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#6D7068] dark:text-[#A89E9B] mr-1 font-sans">Quick Apply:</span>
                <button
                  onClick={() => applyRoutineTemplate('work')}
                  className="px-3 py-1 text-xs rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] bg-[#FFFFFF] dark:bg-[#241D27] hover:border-[#743C49] transition-colors font-sans cursor-pointer"
                >
                  9-to-5 Office Weekdays
                </button>
                <button
                  onClick={() => applyRoutineTemplate('college')}
                  className="px-3 py-1 text-xs rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] bg-[#FFFFFF] dark:bg-[#241D27] hover:border-[#743C49] transition-colors font-sans cursor-pointer"
                >
                  College Campus
                </button>
                <button
                  onClick={() => applyRoutineTemplate('hybrid')}
                  className="px-3 py-1 text-xs rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] bg-[#FFFFFF] dark:bg-[#241D27] hover:border-[#743C49] transition-colors font-sans cursor-pointer"
                >
                  Hybrid Work Routine
                </button>
              </div>

              {/* Routine Days Grid */}
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {weeklyRoutine.map((item, idx) => (
                  <div
                    key={item.day}
                    className="p-3.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="w-24 font-serif font-bold text-base text-[#29202B] dark:text-[#F3EEE8]">{item.day}</div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1 font-sans">
                      <div>
                        <label className="block text-[10px] text-[#6D7068] dark:text-[#A89E9B] font-medium">Activity</label>
                        <select
                          value={item.activity}
                          onChange={(e) => {
                            const updated = [...weeklyRoutine];
                            updated[idx].activity = e.target.value;
                            setWeeklyRoutine(updated);
                          }}
                          className="w-full p-2 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] font-medium"
                        >
                          <option value="Work">Work / Office</option>
                          <option value="College">College / Study</option>
                          <option value="Gym">Gym / Workout</option>
                          <option value="Outing">Outing / Social</option>
                          <option value="Rest">Home / Rest</option>
                          <option value="Travel">Travel</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#6D7068] dark:text-[#A89E9B] font-medium">Dress Code</label>
                        <select
                          value={item.dress_code}
                          onChange={(e) => {
                            const updated = [...weeklyRoutine];
                            updated[idx].dress_code = e.target.value;
                            setWeeklyRoutine(updated);
                          }}
                          className="w-full p-2 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] font-medium"
                        >
                          <option value="Smart Casual">Smart Casual</option>
                          <option value="Business Casual">Business Casual</option>
                          <option value="Formal">Formal</option>
                          <option value="Casual">Casual</option>
                          <option value="Activewear">Activewear</option>
                          <option value="Festive">Festive / Traditional</option>
                        </select>
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[10px] text-[#6D7068] dark:text-[#A89E9B] font-medium">Time Window</label>
                        <input
                          type="text"
                          value={item.time_range}
                          onChange={(e) => {
                            const updated = [...weeklyRoutine];
                            updated[idx].time_range = e.target.value;
                            setWeeklyRoutine(updated);
                          }}
                          className="w-full p-2 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] font-medium"
                          placeholder="e.g. 09:00 - 17:00"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 3: FASHION PREFERENCES & PALETTES */}
          {/* ------------------------------------------------------------- */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <span className="text-[10px] font-sans font-semibold text-[#743C49] dark:text-[#D5A6A0] uppercase tracking-[0.2em] block">
                  Personal Aesthetics
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight mt-1">
                  <span>How do you like</span>{' '}
                  <span className="italic font-normal font-serif text-[#743C49] dark:text-[#D5A6A0]">
                    to dress?
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] mt-1 font-sans">
                  Select your core aesthetics and color preferences.
                </p>
              </div>

              {/* Style Aesthetic Chips */}
              <div className="space-y-2">
                <label className="text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B]">
                  Style Aesthetics (Select up to 4)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {STYLE_AESTHETICS.map((st) => {
                    const isSelected = selectedStyles.includes(st.id);
                    return (
                      <div
                        key={st.id}
                        onClick={() => toggleItem(selectedStyles, st.id, setSelectedStyles)}
                        className={`p-3.5 rounded-[4px] border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#FAF6F0] text-[#29202B] dark:bg-[#2E2432] dark:text-[#F3EEE8] border-[#743C49] dark:border-[#D5A6A0] ring-1 ring-[#743C49] dark:ring-[#D5A6A0] shadow-xs'
                            : 'bg-[#FFFFFF] dark:bg-[#241D27] border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49]/50'
                        }`}
                      >
                        <p className="font-semibold font-sans">{st.label}</p>
                        <p className={`text-[11px] mt-1 line-clamp-2 font-sans ${isSelected ? 'text-[#743C49] dark:text-[#D5A6A0]' : 'text-[#6D7068] dark:text-[#A89E9B]'}`}>
                          {st.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Color Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B]">
                    Favorite Colors
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_PALETTES.map((c) => {
                      const isSelected = preferredColors.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => toggleItem(preferredColors, c.name, setPreferredColors)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-medium border cursor-pointer transition-all font-sans ${
                            isSelected
                              ? 'bg-[#29202B] text-white dark:bg-[#F3EEE8] dark:text-[#29202B] border-transparent shadow-xs'
                              : 'bg-[#FFFFFF] dark:bg-[#241D27] border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8]'
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-black/20"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span>{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B]">
                    Disliked Colors (Avoid)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_PALETTES.map((c) => {
                      const isDisliked = dislikedColors.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => toggleItem(dislikedColors, c.name, setDislikedColors)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-medium border cursor-pointer transition-all font-sans ${
                            isDisliked
                              ? 'bg-[#A33D42] text-white border-transparent'
                              : 'bg-[#FFFFFF] dark:bg-[#241D27] border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8]'
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-black/20"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span>{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sliders: Comfort vs Style & Simple vs Experimental */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 font-sans">
                <div className="p-4 rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B]">Comfort vs. Appearance</span>
                  <div className="flex gap-2 text-xs">
                    {(['comfort', 'balanced', 'style'] as const).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setComfortVsAppearance(val)}
                        className={`flex-1 py-2 rounded-[2px] font-semibold capitalize border cursor-pointer transition-colors ${
                          comfortVsAppearance === val
                            ? 'bg-[#29202B] text-white dark:bg-[#F3EEE8] dark:text-[#29202B] border-transparent'
                            : 'border-[#DCD4CC] dark:border-[#392F3E] text-[#6D7068] dark:text-[#A89E9B]'
                        }`}
                      >
                        {val === 'comfort' ? 'Comfort First' : val === 'style' ? 'Style First' : 'Balanced'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B]">Simple vs. Experimental</span>
                  <div className="flex gap-2 text-xs">
                    {(['simple', 'balanced', 'experimental'] as const).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSimpleVsExperimental(val)}
                        className={`flex-1 py-2 rounded-[2px] font-semibold capitalize border cursor-pointer transition-colors ${
                          simpleVsExperimental === val
                            ? 'bg-[#29202B] text-white dark:bg-[#F3EEE8] dark:text-[#29202B] border-transparent'
                            : 'border-[#DCD4CC] dark:border-[#392F3E] text-[#6D7068] dark:text-[#A89E9B]'
                        }`}
                      >
                        {val === 'simple' ? 'Simple & Familiar' : val === 'experimental' ? 'Experimental' : 'Balanced'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 4: OCCASION PREFERENCES */}
          {/* ------------------------------------------------------------- */}
          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <span className="text-[10px] font-sans font-semibold text-[#743C49] dark:text-[#D5A6A0] uppercase tracking-[0.2em] block">
                  Occasion Focus
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight mt-1">
                  <span>Which occasions do you</span>{' '}
                  <span className="italic font-normal font-serif text-[#743C49] dark:text-[#D5A6A0]">
                    dress for regularly?
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] mt-1 font-sans">
                  Select all occasions that match your lifestyle.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {OCCASIONS_LIST.map((occ) => {
                  const isSelected = selectedOccasions.includes(occ);
                  return (
                    <div
                      key={occ}
                      onClick={() => toggleItem(selectedOccasions, occ, setSelectedOccasions)}
                      className={`p-3.5 rounded-[4px] border flex items-center justify-between cursor-pointer transition-all font-sans ${
                        isSelected
                          ? 'bg-[#FAF6F0] text-[#29202B] dark:bg-[#2E2432] dark:text-[#F3EEE8] border-[#743C49] dark:border-[#D5A6A0] ring-1 ring-[#743C49] dark:ring-[#D5A6A0] shadow-xs'
                          : 'bg-[#FFFFFF] dark:bg-[#241D27] border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49]/50 text-[#29202B] dark:text-[#F3EEE8]'
                      }`}
                    >
                      <span className="font-semibold text-xs">{occ}</span>
                      {isSelected && <Check className="w-4 h-4 shrink-0 text-[#743C49] dark:text-[#D5A6A0]" />}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 5: SHOPPING & WARDROBE PREFERENCES */}
          {/* ------------------------------------------------------------- */}
          {step === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <span className="text-[10px] font-sans font-semibold text-[#743C49] dark:text-[#D5A6A0] uppercase tracking-[0.2em] block">
                  Shopping & Budget Habits (Optional)
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight mt-1">
                  <span>How do you like</span>{' '}
                  <span className="italic font-normal font-serif text-[#743C49] dark:text-[#D5A6A0]">
                    to shop for clothing?
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] mt-1 font-sans">
                  Helps our Wardrobe Gap stylist surface relevant brand discoveries within your taste.
                </p>
              </div>

              {/* Budget Tier */}
              <div className="space-y-2 font-sans">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B]">
                  Budget Preference
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'budget', label: 'Budget-Friendly', desc: '₹ / Under ₹2,000' },
                    { id: 'mid_range', label: 'Mid-Range', desc: '₹₹ / ₹2,000 - ₹6,000' },
                    { id: 'premium', label: 'Premium / Designer', desc: '₹₹₹ / ₹6,000+' },
                  ].map((tier) => (
                    <div
                      key={tier.id}
                      onClick={() => setBudgetTier(tier.id)}
                      className={`p-3.5 rounded-[4px] border text-xs cursor-pointer transition-all ${
                        budgetTier === tier.id
                          ? 'bg-[#FAF6F0] text-[#29202B] dark:bg-[#2E2432] dark:text-[#F3EEE8] border-[#743C49] dark:border-[#D5A6A0] ring-1 ring-[#743C49] dark:ring-[#D5A6A0] shadow-xs'
                          : 'bg-[#FFFFFF] dark:bg-[#241D27] border-[#DCD4CC] dark:border-[#392F3E]'
                      }`}
                    >
                      <p className="font-semibold">{tier.label}</p>
                      <p className={`text-[11px] mt-1 ${budgetTier === tier.id ? 'text-[#743C49] dark:text-[#D5A6A0]' : 'text-[#6D7068] dark:text-[#A89E9B]'}`}>
                        {tier.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Philosophy */}
              <div className="space-y-2 font-sans">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B]">
                  Shopping Philosophy
                </label>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { id: 'essentials_first', label: 'Versatile Essentials First' },
                    { id: 'balanced', label: 'Balanced Mix' },
                    { id: 'trend_driven', label: 'Trend & Statement Driven' },
                  ].map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setShoppingPhilosophy(p.id)}
                      className={`p-3 rounded-[4px] border text-center font-medium cursor-pointer transition-all ${
                        shoppingPhilosophy === p.id
                          ? 'bg-[#FAF6F0] text-[#29202B] dark:bg-[#2E2432] dark:text-[#F3EEE8] border-[#743C49] dark:border-[#D5A6A0] ring-1 ring-[#743C49] dark:ring-[#D5A6A0]'
                          : 'bg-[#FFFFFF] dark:bg-[#241D27] border-[#DCD4CC] dark:border-[#392F3E]'
                      }`}
                    >
                      {p.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              <p className="text-[11px] text-[#6D7068] dark:text-[#A89E9B] italic font-sans">
                * Note: TailorBird never requests financial or payment card details.
              </p>
            </motion.div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 6: RECOMMENDATION TUNING */}
          {/* ------------------------------------------------------------- */}
          {step === 6 && (
            <motion.div
              key="step-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <span className="text-[10px] font-sans font-semibold text-[#743C49] dark:text-[#D5A6A0] uppercase tracking-[0.2em] block">
                  AI Recommendation Tuning
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight mt-1">
                  <span>How should TailorBird</span>{' '}
                  <span className="italic font-normal font-serif text-[#743C49] dark:text-[#D5A6A0]">
                    style you?
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] mt-1 font-sans">
                  Calibrate your daily stylist behavior to match your habits.
                </p>
              </div>

              <div className="space-y-4 font-sans">
                <div className="p-4 rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Repeat Frequency Behavior</span>
                    <span className="text-[#743C49] dark:text-[#D5A6A0] uppercase">{repeatFrequency}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { id: 'strict', label: 'Avoid repeats within 7 days' },
                      { id: 'moderate', label: 'Ok to repeat staple bottoms' },
                      { id: 'relaxed', label: 'Mix & match freely' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRepeatFrequency(opt.id)}
                        className={`p-2.5 rounded-[2px] border text-center font-medium cursor-pointer transition-colors ${
                          repeatFrequency === opt.id
                            ? 'bg-[#29202B] text-white dark:bg-[#F3EEE8] dark:text-[#29202B] border-transparent'
                            : 'border-[#DCD4CC] dark:border-[#392F3E]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Familiarity vs. New Pairings</span>
                    <span className="text-[#743C49] dark:text-[#D5A6A0] uppercase">{familiarVsNew}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { id: 'familiar', label: 'Safe go-to combinations' },
                      { id: 'balanced', label: 'Balanced styling' },
                      { id: 'novel', label: 'Surprise me with new looks' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFamiliarVsNew(opt.id)}
                        className={`p-2.5 rounded-[2px] border text-center font-medium cursor-pointer transition-colors ${
                          familiarVsNew === opt.id
                            ? 'bg-[#29202B] text-white dark:bg-[#F3EEE8] dark:text-[#29202B] border-transparent'
                            : 'border-[#DCD4CC] dark:border-[#392F3E]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="max-w-3xl mx-auto w-full pt-4 border-t border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-between font-sans">
        {step > 1 ? (
          <Button
            variant="outline"
            size="md"
            onClick={() => setStep(step - 1)}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-[3px] uppercase tracking-[0.14em] text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {step === 5 && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setStep(6)}
              disabled={isSubmitting}
              className="rounded-[3px] uppercase tracking-[0.14em] text-xs"
            >
              Skip
            </Button>
          )}

          {step < 6 ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 rounded-[3px] uppercase tracking-[0.14em] text-xs"
            >
              Next Step
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={handleFinish}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-[3px] uppercase tracking-[0.14em] text-xs shadow-md"
            >
              {isSubmitting ? 'Saving Profile...' : 'Complete Setup & Open Atelier'}
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
