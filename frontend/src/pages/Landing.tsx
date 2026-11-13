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
    <div className="min-h-screen bg-[#F3EEE8] dark:bg-[#1A151C] text-[#29202B] dark:text-[#F3EEE8] transition-colors duration-200">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/90 dark:bg-[#1A151C]/90 backdrop-blur-md border-b border-[#DCD4CC] dark:border-[#392F3E]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-[2px] bg-[#29202B] dark:bg-[#F3EEE8] flex items-center justify-center text-[#FFFFFF] dark:text-[#29202B] font-serif font-bold text-base shadow-xs">
              T
            </div>
            <div>
              <span className="text-xl font-serif font-bold tracking-tight text-[#29202B] dark:text-[#F3EEE8]">
                TailorBird
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-xs font-sans font-medium uppercase tracking-[0.16em] text-[#6D7068] dark:text-[#A89E9B]">
            <a href="#pillars" className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors">
              Pillars
            </a>
            <a href="#curation" className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors">
              Curation
            </a>
            <a href="#atelier" className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors">
              Atelier
            </a>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/home')}
                icon={<ArrowRight className="w-4 h-4" />}
                className="font-sans uppercase tracking-[0.12em] text-xs"
              >
                Enter Atelier
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => navigate('/login')}
                  className="hidden sm:inline-flex font-sans uppercase tracking-[0.12em] text-xs"
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/signup')}
                  className="font-sans uppercase tracking-[0.12em] text-xs"
                >
                  Join Atelier
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[2px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-[#743C49] dark:text-[#D5A6A0]">
              <Sparkles className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
              <span>Personal Wardrobe Intelligence</span>
            </div>

            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight leading-[1.08]">
              <span>The Art of Effortless Dressing,</span>{' '}
              <span className="italic font-serif font-normal text-[#743C49] dark:text-[#D5A6A0]">
                Intelligently Curated.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#6D7068] dark:text-[#A89E9B] max-w-xl font-normal leading-relaxed font-sans">
              TailorBird translates your physical wardrobe into a living digital capsule. Calibrated for real-world weather, your calendar engagements, and aesthetic nuance.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/home')}
                  icon={<ArrowRight className="w-5 h-5" />}
                  className="font-sans uppercase tracking-[0.14em] text-xs"
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
                    className="font-sans uppercase tracking-[0.14em] text-xs"
                  >
                    Start Your Wardrobe
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/login')}
                    className="font-sans uppercase tracking-[0.14em] text-xs"
                  >
                    Member Sign In
                  </Button>
                </>
              )}
            </div>

            <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#6D7068] dark:text-[#A89E9B] font-sans">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                <span className="font-medium text-[#29202B] dark:text-[#F3EEE8]">Zero Fabricated Data</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                <span className="font-medium text-[#29202B] dark:text-[#F3EEE8]">Live Weather Sync</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                <span className="font-medium text-[#29202B] dark:text-[#F3EEE8]">Private Capsule Vault</span>
              </div>
            </div>
          </div>

          {/* Hero Editorial Imagery Composition */}
          <div className="lg:col-span-5 relative" id="curation">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Primary Main Look */}
              <div className="relative rounded-[4px] overflow-hidden border border-[#DCD4CC] dark:border-[#392F3E] shadow-xl aspect-[3/4] bg-[#29202B]">
                <img
                  src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80"
                  alt="Styling composition"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <span className="text-[10px] tracking-[0.2em] uppercase font-sans font-semibold text-[#D5A6A0] block mb-1">
                    Editorial Daily Fit
                  </span>
                  <p className="text-xl font-serif text-[#F3EEE8]">Classic Trench & Tailored Linen</p>
                  <p className="text-xs text-white/80 mt-0.5 font-sans">Milan · 16°C Clear</p>
                </div>
              </div>

              {/* Offset secondary tile */}
              <div className="hidden sm:block absolute -bottom-6 -left-6 w-44 rounded-[4px] overflow-hidden border border-[#DCD4CC] dark:border-[#392F3E] shadow-2xl aspect-[4/5] bg-white dark:bg-[#241D27]">
                <img
                  src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80"
                  alt="Minimal capsule garments"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Match Badge */}
              <div className="absolute top-6 -right-4 sm:-right-6 bg-white dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] p-3.5 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[2px] bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0] flex items-center justify-center font-bold font-mono text-xs border border-[#743C49]/30">
                    98%
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#29202B] dark:text-[#F3EEE8]">Thermal Match</p>
                    <p className="text-[11px] text-[#6D7068] dark:text-[#A89E9B]">Optimized for climate</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section id="pillars" className="border-t border-[#DCD4CC] dark:border-[#392F3E] bg-[#FFFFFF] dark:bg-[#241D27] py-20 sm:py-28 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-14 space-y-2">
            <span className="text-[10px] uppercase tracking-[0.2em] font-sans font-semibold text-[#743C49] dark:text-[#D5A6A0] block">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl text-[#29202B] dark:text-[#F3EEE8] font-serif tracking-tight">
              <span>Three Disciplines,</span>{' '}
              <span className="italic font-serif font-normal text-[#743C49] dark:text-[#D5A6A0]">
                One Living Wardrobe.
              </span>
            </h2>
            <p className="text-sm text-[#6D7068] dark:text-[#A89E9B] font-sans">
              Designed for intentional curation, daily practicality, and creative expression.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {editorialPillars.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.num}
                  className="bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[4px] p-7 space-y-4 transition-all hover:border-[#743C49] dark:hover:border-[#D5A6A0] shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-serif font-normal text-[#743C49] dark:text-[#D5A6A0]">
                      {p.num}
                    </span>
                    <div className="w-10 h-10 rounded-[2px] bg-white dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center text-[#29202B] dark:text-[#F3EEE8] shadow-xs">
                      <Icon className="w-5 h-5 text-[#743C49] dark:text-[#D5A6A0]" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-serif font-bold text-[#29202B] dark:text-[#F3EEE8]">
                      {p.title}
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#6D7068] dark:text-[#A89E9B] font-sans font-semibold mt-1">
                      {p.subtitle}
                    </p>
                  </div>

                  <p className="text-sm text-[#6D7068] dark:text-[#A89E9B] leading-relaxed font-sans">
                    {p.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Secondary CTA section */}
      <section id="atelier" className="py-20 sm:py-24 max-w-4xl mx-auto px-6 text-center space-y-6">
        <span className="text-[10px] uppercase tracking-[0.2em] font-sans font-semibold text-[#743C49] dark:text-[#D5A6A0] block">
          Private Atelier Invitation
        </span>
        <h2 className="text-3xl sm:text-4xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight">
          <span>Curate with Clarity.</span>{' '}
          <span className="italic font-serif font-normal text-[#743C49] dark:text-[#D5A6A0]">
            Dress with Purpose.
          </span>
        </h2>
        <p className="text-sm sm:text-base text-[#6D7068] dark:text-[#A89E9B] max-w-lg mx-auto leading-relaxed font-sans">
          Create an account to begin building your intelligent digital wardrobe today.
        </p>

        <div className="pt-2 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/signup')}
            icon={<ArrowRight className="w-5 h-5" />}
            className="font-sans uppercase tracking-[0.14em] text-xs"
          >
            Create Your Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#DCD4CC] dark:border-[#392F3E] py-8 bg-[#FFFFFF] dark:bg-[#1A151C] text-xs text-[#6D7068] dark:text-[#A89E9B] transition-colors">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-[2px] bg-[#29202B] dark:bg-[#F3EEE8] text-[#FFFFFF] dark:text-[#29202B] flex items-center justify-center font-serif font-bold text-xs">
              T
            </div>
            <span className="font-serif font-semibold text-[#29202B] dark:text-[#F3EEE8]">
              TailorBird
            </span>
            <span className="text-[11px]">&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 font-sans text-xs">
            <span className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] cursor-pointer">Terms</span>
            <span className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] cursor-pointer">Privacy</span>
            <span className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] cursor-pointer">Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
