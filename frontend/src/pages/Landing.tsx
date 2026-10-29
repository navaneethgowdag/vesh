import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Shirt,
  Compass,
  ArrowRight,
  CloudSun,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useApp();

  const editorialPillars = [
    {
      num: '01',
      title: 'Daily Fit Engine',
      subtitle: 'Context-Aware Curation',
      desc: 'Smart algorithms calibrate against your physical garments, microclimate humidity, and daily schedule so your outfit is always appropriate.',
      icon: CloudSun,
    },
    {
      num: '02',
      title: 'Digital Wardrobe',
      subtitle: 'Intelligent Garment Catalog',
      desc: 'Digitize your pieces with neural vision categorization. Track cost-per-wear, maximize versatility, and dress with intentional minimalism.',
      icon: Shirt,
    },
    {
      num: '03',
      title: 'Fashion Community',
      subtitle: 'Social Style Journal',
      desc: 'Share 24-hour outfit moments with accounts you follow, curate permanent lookbooks, and discover tastemakers across fashion capitals.',
      icon: Compass,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-zinc-100 dark:text-zinc-900 font-bold text-base shadow-sm">
              S
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                StyleSphere
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/home')}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Go to App
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => navigate('/login')}
                  className="hidden sm:inline-flex"
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/signup')}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-16 sm:pt-24 pb-20 sm:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Hero Text */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              <Sparkles className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
              <span>Wardrobe Intelligence 2.0</span>
            </div>

            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-[1.1]">
              The Art of Effortless Dressing, Intelligently Curated.
            </h1>

            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-xl font-normal leading-relaxed">
              StyleSphere translates your physical wardrobe into a living digital capsule. Calibrated for real-world weather, your calendar engagements, and aesthetic nuance.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/home')}
                  icon={<ArrowRight className="w-5 h-5" />}
                >
                  Open Your Wardrobe
                </Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/signup')}
                    icon={<ArrowRight className="w-5 h-5" />}
                  >
                    Start Your Wardrobe
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/login')}
                  >
                    Sign In
                  </Button>
                </>
              )}
            </div>

            <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                <span>Zero Fake Data</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                <span>Live Weather Sync</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                <span>End-to-End Privacy</span>
              </div>
            </div>
          </div>

          {/* Hero Editorial Imagery Composition */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Primary Main Look */}
              <div className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm aspect-[3/4] bg-zinc-900">
                <img
                  src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80"
                  alt="Styling composition"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-zinc-300 block mb-1">
                    Daily Recommendation
                  </span>
                  <p className="text-lg font-bold">Classic Trench & Tailored Linen</p>
                  <p className="text-xs text-zinc-300 mt-0.5">Milan · 16°C Clear</p>
                </div>
              </div>

              {/* Offset secondary tile */}
              <div className="hidden sm:block absolute -bottom-6 -left-6 w-44 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-md aspect-[4/5] bg-white dark:bg-zinc-800">
                <img
                  src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80"
                  alt="Minimal capsule garments"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Match Badge */}
              <div className="absolute top-6 -right-4 sm:-right-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3.5 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center font-bold text-xs border border-zinc-200 dark:border-zinc-700">
                    98%
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Thermal Compatibility</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Optimized for today's forecast</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-20 sm:py-28 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-14 space-y-2">
            <span className="text-xs tracking-wider uppercase font-bold text-zinc-500 dark:text-zinc-400 block">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl text-zinc-900 dark:text-zinc-100 font-bold tracking-tight">
              Three Disciplines, One Living Wardrobe.
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Designed for intentional curation, daily practicality, and creative expression.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {editorialPillars.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.num}
                  className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-md p-6 space-y-4 transition-all hover:border-zinc-400 dark:hover:border-zinc-600"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-zinc-400 dark:text-zinc-500">
                      {p.num}
                    </span>
                    <div className="w-10 h-10 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {p.title}
                    </h3>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
                      {p.subtitle}
                    </p>
                  </div>

                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Secondary CTA section */}
      <section className="py-20 sm:py-24 max-w-4xl mx-auto px-6 text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Curate with Clarity. Dress with Purpose.
        </h2>
        <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Create an account to begin building your intelligent digital wardrobe today.
        </p>

        <div className="pt-2 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/signup')}
            icon={<ArrowRight className="w-5 h-5" />}
          >
            Create Your Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 bg-white dark:bg-zinc-900 text-xs text-zinc-500 dark:text-zinc-400 transition-colors">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-xs">
              S
            </div>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              StyleSphere
            </span>
            <span className="text-[11px]">&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer">Terms</span>
            <span className="hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer">Privacy</span>
            <span className="hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer">Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
