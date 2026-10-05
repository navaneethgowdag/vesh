import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  Shirt,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '../components/ui/Button';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { StyleVibe, ClothingItem } from '../types';

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
    // Persist the style profile into Neon via FastAPI, then mirror it into
    // local context state so the UI reflects what was just saved.
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
      colors: ['#A8764B', '#1C1B1A', '#FAF7F2', '#DFCDB8'],
    });

    showToast('Your AI Style Profile has been created! Welcome to StyleSphere.', 'success');
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col justify-between py-8 px-4 sm:px-6">
      {/* Top Header */}
      <div className="max-w-3xl mx-auto w-full flex items-center justify-between pb-6 border-b border-sand-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-charcoal-900 flex items-center justify-center text-cream-50 font-serif font-bold text-sm">
            S
          </div>
          <span className="font-serif text-lg font-bold text-charcoal-900">StyleSphere</span>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-8 bg-cognac-700'
                  : s < step
                  ? 'w-4 bg-charcoal-900'
                  : 'w-4 bg-sand-300'
              }`}
            />
          ))}
          <span className="text-xs font-semibold text-charcoal-500 ml-2">Step {step} of 4</span>
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
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-cognac-700">
                  Step 1
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-950 mt-1">
                  What is your style?
                </h2>
                <p className="text-sm text-charcoal-500 mt-1">
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
                      className={`group relative rounded-2xl overflow-hidden cursor-pointer border-2 transition-all p-3 flex flex-col justify-between aspect-square shadow-soft ${
                        isSelected
                          ? 'border-cognac-700 bg-cognac-50/60 ring-2 ring-cognac-500/20'
                          : 'border-sand-200 bg-cream-50 hover:border-sand-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-bold text-sm text-charcoal-900">
                          {style.label}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-cognac-700 text-white' : 'border border-sand-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>

                      <div className="relative rounded-xl overflow-hidden aspect-[4/3] mt-2">
                        <img
                          src={style.img}
                          alt={style.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
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
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-cognac-700">
                  Step 2
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-950 mt-1">
                  What do you usually wear?
                </h2>
                <p className="text-sm text-charcoal-500 mt-1">
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
                      className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-charcoal-900 bg-charcoal-900 text-cream-50 shadow-soft'
                          : 'border-sand-200 bg-cream-50 text-charcoal-800 hover:bg-sand-100'
                      }`}
                    >
                      <span className="font-medium text-sm">{item}</span>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                          isSelected ? 'bg-cream-50 text-charcoal-900' : 'border border-sand-300'
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
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-cognac-700">
                  Step 3
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-950 mt-1">
                  What's your typical lifestyle?
                </h2>
                <p className="text-sm text-charcoal-500 mt-1">
                  This fine-tunes whether our AI recommends boardroom tailoring or weekend comfort.
                </p>
              </div>

              <div className="space-y-3">
                {LIFESTYLE_OPTIONS.map((item) => {
                  const isSelected = lifestyle === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setLifestyle(item.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-cognac-700 bg-cognac-50/80 ring-2 ring-cognac-500/20 shadow-soft'
                          : 'border-sand-200 bg-cream-50 hover:bg-sand-100'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-sm text-charcoal-900">{item.title}</p>
                        <p className="text-xs text-charcoal-500 mt-0.5">{item.desc}</p>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-cognac-700 text-white' : 'border border-sand-300'
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
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-cognac-700">
                  Step 4
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-950 mt-1">
                  Build your wardrobe
                </h2>
                <p className="text-sm text-charcoal-500 mt-1">
                  Add initial pieces to jumpstart your daily AI recommendations.
                </p>
              </div>

              {/* Uploaded Items List */}
              <div className="p-4 bg-sand-100/70 rounded-3xl border border-sand-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-charcoal-600">
                    Your Initial Capsule ({uploadedItems.length} pieces)
                  </span>
                  <span className="text-xs text-cognac-700 font-medium">Ready for Stylist</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {uploadedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-cream-50 p-2 rounded-2xl border border-sand-200 shadow-sm"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full aspect-square rounded-xl object-cover"
                      />
                      <p className="text-xs font-bold text-charcoal-900 mt-1.5 truncate">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-charcoal-500">{item.category}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Add presets */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-500 mb-2">
                  + One-Click Add Capsule Staples
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
      <div className="max-w-3xl mx-auto w-full flex items-center justify-between pt-6 border-t border-sand-200">
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
            icon={<Sparkles className="w-4 h-4 text-cream-100" />}
            className="px-7"
          >
            Create My Style Profile
          </Button>
        )}
      </div>
    </div>
  );
};

