import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Sparkles,
  MapPin,
  Tag,
  Eye,
  Check,
  CheckCircle2,
  X,
  Plus,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useApp, useCurrentUser } from '../context/AppContext';
import { Occasion } from '../types';

const OCCASIONS: Occasion[] = [
  'Casual Daily',
  'Work & Office',
  'Date Night',
  'Weekend Outing',
  'Party & Evening',
  'Travel & Airport',
  'Formal Event',
];

const PRESET_OUTFIT_IMAGES = [
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1000&q=80',
];

export const CreatePost: React.FC = () => {
  const navigate = useNavigate();
  const { wardrobe, publishPost } = useApp();
  const currentUser = useCurrentUser();

  const [image, setImage] = useState(PRESET_OUTFIT_IMAGES[0]);
  const [caption, setCaption] = useState(
    'Crisp afternoon layering in the city. Structured tailoring paired with relaxed footwear.'
  );
  const [hashtags, setHashtags] = useState('#MinimalStyle #CapsuleWardrobe #AutumnTailoring');
  const [occasion, setOccasion] = useState<Occasion>('Casual Daily');
  const [location, setLocation] = useState('SoHo, New York');
  const [taggedItemIds, setTaggedItemIds] = useState<string[]>([
    wardrobe[0]?.id || '',
    wardrobe[1]?.id || '',
  ].filter(Boolean));
  const [showWardrobePicker, setShowWardrobePicker] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleTagItem = (id: string) => {
    setTaggedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !caption.trim()) return;

    setIsPublishing(true);
    setTimeout(() => {
      const parsedTags = hashtags
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => (t.startsWith('#') ? t : `#${t}`));

      publishPost({
        image,
        caption: caption.trim(),
        tags: parsedTags,
        occasion,
        location: location.trim() || undefined,
        taggedItemIds,
      });

      setIsPublishing(false);
      navigate('/home');
    }, 600);
  };

  const taggedItems = wardrobe.filter((i) => taggedItemIds.includes(i.id));

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
            Publish New Outfit Look
          </h1>
          <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
            Share your daily styling with the StyleSphere community and link your wardrobe pieces.
          </p>
        </div>

        <form onSubmit={handlePublish} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Image & Tagging */}
          <div className="lg:col-span-6 space-y-6">
            {/* Image Preview & Upload */}
            <div className="bg-cream-50 p-5 rounded-3xl border border-sand-200 shadow-soft">
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-3">
                Outfit Photography
              </label>

              <div className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-sand-200 border border-sand-300 shadow-inner group mb-4">
                <img
                  src={image}
                  alt="Post preview"
                  className="w-full h-full object-cover"
                />

                <div className="absolute inset-0 bg-charcoal-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <label className="cursor-pointer bg-cream-50 text-charcoal-900 px-4 py-2 rounded-full text-xs font-bold hover:bg-sand-100 shadow-soft">
                    Change Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Preset selection strip */}
              <div>
                <span className="text-[11px] font-semibold text-charcoal-500 block mb-2">
                  Or select sample editorial image:
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                  {PRESET_OUTFIT_IMAGES.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setImage(img)}
                      className={`w-12 h-12 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                        image === img ? 'border-cognac-700 ring-2 ring-cognac-300' : 'border-sand-300'
                      }`}
                    >
                      <img src={img} alt="Preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tagged Wardrobe Items Section */}
            <div className="bg-cream-50 p-5 rounded-3xl border border-sand-200 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-cognac-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-charcoal-700">
                    Tag Wardrobe Items ({taggedItemIds.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWardrobePicker(!showWardrobePicker)}
                  className="text-xs font-semibold text-cognac-700 hover:underline"
                >
                  {showWardrobePicker ? 'Done Tagging' : '+ Tag From Wardrobe'}
                </button>
              </div>

              {/* Tagged Items Pills */}
              <div className="flex flex-wrap gap-2 mb-3">
                {taggedItems.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 bg-sand-100 text-charcoal-800 text-xs px-2.5 py-1 rounded-full border border-sand-200"
                  >
                    <img src={item.image} alt={item.name} className="w-4 h-4 rounded-full object-cover" />
                    <span>{item.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleTagItem(item.id)}
                      className="hover:text-rose-600 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Wardrobe picker drawer */}
              {showWardrobePicker && (
                <div className="p-3 bg-sand-100 rounded-2xl border border-sand-200 max-h-52 overflow-y-auto space-y-1.5">
                  <p className="text-[11px] font-bold text-charcoal-600 mb-2">
                    Click items from your digital closet to tag:
                  </p>
                  {wardrobe.map((item) => {
                    const isTagged = taggedItemIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleTagItem(item.id)}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer text-xs transition-colors ${
                          isTagged
                            ? 'bg-cognac-100 border border-cognac-300 font-bold'
                            : 'bg-cream-50 hover:bg-sand-200/70 border border-sand-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={item.image} alt={item.name} className="w-8 h-8 rounded-lg object-cover" />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span>{isTagged ? '✓ Tagged' : '+ Add'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Metadata, Caption & Live Preview */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-cream-50 p-6 rounded-3xl border border-sand-200 shadow-soft space-y-4">
              {/* Caption */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                  Caption / Styling Thoughts *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Share the inspiration behind this look, styling advice, or garment fit notes..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl p-3.5 text-xs sm:text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-cognac-600 resize-none"
                />
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                  Hashtags
                </label>
                <input
                  type="text"
                  placeholder="#Minimal #QuietLuxury #Tailoring #DailyFit"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl px-3.5 py-2.5 text-xs text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-cognac-600"
                />
              </div>

              {/* Occasion & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                    Occasion
                  </label>
                  <select
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value as Occasion)}
                    className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl px-3 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
                  >
                    {OCCASIONS.map((occ) => (
                      <option key={occ} value={occ}>
                        {occ}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1.5">
                    Location
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. SoHo, New York"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-cream-100/60 border border-sand-300 rounded-2xl pl-9 pr-3 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
                    />
                    <MapPin className="w-3.5 h-3.5 text-charcoal-400 absolute left-3 top-2.5" />
                  </div>
                </div>
              </div>

              {/* Live Card Preview Box */}
              <div className="pt-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-charcoal-400 mb-2 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cognac-600" />
                  Feed Preview
                </span>
                <div className="p-3 bg-sand-100 rounded-2xl border border-sand-200 text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-charcoal-900">@{currentUser.username}</span>
                    <span className="text-[10px] text-charcoal-400">· Just now</span>
                    <span className="ml-auto text-[10px] bg-cream-50 px-2 py-0.5 rounded-full font-semibold">
                      {occasion}
                    </span>
                  </div>
                  <p className="text-charcoal-700 line-clamp-2">{caption}</p>
                  <p className="text-cognac-700 text-[11px] mt-1 font-medium">{hashtags}</p>
                </div>
              </div>

              {/* Publish Button */}
              <div className="pt-4 border-t border-sand-200">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isPublishing}
                  className="w-full font-serif"
                >
                  Publish Outfit to Feed
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
};

