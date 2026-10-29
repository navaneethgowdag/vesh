import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '../components/ui/Button';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { StyleVibe } from '../types';

const STYLE_OPTIONS: { label: StyleVibe; desc: string; img: string }[] = [
  {
    label: 'Minimal',
    desc: 'Clean lines, neutral tones, effortless elegance.',
    img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Casual',
    desc: 'Everyday comfort, quality basics, easy styling.',
    img: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Streetwear',
    desc: 'Contemporary oversized silhouettes, sneakers, bold accents.',
    img: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Formal',
    desc: 'Sharp tailoring, structured silhouettes, evening polish.',
    img: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Vintage',
    desc: 'Timeless heritage, nostalgic textures, retro cuts.',
    img: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Sporty',
    desc: 'Athletic wearability, performance fabrics, clean motion.',
    img: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Smart Casual',
    desc: 'Polished yet relaxed, tailored trousers with knitwear.',
    img: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=400&q=80',
  },
  {
    label: 'Trendy',
    desc: 'Runway-inspired, seasonal rotations, statement pieces.',
    img: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=400&q=80',
  },
];

const WEAR_OPTIONS = [
  'T-shirts',
  'Shirts',
  'Jeans',
  'Trousers',
  'Dresses',
  'Jackets',
  'Sneakers',
  'Boots',
];

