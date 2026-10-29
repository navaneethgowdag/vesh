import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Shirt,
  Compass,
  ArrowRight,
  CloudSun,
  ShieldCheck,
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
      title: 'The Daily Atelier',
      subtitle: 'Context-Aware Curation',
      desc: 'Smart algorithms calibrate against your physical garments, microclimate humidity, and day calendar so you never freeze in linen or overheat in wool.',
      icon: CloudSun,
    },
    {
      num: '02',
      title: 'The Digital Capsule',
      subtitle: 'Intelligent Garment Catalog',
      desc: 'Digitize your pieces with neural vision categorization. Track cost-per-wear, maximize versatility, and dress with intentional minimalism.',
      icon: Shirt,
    },
    {
      num: '03',
      title: 'The Editorial Collective',
      subtitle: 'Social Style Journal',
      desc: 'Share 24-hour outfit moments with accounts you follow, curate permanent lookbooks, and discover tastemakers across fashion capitals.',
      icon: Compass,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F4EE] dark:bg-[#171715] text-[#25211E] dark:text-[#F4F0E8] selection:bg-[#C3A36B]/30 transition-colors duration-200">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#F7F4EE]/90 dark:bg-[#171715]/90 backdrop-blur-md border-b border-[#E5DED3] dark:border-[#393832] transition-colors">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#25211E] dark:bg-[#22221F] border border-[#C3A36B]/30 flex items-center justify-center text-[#F7F4EE] dark:text-[#F4F0E8] font-serif font-bold text-lg shadow-subtle group-hover:bg-[#C3A36B] transition-colors">
              S
            </div>
            <div>
              <span className="font-serif text-2xl font-bold tracking-tight text-[#25211E] dark:text-[#F4F0E8]">
                StyleSphere
              </span>
              <span className="block text-[9px] tracking-[0.2em] uppercase font-semibold text-[#C3A36B] dark:text-[#D1B47A] -mt-1 font-sans">
                AI Atelier
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/home')}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Enter Atelier
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                  className="hidden sm:inline-flex"
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/signup')}
                >
                  Join Atelier
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-16 sm:pt-24 pb-20 sm:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Hero Text */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EFE9DF] dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] text-xs font-medium text-[#82796F] dark:text-[#B2AA9E]">
              <Sparkles className="w-3.5 h-3.5 text-[#C3A36B] dark:text-[#D1B47A]" />
              <span className="tracking-wide">Autumn/Winter Atelier Engine 2.0</span>
            </div>

            <h1 className="font-serif text-5xl sm:text-6xl xl:text-7xl font-normal tracking-tight text-[#25211E] dark:text-[#F4F0E8] leading-[1.08]">
              The Art of Effortless Dressing,{' '}
              <span className="italic font-light text-[#C3A36B] dark:text-[#D1B47A]">
                Intelligently Curated.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#82796F] dark:text-[#B2AA9E] max-w-xl font-sans font-normal leading-relaxed">
              StyleSphere translates your physical wardrobe into a living digital capsule. Calibrated for real-world weather, your calendar engagements, and aesthetic nuance.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
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
                    Start Your Capsule
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/login')}
                  >
                    Sign In to Account
                  </Button>
                </>
              )}
            </div>

            <div className="pt-6 flex items-center gap-6 text-xs text-[#82796F] dark:text-[#B2AA9E]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#525744] dark:text-[#8C967E]" />
                <span>Zero Fake Data</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#525744] dark:text-[#8C967E]" />
                <span>Live Open-Meteo Sync</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#525744] dark:text-[#8C967E]" />
                <span>End-to-End Privacy</span>
              </div>
            </div>
          </div>

          {/* Hero Editorial Imagery Composition */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Primary Main Look */}
              <div className="relative rounded-2xl overflow-hidden border border-[#E5DED3] dark:border-[#393832] shadow-soft-lg aspect-[3/4] bg-[#22221F]">
                <img
                  src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80"
                  alt="Editorial styling composition"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[#D1B47A] block mb-1">
                    Editorial Curation
                  </span>
                  <p className="font-serif text-lg font-medium">Cashmere Trench & Structured Linen</p>
                  <p className="text-xs text-white/80 font-sans mt-0.5">Milan · 16°C Clear</p>
                </div>
              </div>

              {/* Offset secondary tile */}
              <div className="hidden sm:block absolute -bottom-8 -left-8 w-44 rounded-xl overflow-hidden border border-[#E5DED3] dark:border-[#393832] shadow-soft-xl aspect-[4/5] bg-white dark:bg-[#22221F]">
                <img
                  src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80"
                  alt="Minimal capsule garments"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Floating Match Badge */}
              <div className="absolute top-6 -right-4 sm:-right-6 bg-white/95 dark:bg-[#22221F]/95 backdrop-blur-md border border-[#E5DED3] dark:border-[#393832] rounded-2xl p-3.5 shadow-soft">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#C3A36B]/20 text-[#C3A36B] dark:text-[#D1B47A] flex items-center justify-center font-bold text-xs">
                    98%
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#25211E] dark:text-[#F4F0E8]">Thermal Compatibility</p>
                    <p className="text-[10px] text-[#82796F] dark:text-[#B2AA9E]">Optimized for today's forecast</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial Pillars */}
      <section className="border-t border-[#E5DED3] dark:border-[#393832] bg-[#FFFFFF] dark:bg-[#1E1E1B] py-20 sm:py-28 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-16 space-y-3">
            <span className="text-[11px] tracking-[0.2em] uppercase font-semibold text-[#C3A36B] dark:text-[#D1B47A] block font-sans">
              The Architecture of Style
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#25211E] dark:text-[#F4F0E8] font-normal tracking-tight">
              Three Disciplines, One Living Wardrobe.
            </h2>
            <p className="text-sm text-[#82796F] dark:text-[#B2AA9E] font-sans">
              Designed for those who view what they wear as a conscious, artistic expression.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {editorialPillars.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.num}
                  className="bg-[#F7F4EE] dark:bg-[#252522] border border-[#E5DED3] dark:border-[#393832] rounded-2xl p-8 space-y-5 transition-all hover:border-[#C3A36B]/60"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-2xl font-light text-[#C3A36B] dark:text-[#D1B47A]">
                      {p.num}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#2E2E2A] border border-[#E5DED3] dark:border-[#393832] flex items-center justify-center text-[#25211E] dark:text-[#F4F0E8]">
                      <Icon className="w-5 h-5 text-[#C3A36B] dark:text-[#D1B47A]" />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-serif text-xl font-medium text-[#25211E] dark:text-[#F4F0E8]">
                      {p.title}
                    </h3>
                    <p className="text-xs uppercase tracking-wider text-[#82796F] dark:text-[#B2AA9E] font-semibold mt-1">
                      {p.subtitle}
                    </p>
                  </div>

                  <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] leading-relaxed font-sans">
                    {p.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Secondary CTA section */}
      <section className="py-20 sm:py-28 max-w-5xl mx-auto px-6 text-center space-y-6">
        <span className="text-[11px] tracking-[0.2em] uppercase font-semibold text-[#C3A36B] dark:text-[#D1B47A] block font-sans">
          Join the Collective
        </span>
        <h2 className="font-serif text-4xl sm:text-5xl font-normal text-[#25211E] dark:text-[#F4F0E8] tracking-tight">
          Curate with Clarity. Dress with Purpose.
        </h2>
        <p className="text-sm sm:text-base text-[#82796F] dark:text-[#B2AA9E] max-w-xl mx-auto font-sans leading-relaxed">
          Create an account to begin building your intelligent capsule wardrobe today.
        </p>

        <div className="pt-4 flex justify-center">
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
      <footer className="border-t border-[#E5DED3] dark:border-[#393832] py-10 bg-[#FFFFFF] dark:bg-[#1A1A18] text-xs text-[#82796F] dark:text-[#B2AA9E] transition-colors">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-[#25211E] dark:bg-[#2A2A26] text-[#F7F4EE] flex items-center justify-center font-serif font-bold text-xs">
              S
            </div>
            <span className="font-serif font-semibold text-[#25211E] dark:text-[#F4F0E8]">
              StyleSphere
            </span>
            <span className="text-[10px] text-[#A39B90]">&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="hover:text-[#25211E] dark:hover:text-[#F4F0E8] cursor-pointer">Terms of Service</span>
            <span className="hover:text-[#25211E] dark:hover:text-[#F4F0E8] cursor-pointer">Privacy Policy</span>
            <span className="hover:text-[#25211E] dark:hover:text-[#F4F0E8] cursor-pointer">Editorial Manifesto</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
