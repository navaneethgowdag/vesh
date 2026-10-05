import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Shirt,
  Compass,
  ArrowRight,
  CheckCircle,
  CloudSun,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Sparkles,
      title: 'AI Daily Fit Stylist',
      desc: 'Smart outfit algorithms calibrate for your local weather, calendar occasion, and aesthetic taste signature.',
    },
    {
      icon: Shirt,
      title: 'Digital Capsule Wardrobe',
      desc: 'Catalog your physical clothing into an organized digital collection with zero duplicate styling.',
    },
    {
      icon: Compass,
      title: 'Editorial Style Community',
      desc: 'Discover authentic outfits from creators worldwide, tag real garments, and curate collaborative moodboards.',
    },
    {
      icon: CloudSun,
      title: 'Context & Weather Engine',
      desc: 'Never freeze in linen or overheat in cashmere. Seamless thermal and humidity balancing for any city.',
    },
  ];

  return (
    <div className="min-h-screen bg-cream-100 text-charcoal-900 selection:bg-cognac-200">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-cream-100/90 backdrop-blur-md border-b border-sand-200/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-charcoal-900 flex items-center justify-center text-cream-50 font-serif font-bold text-xl shadow-soft group-hover:bg-cognac-700 transition-colors">
              S
            </div>
            <div>
              <span className="font-serif text-2xl font-bold tracking-tight text-charcoal-900">
                StyleSphere
              </span>
              <span className="block text-[9px] tracking-widest uppercase font-semibold text-cognac-600 -mt-1">
                AI Atelier
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="text-xs sm:text-sm font-semibold"
            >
              Sign In
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/signup')}
              className="text-xs sm:text-sm"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sand-200/80 border border-sand-300 text-cognac-800 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-cognac-600" />
              <span>Next-Gen AI Fashion Social Network</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-6xl xl:text-7xl font-bold tracking-tight text-charcoal-950 leading-[1.08]">
              Your style. <br />
              Your wardrobe. <br />
              <span className="text-cognac-700 italic font-serif">Your daily fit.</span>
            </h1>

            <p className="text-base sm:text-lg text-charcoal-600 max-w-xl leading-relaxed">
              Discover what to wear, build your digital wardrobe, and share your style with a
              community that inspires you.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/signup')}
                icon={<ArrowRight className="w-4 h-4" />}
                className="text-sm sm:text-base px-7 py-3.5"
              >
                Get Started
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/explore')}
                className="text-sm sm:text-base px-7 py-3.5"
              >
                Explore Styles
              </Button>
            </div>

            {/* Micro proof badges */}
            <div className="pt-6 border-t border-sand-200/90 flex flex-wrap items-center gap-6 text-xs text-charcoal-500">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-cognac-600" />
                <span>Zero guesswork daily dressing</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-cognac-600" />
                <span>Capsule wardrobe rotation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-cognac-600" />
                <span>Real weather calibration</span>
              </div>
            </div>
          </motion.div>

          {/* Right Fashion Visual Collage */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-5 relative"
          >
            <div className="relative mx-auto max-w-md">
              {/* Main Fashion Card */}
              <div className="relative rounded-3xl overflow-hidden shadow-soft-xl border border-sand-300 bg-cream-50 aspect-[3/4]">
                <img
                  src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80"
                  alt="StyleSphere editorial look"
                  className="w-full h-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-transparent to-transparent flex flex-col justify-end p-6">
                  <div className="inline-flex items-center gap-2 bg-cream-50/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-charcoal-900 mb-2 w-max shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-cognac-600" />
                    <span>98% Daily Fit Match</span>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-white">
                    SoHo Minimalist Tailoring
                  </h3>
                  <p className="text-xs text-cream-200 mt-0.5">
                    24°C Sunny · Linen, Poplin & Cognac Box Leather
                  </p>
                </div>
              </div>

              {/* Floating Overlay Card 1: Weather */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-4 -left-6 bg-cream-50/95 backdrop-blur-md p-3.5 rounded-2xl shadow-soft-lg border border-sand-200 hidden sm:flex items-center gap-3"
              >
                <div className="text-2xl">☀️</div>
                <div>
                  <p className="text-xs font-bold text-charcoal-900">24°C Clear</p>
                  <p className="text-[10px] text-charcoal-500">SoHo, New York</p>
                </div>
              </motion.div>

              {/* Floating Overlay Card 2: Wardrobe Tag */}
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-6 -right-4 bg-charcoal-900 text-cream-50 p-3.5 rounded-2xl shadow-soft-xl border border-charcoal-700 hidden sm:flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-cognac-700 flex items-center justify-center">
                  <Shirt className="w-4 h-4 text-cream-50" />
                </div>
                <div>
                  <p className="text-xs font-bold">Capsule Matched</p>
                  <p className="text-[10px] text-sand-300">4 items from your closet</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="py-20 bg-sand-50 border-y border-sand-200/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-cognac-700">
              The StyleSphere Ecosystem
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-950 mt-2">
              Where personal styling meets social inspiration
            </h2>
            <p className="text-sm sm:text-base text-charcoal-600 mt-3">
              No more morning decision paralysis. An intelligent digital wardrobe that knows your
              pieces, respects your aesthetic, and connects you with modern tastemakers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="bg-cream-50 p-7 rounded-3xl border border-sand-200/90 shadow-soft hover:shadow-soft-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-12 h-12 rounded-2xl bg-sand-100 border border-sand-200 flex items-center justify-center mb-5 text-cognac-700">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-charcoal-900 mb-2">
                    {f.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-charcoal-600 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Interactive Flow Preview Showcase */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-bold uppercase tracking-wider text-cognac-700">
              Personalized AI Stylist
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-950">
              Why settle for generic fashion advice when you can have an AI Atelier?
            </h2>
            <p className="text-sm text-charcoal-600 leading-relaxed">
              Every morning, StyleSphere looks at your digital wardrobe inventory, checks your local
              forecast, factors in your calendar occasion, and generates high-scoring outfit
              combinations with detailed reasoning.
            </p>

            <div className="space-y-3 pt-2">
              {[
                "✓ Analyzes current temperature, rain probability & humidity",
                "✓ Respects your personal aesthetic (Minimal, Smart Casual, Streetwear)",
                "✓ Balances capsule rotation so all your clothes get loved",
                "✓ Instant 'Try Another' alternative outfit variations",
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-charcoal-800">
                  <span className="text-cognac-600 font-bold">{item}</span>
                </div>
              ))}
            </div>

            <div className="pt-4">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/signup')}
              >
                Experience Your First Daily Fit
              </Button>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <img
                src="https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=700&q=80"
                alt="Studio outfit"
                className="rounded-3xl shadow-soft object-cover w-full aspect-[3/4]"
              />
              <div className="p-4 bg-sand-100 rounded-2xl border border-sand-200">
                <p className="font-serif font-bold text-xs text-charcoal-900">Workwear Chic</p>
                <p className="text-[11px] text-charcoal-500">95% match · Pleated sand trousers</p>
              </div>
            </div>

            <div className="space-y-4 pt-6">
              <div className="p-4 bg-charcoal-900 text-cream-50 rounded-2xl shadow-soft">
                <p className="text-xs uppercase font-bold text-cognac-300">Today's Fit</p>
                <p className="font-serif text-sm font-bold mt-1">24°C · Casual · Minimal</p>
                <p className="text-[11px] text-sand-300 mt-1">White Tee + Vintage Denim</p>
              </div>
              <img
                src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=700&q=80"
                alt="Autumn Trench"
                className="rounded-3xl shadow-soft object-cover w-full aspect-[3/4]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-20 bg-charcoal-900 text-cream-50">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-cognac-700 flex items-center justify-center mx-auto text-white shadow-soft">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight">
            Elevate your daily ritual with StyleSphere.
          </h2>
          <p className="text-sm sm:text-base text-sand-200 max-w-xl mx-auto">
            Join thousands of design lovers, capsule curators, and creators building their timeless
            wardrobes.
          </p>
          <div className="pt-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/signup')}
              className="bg-cream-50 text-charcoal-900 hover:bg-cognac-100 px-8 py-3.5"
            >
              Build Your Digital Wardrobe Now
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-cream-50 border-t border-sand-200/90 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-charcoal-500">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-charcoal-900 text-sm">StyleSphere</span>
            <span>— The AI Fashion Social Network</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/explore')} className="hover:underline">
              Explore
            </button>
            <button onClick={() => navigate('/login')} className="hover:underline">
              Sign In
            </button>
            <button onClick={() => navigate('/signup')} className="hover:underline">
              Register
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