const LIFESTYLE_OPTIONS = [
  { id: 'Student', title: 'Student', desc: 'Campus life, study cafes, casual flexibility' },
  { id: 'Professional', title: 'Professional', desc: 'Studio meetings, office dress codes, executive presentation' },
  { id: 'Freelancer', title: 'Freelancer', desc: 'Hybrid living, work-from-home comfort with impromptu client coffees' },
  { id: 'Entrepreneur', title: 'Entrepreneur', desc: 'Dynamic schedule, travel readiness, versatile power staples' },
  { id: 'Other', title: 'Other / Creative', desc: 'Artistic explorations, bespoke routines, eclectic lifestyles' },
];

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentUser, addClothingItem, showToast } = useApp();
  const currentUser = useCurrentUser();

  const [step, setStep] = useState(1);
  const [selectedStyles, setSelectedStyles] = useState<StyleVibe[]>(['Minimal', 'Smart Casual']);
  const [selectedWear, setSelectedWear] = useState<string[]>(['T-shirts', 'Jeans', 'Trousers', 'Sneakers']);
  const [lifestyle, setLifestyle] = useState('Professional');
  const [uploadedItems, setUploadedItems] = useState<{ name: string; image: string; category: string }[]>([
    {
      name: 'Essential White Boxy Tee',
      category: 'Tops',
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Straight Leg Denim',
      category: 'Bottoms',
      image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=500&q=80',
    },
  ]);

  const toggleStyle = (style: StyleVibe) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const toggleWear = (item: string) => {
    setSelectedWear((prev) =>
      prev.includes(item) ? prev.filter((w) => w !== item) : [...prev, item]
    );
  };

  const handleQuickAddWardrobe = (name: string, category: any, image: string) => {
    setUploadedItems((prev) => [...prev, { name, category, image }]);
    addClothingItem({
      name,
      category,
      color: 'White',
      style: selectedStyles[0] || 'Minimal',
      season: 'All-Season',
      image,
      pattern: 'Solid',
    });
  };

  const handleFinish = async () => {
    try {
      await api.users.updatePreferences({
        styles: selectedStyles,
        preferred_fits: selectedWear,
      });
      await api.users.updateProfile({ bio: lifestyle });

      setCurrentUser({
        ...currentUser,
        preferences: {
          ...currentUser.preferences,
          styles: selectedStyles,
          staplePieces: selectedWear,
          lifestyle,
        },
      });
    } catch {
      showToast('Could not save your style profile. Please try again.', 'info');
      return;
    }

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#18181B', '#71717A', '#E4E4E7', '#A1A1AA'],
    });

    showToast('Your style profile has been created! Welcome to StyleSphere.', 'success');
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-between py-8 px-4 sm:px-6">
      {/* Top Header */}
      <div className="max-w-3xl mx-auto w-full flex items-center justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-zinc-100 dark:text-zinc-900 font-bold text-sm">
            S
          </div>
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">StyleSphere</span>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-sm transition-all duration-300 ${
                s === step
                  ? 'w-8 bg-zinc-900 dark:bg-zinc-100'
                  : s < step
                  ? 'w-4 bg-zinc-700 dark:bg-zinc-300'
                  : 'w-4 bg-zinc-300 dark:bg-zinc-700'
              }`}
            />
          ))}
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 ml-2">Step {step} of 4</span>
        </div>
      </div>

      {/* Main Multi-Step Form */}
      <div className="max-w-3xl mx-auto w-full my-auto py-8">
        <AnimatePresence mode="wait">
          {/* STEP 1: STYLE */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Step 1
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-1">
                  What is your style?
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  Choose the aesthetic vibes that feel most authentic to you. Select all that apply.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {STYLE_OPTIONS.map((style) => {
                  const isSelected = selectedStyles.includes(style.label);

                  return (
                    <div
                      key={style.label}
                      onClick={() => toggleStyle(style.label)}
                      className={`group relative rounded-md overflow-hidden cursor-pointer border transition-all p-3 flex flex-col justify-between aspect-square shadow-sm ${
                        isSelected
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-900 dark:ring-zinc-100'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                          {style.label}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'border border-zinc-300 dark:border-zinc-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>

                      <div className="relative rounded-md overflow-hidden aspect-[4/3] mt-2 border border-zinc-200 dark:border-zinc-800">
                        <img
                          src={style.img}
                          alt={style.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 2: WHAT DO YOU WEAR? */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Step 2
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-1">
                  What do you usually wear?
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  Select your daily wardrobe building blocks.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {WEAR_OPTIONS.map((item) => {
                  const isSelected = selectedWear.includes(item);

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleWear(item)}
                      className={`p-3.5 rounded-md border text-left transition-all flex items-center justify-between min-h-[44px] cursor-pointer ${
                        isSelected
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="font-medium text-sm">{item}</span>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-xs ${
                          isSelected ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100' : 'border border-zinc-300 dark:border-zinc-600'
                        }`}
                      >
                        {isSelected && '✓'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 3: LIFESTYLE */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Step 3
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-1">
                  What's your typical lifestyle?
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  This fine-tunes whether our recommendations suggest formal tailoring or casual staples.
                </p>
              </div>

              <div className="space-y-3">
                {LIFESTYLE_OPTIONS.map((item) => {
                  const isSelected = lifestyle === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setLifestyle(item.id)}
                      className={`p-4 rounded-md border cursor-pointer transition-all flex items-center justify-between min-h-[52px] ${
                        isSelected
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-900 dark:ring-zinc-100 shadow-sm'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{item.title}</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{item.desc}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'border border-zinc-300 dark:border-zinc-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 4: BUILD YOUR WARDROBE */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Step 4
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-1">
                  Build your wardrobe
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  Add initial pieces to jumpstart your daily outfit recommendations.
                </p>
              </div>

              {/* Uploaded Items List */}
              <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Your Initial Capsule ({uploadedItems.length} pieces)
                  </span>
                  <span className="text-xs text-zinc-900 dark:text-zinc-100 font-semibold">Ready</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {uploadedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-zinc-800 p-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 shadow-sm"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full aspect-square rounded-md object-cover"
                      />
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1.5 truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.category}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Add presets */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
                  + Quick Add Capsule Staples
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleQuickAddWardrobe(
                        'Poplin Button-Down Shirt',
                        'Tops',
                        'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=500&q=80'
                      )
                    }
                  >
                    + White Poplin Shirt
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleQuickAddWardrobe(
                        'Heritage Trench Coat',
                        'Outerwear',
                        'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=500&q=80'
                      )
                    }
                  >
                    + Beige Trench Coat
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleQuickAddWardrobe(
                        'Classic White Sneakers',
                        'Shoes',
                        'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=500&q=80'
                      )
                    }
                  >
                    + Leather Sneakers
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="max-w-3xl mx-auto w-full flex items-center justify-between pt-6 border-t border-zinc-200 dark:border-zinc-800">
        {step > 1 ? (
          <Button
            variant="outline"
            size="md"
            onClick={() => setStep((s) => s - 1)}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <Button
            variant="primary"
            size="md"
            onClick={() => setStep((s) => s + 1)}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Continue
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={handleFinish}
            icon={<Sparkles className="w-4 h-4" />}
            className="px-6"
          >
            Create My Style Profile
          </Button>
        )}
      </div>
    </div>
  );
};
