import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Menu,
  X,
  Shirt,
  Compass,
  CheckCircle2,
  Calendar,
  CloudSun,
  ShieldCheck,
  Layers,
  ChevronRight,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const occasionCards = [
    {
      title: 'Executive & Office',
      subtitle: 'Boardroom Polish',
      formality: 'High Formality · 0.75',
      image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85',
      description: 'Structured silhouettes, restrained palettes, and tailored balance designed for leadership and presence.',
      tag: 'Office · Presentation',
    },
    {
      title: 'Casual Outing',
      subtitle: 'Effortless Ease',
      formality: 'Balanced Formality · 0.40',
      image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85',
      description: 'Relaxed trousers, artisanal knitwear, and thoughtful layers made for cafe catch-ups and gallery strolls.',
      tag: 'Daytime · Weekend',
    },
    {
      title: 'Global Travel',
      subtitle: 'Transit & Motion',
      formality: 'Versatile Comfort · 0.35',
      image: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=800&q=85',
      description: 'Wrinkle-resilient textiles, modular temperature layering, and comfortable closed footwear ready for any timezone.',
      tag: 'Airport · Exploration',
    },
    {
      title: 'Ceremonial & Wedding',
      subtitle: 'Heritage Elegance',
      formality: 'Celebratory · 0.90',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=85',
      description: 'Rich handlooms, regal sherwanis, and handcrafted sarees honoring deep ceremonial heritage.',
      tag: 'Weddings · Festivals',
    },
    {
      title: 'Evening Gala & Party',
      subtitle: 'Nocturne Glamour',
      formality: 'Elevated Drama · 0.85',
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85',
      description: 'Architectural cuts, deep jewel tones, and statement outerwear curated for nightfall celebrations.',
      tag: 'Cocktail · Gala',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F3EEE8] dark:bg-[#1A151C] text-[#29202B] dark:text-[#F3EEE8] font-sans transition-colors duration-200">
      {/* ------------------------------------------------------------- */}
      {/* MINIMAL HORIZONTAL NAVIGATION BAR                            */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 bg-[#F3EEE8]/90 dark:bg-[#1A151C]/90 backdrop-blur-md border-b border-[#DCD4CC] dark:border-[#392F3E]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Left Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-8 text-[11px] font-sans font-medium uppercase tracking-[0.2em] text-[#6D7068] dark:text-[#A89E9B]">
            <a href="#wardrobe" className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors">
              Wardrobe
            </a>
            <a href="#features" className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors">
              How It Works
            </a>
          </nav>

          {/* Centered Serif Branding (Desktop) */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <div className="w-8 h-8 rounded-[2px] bg-[#29202B] dark:bg-[#F3EEE8] flex items-center justify-center text-[#FFFFFF] dark:text-[#29202B] font-serif font-bold text-base transition-transform group-hover:scale-105 shadow-xs">
              T
            </div>
            <span className="text-2xl font-serif font-bold tracking-tight text-[#29202B] dark:text-[#F3EEE8]">
              TailorBird
            </span>
          </div>

          {/* Right Navigation & Auth Actions */}
          <div className="hidden lg:flex items-center gap-8">
            <nav className="flex items-center gap-8 text-[11px] font-sans font-medium uppercase tracking-[0.2em] text-[#6D7068] dark:text-[#A89E9B]">
              <a href="#our-story" className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors">
                Our Story
              </a>
              <a href="#contact" className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors">
                Contact
              </a>
            </nav>

            <div className="h-4 w-[1px] bg-[#DCD4CC] dark:bg-[#392F3E]" />

            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <button
                  onClick={() => navigate('/home')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[2px] bg-[#29202B] dark:bg-[#F3EEE8] text-[#FFFFFF] dark:text-[#29202B] text-xs font-sans font-semibold uppercase tracking-[0.16em] hover:bg-[#743C49] dark:hover:bg-[#FFFFFF] transition-colors cursor-pointer shadow-xs"
                >
                  <span>Enter Atelier</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-xs font-sans font-semibold uppercase tracking-[0.16em] text-[#29202B] dark:text-[#F3EEE8] hover:text-[#743C49] dark:hover:text-[#D5A6A0] transition-colors px-2 py-1 cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="inline-flex items-center px-5 py-2.5 rounded-[2px] border border-[#29202B] dark:border-[#F3EEE8] text-[#29202B] dark:text-[#F3EEE8] text-xs font-sans font-semibold uppercase tracking-[0.16em] hover:bg-[#29202B] hover:text-[#FFFFFF] dark:hover:bg-[#F3EEE8] dark:hover:text-[#29202B] transition-all cursor-pointer shadow-xs"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-[2px] text-[#29202B] dark:text-[#F3EEE8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#FFFFFF] dark:bg-[#1A151C] border-b border-[#DCD4CC] dark:border-[#392F3E] px-6 py-6 space-y-6 shadow-xl animate-in slide-in-from-top-2">
            <nav className="flex flex-col space-y-4 text-xs font-sans font-semibold uppercase tracking-[0.2em] text-[#6D7068] dark:text-[#A89E9B]">
              <a
                href="#wardrobe"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors py-1"
              >
                Wardrobe
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors py-1"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors py-1"
              >
                How It Works
              </a>
              <a
                href="#our-story"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors py-1"
              >
                Our Story
              </a>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors py-1"
              >
                Contact
              </a>
            </nav>

            <div className="pt-4 border-t border-[#DCD4CC] dark:border-[#392F3E] flex flex-col gap-3">
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/home');
                  }}
                  className="w-full uppercase tracking-[0.16em] text-xs"
                >
                  Enter Atelier
                </Button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/login');
                    }}
                    className="w-full py-2.5 rounded-[2px] text-center text-xs font-sans font-semibold uppercase tracking-[0.16em] text-[#29202B] dark:text-[#F3EEE8] border border-[#DCD4CC] dark:border-[#392F3E]"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/signup');
                    }}
                    className="w-full py-2.5 rounded-[2px] text-center text-xs font-sans font-semibold uppercase tracking-[0.16em] bg-[#29202B] text-white dark:bg-[#F3EEE8] dark:text-[#29202B]"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 1 — HERO SECTION (NUVE_studio Style)                 */}
      {/* ------------------------------------------------------------- */}
      <section className="relative max-w-7xl mx-auto px-6 pt-16 sm:pt-24 lg:pt-32 pb-24 sm:pb-36 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Asymmetric Left Column: Typography & CTAs */}
          <div className="lg:col-span-7 space-y-8 lg:pr-6">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-[2px] bg-white dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#743C49] animate-pulse" />
              <span className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-[#743C49] dark:text-[#D5A6A0]">
                Volume 01 · TailorBird Editorial
              </span>
            </div>

            {/* Cormorant Garamond Oversized High-Contrast Headline */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl xl:text-[84px] font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight leading-[1.02]">
              <span className="block font-medium">Your Wardrobe.</span>
              <span className="block italic font-normal text-[#743C49] dark:text-[#D5A6A0] my-1">
                Your Style.
              </span>
              <span className="block font-medium">Elevated.</span>
            </h1>

            {/* Supporting Editorial Paragraph */}
            <p className="text-base sm:text-lg text-[#6D7068] dark:text-[#A89E9B] max-w-xl font-normal leading-relaxed font-sans">
              Discover your personal style, organize what you own, and find the right outfit for every occasion with your AI-powered wardrobe companion.
            </p>

            {/* Dual Thin Outlined & Filled CTA Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                onClick={() => navigate(isAuthenticated ? '/daily-fit' : '/signup')}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-[2px] bg-[#29202B] dark:bg-[#F3EEE8] text-[#FFFFFF] dark:text-[#29202B] text-xs font-sans font-semibold uppercase tracking-[0.18em] hover:bg-[#743C49] dark:hover:bg-[#FFFFFF] transition-all duration-200 shadow-sm cursor-pointer group"
              >
                <span>Explore Your Style</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => navigate(isAuthenticated ? '/wardrobe' : '/signup')}
                className="inline-flex items-center justify-center px-8 py-4 rounded-[2px] border border-[#29202B] dark:border-[#F3EEE8] text-[#29202B] dark:text-[#F3EEE8] text-xs font-sans font-semibold uppercase tracking-[0.18em] hover:bg-[#29202B] hover:text-[#FFFFFF] dark:hover:bg-[#F3EEE8] dark:hover:text-[#29202B] transition-all duration-200 cursor-pointer shadow-2xs"
              >
                Create Your Wardrobe
              </button>
            </div>

            {/* Editorial Metadata Badges */}
            <div className="pt-8 border-t border-[#DCD4CC] dark:border-[#392F3E] grid grid-cols-3 gap-6">
              <div>
                <p className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8]">100%</p>
                <p className="text-[10px] font-sans uppercase tracking-[0.16em] text-[#6D7068] dark:text-[#A89E9B] mt-0.5">
                  Real Physical Wardrobe
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-serif text-[#743C49] dark:text-[#D5A6A0]">CIELAB</p>
                <p className="text-[10px] font-sans uppercase tracking-[0.16em] text-[#6D7068] dark:text-[#A89E9B] mt-0.5">
                  Color Harmony Calibration
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8]">24h</p>
                <p className="text-[10px] font-sans uppercase tracking-[0.16em] text-[#6D7068] dark:text-[#A89E9B] mt-0.5">
                  Style Moments Life
                </p>
              </div>
            </div>
          </div>

          {/* Asymmetric Right Column: Editorial Photography Composition */}
          <div className="lg:col-span-5 relative mt-6 lg:mt-0">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Primary Large Editorial Photograph */}
              <div className="relative rounded-[2px] overflow-hidden border border-[#DCD4CC] dark:border-[#392F3E] shadow-xl aspect-[3/4] bg-[#29202B]">
                <img
                  src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=85"
                  alt="TailorBird luxury styling editorial"
                  className="w-full h-full object-cover object-top filter grayscale-[15%] contrast-[1.05]"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 text-white space-y-1">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-[#D5A6A0] block">
                    Curated Ensemble · Capsule 04
                  </span>
                  <p className="text-2xl font-serif font-medium text-[#F3EEE8]">
                    Double-Breasted Wool & Silk Knit
                  </p>
                  <p className="text-xs font-sans text-white/70">Formality Index 0.82 · Climate Calibrated</p>
                </div>
              </div>

              {/* Offset Overlapping Miniature Frame */}
              <div className="hidden sm:block absolute -bottom-10 -left-10 w-48 rounded-[2px] overflow-hidden border border-[#DCD4CC] dark:border-[#392F3E] shadow-2xl aspect-[4/5] bg-white dark:bg-[#241D27]">
                <img
                  src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=85"
                  alt="Neutral wardrobe essentials"
                  className="w-full h-full object-cover filter grayscale-[10%]"
                />
              </div>

              {/* Floating Affinity Indicator Tag */}
              <div className="absolute -top-4 -right-4 sm:-right-6 bg-white dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[2px] bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0] flex items-center justify-center font-mono font-bold text-xs border border-[#743C49]/30">
                    96%
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#29202B] dark:text-[#F3EEE8]">Harmony Metric</p>
                    <p className="text-[11px] text-[#6D7068] dark:text-[#A89E9B]">Microclimate Sync</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 2 — THE IDEA                                         */}
      {/* ------------------------------------------------------------- */}
      <section id="how-it-works" className="border-t border-[#DCD4CC] dark:border-[#392F3E] bg-[#FFFFFF] dark:bg-[#201824] py-24 sm:py-32 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-5 space-y-6">
              <span className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-[#743C49] dark:text-[#D5A6A0] block">
                The Philosophy
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight leading-tight">
                Style begins with what you{' '}
                <span className="italic font-normal text-[#743C49] dark:text-[#D5A6A0]">already own.</span>
              </h2>
              <p className="text-base text-[#6D7068] dark:text-[#A89E9B] leading-relaxed font-sans">
                Most closets are filled with garments that are rarely worn. TailorBird shifts your relationship with fashion from endless consumption to thoughtful curation.
              </p>
              <p className="text-sm text-[#6D7068] dark:text-[#A89E9B] leading-relaxed font-sans">
                By cataloging your physical clothes, our neural styling engine unlocks unexpected combinations, tracks cost-per-wear transparency, and helps you make confident, stress-free outfit decisions every single morning.
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-8 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-3">
                <span className="text-3xl font-serif font-bold text-[#743C49] dark:text-[#D5A6A0]">80 / 20</span>
                <h3 className="text-lg font-serif font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                  Eliminate Wardrobe Blindspots
                </h3>
                <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] leading-relaxed font-sans">
                  The average person wears only 20% of their wardrobe 80% of the time. TailorBird activates your remaining 80% with automated rotation and occasion mapping.
                </p>
              </div>

              <div className="p-8 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-3">
                <span className="text-3xl font-serif font-bold text-[#29202B] dark:text-[#F3EEE8]">Zero</span>
                <h3 className="text-lg font-serif font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                  Decision Fatigue
                </h3>
                <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] leading-relaxed font-sans">
                  Stop staring into a full closet wondering what to wear. Wake up to tailored looks calibrated for your daily meetings and local temperature.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 3 — DIGITAL WARDROBE                                 */}
      {/* ------------------------------------------------------------- */}
      <section id="wardrobe" className="border-t border-[#DCD4CC] dark:border-[#392F3E] bg-[#F3EEE8] dark:bg-[#1A151C] py-24 sm:py-32 transition-colors">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="max-w-2xl space-y-3">
            <span className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-[#743C49] dark:text-[#D5A6A0] block">
              Digital Archiving
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight">
              Everything you own.{' '}
              <span className="italic font-normal text-[#743C49] dark:text-[#D5A6A0]">
                Beautifully organized.
              </span>
            </h2>
            <p className="text-sm sm:text-base text-[#6D7068] dark:text-[#A89E9B] font-sans leading-relaxed">
              Upload photos of your garments. TailorBird segments each piece, analyzes colors and silhouettes, and builds your private digital atelier.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] overflow-hidden group shadow-xs">
              <div className="aspect-[4/5] overflow-hidden bg-[#FAF6F0] dark:bg-[#1A151C]">
                <img
                  src="https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=85"
                  alt="Outerwear analysis"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-6 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#743C49] dark:text-[#D5A6A0]">
                  Neural Vision Scan
                </span>
                <h3 className="font-serif text-xl font-bold text-[#29202B] dark:text-[#F3EEE8]">
                  Automated Attribute Extraction
                </h3>
                <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] font-sans leading-relaxed">
                  Identifies garment type, sleeve cut, neckline, primary color in CIELAB, pattern, and formality rating without tedious manual tagging.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] overflow-hidden group shadow-xs">
              <div className="aspect-[4/5] overflow-hidden bg-[#FAF6F0] dark:bg-[#1A151C]">
                <img
                  src="https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=800&q=85"
                  alt="Capsule organization"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-6 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#743C49] dark:text-[#D5A6A0]">
                  Capsule Grouping
                </span>
                <h3 className="font-serif text-xl font-bold text-[#29202B] dark:text-[#F3EEE8]">
                  Occasion Vault & Tier Separation
                </h3>
                <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] font-sans leading-relaxed">
                  Protect special silks, evening tuxedos, and wedding heirlooms in the Occasion Vault so everyday algorithms preserve them for the right moment.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] overflow-hidden group shadow-xs">
              <div className="aspect-[4/5] overflow-hidden bg-[#FAF6F0] dark:bg-[#1A151C]">
                <img
                  src="https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=85"
                  alt="Footwear and leather care"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-6 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#743C49] dark:text-[#D5A6A0]">
                  Cost-Per-Wear Tracking
                </span>
                <h3 className="font-serif text-xl font-bold text-[#29202B] dark:text-[#F3EEE8]">
                  Garment Mileage & Laundry Tracking
                </h3>
                <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] font-sans leading-relaxed">
                  Log wears seamlessly. Track investment value, dry-cleaning cycles, and discover the true workhorses of your personal wardrobe.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 4 — AI PERSONAL STYLING                              */}
      {/* ------------------------------------------------------------- */}
      <section id="features" className="border-t border-[#DCD4CC] dark:border-[#392F3E] bg-[#FFFFFF] dark:bg-[#201824] py-24 sm:py-32 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-6 space-y-8">
              <div className="space-y-3">
                <span className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-[#743C49] dark:text-[#D5A6A0] block">
                  Intelligent Daily Curation
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight leading-tight">
                  Meet your everyday{' '}
                  <span className="italic font-normal text-[#743C49] dark:text-[#D5A6A0]">
                    styling companion.
                  </span>
                </h2>
                <p className="text-base text-[#6D7068] dark:text-[#A89E9B] font-sans leading-relaxed">
                  TailorBird generates coherent outfits from what you actually own — balancing color theory, weather physics, and personal style rules.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-full bg-[#743C49]/10 text-[#743C49] dark:text-[#D5A6A0] flex items-center justify-center text-xs mt-0.5">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                      Microclimate Synchronization
                    </h4>
                    <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] mt-0.5 font-sans">
                      Automatically accounts for real-time temperature, wind, and rain probability so you stay comfortable throughout the day.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-full bg-[#743C49]/10 text-[#743C49] dark:text-[#D5A6A0] flex items-center justify-center text-xs mt-0.5">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                      Occasion Formality Calibration
                    </h4>
                    <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] mt-0.5 font-sans">
                      Aligns garment formality with your agenda. A boardroom pitch requires tailored precision; Sunday brunch invites casual ease.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-full bg-[#743C49]/10 text-[#743C49] dark:text-[#D5A6A0] flex items-center justify-center text-xs mt-0.5">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                      Repetition Guard & Rotation
                    </h4>
                    <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] mt-0.5 font-sans">
                      Penalizes items worn yesterday and ensures varied weekly dressing without unnecessary repeats.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] p-8 shadow-sm">
              <div className="border-b border-[#DCD4CC] dark:border-[#392F3E] pb-4 mb-6 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#743C49] dark:text-[#D5A6A0]">
                    Daily Fit Analysis
                  </span>
                  <p className="font-serif text-lg text-[#29202B] dark:text-[#F3EEE8]">
                    Smart Casual Ensemble
                  </p>
                </div>
                <span className="px-3 py-1 bg-[#29202B] dark:bg-[#F3EEE8] text-white dark:text-[#29202B] font-mono text-xs rounded-[2px]">
                  Score 94/100
                </span>
              </div>

              <div className="space-y-4">
                <div className="p-3.5 bg-white dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] flex items-center justify-between text-xs">
                  <span className="text-[#6D7068] dark:text-[#A89E9B]">Color Harmony</span>
                  <span className="font-mono font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                    Complementary Navy & Camel (0.92)
                  </span>
                </div>
                <div className="p-3.5 bg-white dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] flex items-center justify-between text-xs">
                  <span className="text-[#6D7068] dark:text-[#A89E9B]">Thermal Alignment</span>
                  <span className="font-mono font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                    Optimal for 18°C (Linen blend)
                  </span>
                </div>
                <div className="p-3.5 bg-white dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] flex items-center justify-between text-xs">
                  <span className="text-[#6D7068] dark:text-[#A89E9B]">Agenda Suitability</span>
                  <span className="font-mono font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                    Office Workday · Hybrid
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 5 — EVERY OCCASION                                   */}
      {/* ------------------------------------------------------------- */}
      <section className="border-t border-[#DCD4CC] dark:border-[#392F3E] bg-[#F3EEE8] dark:bg-[#1A151C] py-24 sm:py-32 transition-colors">
        <div className="max-w-7xl mx-auto px-6 space-y-14">
          <div className="max-w-2xl space-y-3">
            <span className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-[#743C49] dark:text-[#D5A6A0] block">
              Occasion Intelligence
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight">
              An outfit for{' '}
              <span className="italic font-normal text-[#743C49] dark:text-[#D5A6A0]">
                every moment.
              </span>
            </h2>
            <p className="text-sm sm:text-base text-[#6D7068] dark:text-[#A89E9B] font-sans leading-relaxed">
              From executive boardroom meetings to ceremonial Indian weddings, TailorBird applies strict occasion boundary rules to recommend appropriately calibrated ensembles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {occasionCards.map((card, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] overflow-hidden group hover:border-[#743C49] dark:hover:border-[#D5A6A0] transition-all shadow-xs"
              >
                <div className="aspect-[4/5] overflow-hidden bg-[#29202B] relative">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded-[1px] uppercase tracking-wider">
                    {card.tag}
                  </div>
                </div>
                <div className="p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-bold text-[#29202B] dark:text-[#F3EEE8]">
                      {card.title}
                    </h3>
                    <span className="text-[10px] font-mono text-[#743C49] dark:text-[#D5A6A0] font-semibold">
                      {card.subtitle}
                    </span>
                  </div>
                  <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] font-sans leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 6 — SMARTER SHOPPING                                 */}
      {/* ------------------------------------------------------------- */}
      <section className="border-t border-[#DCD4CC] dark:border-[#392F3E] bg-[#FFFFFF] dark:bg-[#201824] py-24 sm:py-32 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-[#743C49] dark:text-[#D5A6A0] block">
                Wardrobe Gap Intelligence
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight leading-tight">
                Buy with intention.{' '}
                <span className="italic font-normal text-[#743C49] dark:text-[#D5A6A0]">
                  Wear with confidence.
                </span>
              </h2>
              <p className="text-base text-[#6D7068] dark:text-[#A89E9B] font-sans leading-relaxed">
                Before purchasing another impulse item, TailorBird evaluates how prospective pieces integrate with your current physical inventory.
              </p>
              <div className="space-y-3 pt-2">
                <div className="p-4 bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                      Wardrobe Gap Analysis
                    </h4>
                    <p className="text-[11px] text-[#6D7068] dark:text-[#A89E9B] mt-0.5 font-sans">
                      Identifies missing foundation garments that multiply your existing outfit combinations.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                </div>
                <div className="p-4 bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                      Before You Buy Test
                    </h4>
                    <p className="text-[11px] text-[#6D7068] dark:text-[#A89E9B] mt-0.5 font-sans">
                      Simulates pairings with at least three garments you already own before you spend.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 relative">
              <div className="rounded-[2px] overflow-hidden border border-[#DCD4CC] dark:border-[#392F3E] shadow-xl aspect-[16/10] bg-[#FAF6F0] dark:bg-[#1A151C]">
                <img
                  src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=85"
                  alt="Intentional wardrobe curation"
                  className="w-full h-full object-cover filter contrast-[1.03]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 7 — FINAL EDITORIAL CTA                              */}
      {/* ------------------------------------------------------------- */}
      <section id="our-story" className="border-t border-[#DCD4CC] dark:border-[#392F3E] bg-[#F3EEE8] dark:bg-[#1A151C] py-28 sm:py-36 text-center transition-colors">
        <div className="max-w-4xl mx-auto px-6 space-y-8">
          <span className="text-[10px] font-sans font-bold uppercase tracking-[0.24em] text-[#743C49] dark:text-[#D5A6A0] block">
            Private Atelier Invitation
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight leading-[1.08]">
            Your wardrobe deserves a{' '}
            <span className="italic font-normal text-[#743C49] dark:text-[#D5A6A0]">
              smarter beginning.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-[#6D7068] dark:text-[#A89E9B] max-w-xl mx-auto leading-relaxed font-sans">
            Step into intentional style. Transform the clothes you own into an organized, responsive daily styling experience.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate(isAuthenticated ? '/home' : '/signup')}
              className="inline-flex items-center justify-center gap-3 px-10 py-4 rounded-[2px] bg-[#29202B] dark:bg-[#F3EEE8] text-[#FFFFFF] dark:text-[#29202B] text-xs font-sans font-semibold uppercase tracking-[0.18em] hover:bg-[#743C49] dark:hover:bg-[#FFFFFF] transition-all duration-200 shadow-md cursor-pointer group"
            >
              <span>Start Your Style Journey</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            {!isAuthenticated && (
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center justify-center px-10 py-4 rounded-[2px] border border-[#29202B] dark:border-[#F3EEE8] text-[#29202B] dark:text-[#F3EEE8] text-xs font-sans font-semibold uppercase tracking-[0.18em] hover:bg-[#29202B] hover:text-white dark:hover:bg-[#F3EEE8] dark:hover:text-[#29202B] transition-all duration-200 cursor-pointer shadow-2xs"
              >
                Sign In to Account
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* EDITORIAL FOOTER                                             */}
      {/* ------------------------------------------------------------- */}
      <footer id="contact" className="border-t border-[#DCD4CC] dark:border-[#392F3E] py-14 bg-[#FFFFFF] dark:bg-[#1A151C] text-xs text-[#6D7068] dark:text-[#A89E9B] transition-colors">
        <div className="max-w-7xl mx-auto px-6 space-y-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-[#DCD4CC] dark:border-[#392F3E]">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-[2px] bg-[#29202B] dark:bg-[#F3EEE8] text-[#FFFFFF] dark:text-[#29202B] flex items-center justify-center font-serif font-bold text-sm">
                T
              </div>
              <span className="text-xl font-serif font-bold tracking-tight text-[#29202B] dark:text-[#F3EEE8]">
                TailorBird
              </span>
            </div>
            <p className="text-xs font-sans text-[#6D7068] dark:text-[#A89E9B] max-w-md">
              The personal AI wardrobe curator that elevates what you already own. Designed with editorial precision.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-sans">
            <span>&copy; {new Date().getFullYear()} TailorBird Atelier Inc. All rights reserved.</span>
            <div className="flex items-center gap-6 uppercase tracking-[0.14em]">
              <span className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] cursor-pointer">Terms of Service</span>
              <span className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] cursor-pointer">Privacy Policy</span>
              <span className="hover:text-[#29202B] dark:hover:text-[#F3EEE8] cursor-pointer">Atelier Governance</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
