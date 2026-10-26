import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Upload,
  Camera,
  Sparkles,
  Clock,
  MapPin,
  Tag,
  Eye,
  Check,
  CheckCircle2,
  X,
  Plus,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
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

export const CreatePost: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { wardrobe, publishPost, showToast } = useApp();
  const currentUser = useCurrentUser();

  const [publishType, setPublishType] = useState<'post' | 'moment' | 'story'>(() => {
    const t = searchParams.get('type');
    return t === 'story' ? 'story' : t === 'moment' ? 'moment' : 'post';
  });
  const [image, setImage] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [occasion, setOccasion] = useState<Occasion>('Casual Daily');
  const [location, setLocation] = useState(currentUser.location || '');
  const [taggedItemIds, setTaggedItemIds] = useState<string[]>([]);
  const [showWardrobePicker, setShowWardrobePicker] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, or WebP)', 'info');
      return;
    }

    // Validate size (max 10MB)
    const MAX_SIZE_MB = 10;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast(`Image is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max size is ${MAX_SIZE_MB}MB.`, 'info');
      return;
    }

    setIsUploadingImage(true);
    try {
      const uploaded = await api.media.upload(file);
      setImage(uploaded.image_url);
      showToast('Image uploaded and optimized to WebP', 'success');
    } catch (err) {
      // Fallback to local data URL if server media storage is unreachable
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
      showToast('Local preview generated', 'info');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const toggleTagItem = (id: string) => {
    setTaggedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      showToast('Please upload or provide an outfit image', 'info');
      return;
    }
    if (!caption.trim()) {
      showToast('Please add a caption or styling thoughts for this look', 'info');
      return;
    }

    setIsPublishing(true);
    try {
      const parsedTags = hashtags
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => (t.startsWith('#') ? t : `#${t}`));

      if (publishType === 'post') {
        await publishPost({
          image,
          caption: caption.trim(),
          tags: parsedTags,
          occasion,
          location: location.trim() || undefined,
          taggedItemIds,
        });
        showToast('Permanent outfit post published to profile & Following feed', 'success');
        navigate('/home?tab=following');
      } else if (publishType === 'story') {
        await api.posts.createStory({
          image_url: image,
          caption: caption.trim(),
        });
        showToast('24-Hour Instant Story published for your followers!', 'success');
        navigate('/home?tab=following');
      } else {
        await api.moments.create({
          image_url: image,
          caption: caption.trim(),
          occasion,
          tags: parsedTags,
        });
        showToast('24-Hour Outfit Moment live in For You discovery!', 'success');
        navigate('/home?tab=for-you');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to publish', 'info');
    } finally {
      setIsPublishing(false);
    }
  };

  const taggedItems = wardrobe.filter((i) => taggedItemIds.includes(i.id));

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto pb-12">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
            Publish Outfit Look
          </h1>
          <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
            Share your daily styling with the StyleSphere community as a permanent look or a 24-hour discovery moment.
          </p>
        </div>

        {/* Publication Type Selector */}
        <div className="mb-6 bg-cream-50 p-3 rounded-2xl border border-sand-200 shadow-soft">
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-500 mb-2">
            Publication Channel
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPublishType('post')}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                publishType === 'post'
                  ? 'bg-charcoal-900 text-cream-50 shadow-md ring-2 ring-cognac-600'
                  : 'bg-sand-100/70 text-charcoal-700 hover:bg-sand-200/70'
              }`}
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Permanent Post</span>
            </button>
            <button
              type="button"
              onClick={() => setPublishType('story')}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                publishType === 'story'
                  ? 'bg-charcoal-900 text-cream-50 shadow-md ring-2 ring-cognac-600'
                  : 'bg-sand-100/70 text-charcoal-700 hover:bg-sand-200/70'
              }`}
            >
              <Sparkles className="w-4 h-4 text-cognac-400 flex-shrink-0" />
              <span className="truncate">Instant Story (24h)</span>
            </button>
            <button
              type="button"
              onClick={() => setPublishType('moment')}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                publishType === 'moment'
                  ? 'bg-charcoal-900 text-cream-50 shadow-md ring-2 ring-cognac-600'
                  : 'bg-sand-100/70 text-charcoal-700 hover:bg-sand-200/70'
              }`}
            >
              <Clock className="w-4 h-4 text-cognac-400 flex-shrink-0" />
              <span className="truncate">24h Moment</span>
            </button>
          </div>
          <div className="mt-2.5 px-2 text-[11px] text-charcoal-500 flex items-center gap-1.5">
            {publishType === 'post' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
                <span>Permanent Post: Stays on your profile grid indefinitely and appears in your followers' Following feed.</span>
              </>
            ) : publishType === 'story' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-cognac-500 inline-block flex-shrink-0" />
                <span>Instant Story: Appears exclusively in your followers' Instant Stories bar. Automatically expires in 24 hours.</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block flex-shrink-0" />
                <span>24-Hour Moment: Featured in the Tinder-style For You discovery swipe deck. Automatically expires after 24h.</span>
              </>
            )}
          </div>
        </div>

        <form onSubmit={handlePublish} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Image & Tagging */}
          <div className="lg:col-span-6 space-y-6">
            {/* Image Preview & Upload */}
            <div className="bg-cream-50 p-5 rounded-3xl border border-sand-200 shadow-soft">
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-3">
                Outfit Photography *
              </label>

              {/* Hidden file inputs */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />

              {image ? (
                <div className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-sand-200 border border-sand-300 shadow-inner group mb-3">
                  <img
                    src={image}
                    alt="Post preview"
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute inset-0 bg-charcoal-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="cursor-pointer bg-cream-50 text-charcoal-900 px-3.5 py-2 rounded-full text-xs font-bold hover:bg-sand-100 shadow-soft flex items-center gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Change</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImage('')}
                      className="bg-cream-50 text-rose-600 px-3.5 py-2 rounded-full text-xs font-bold hover:bg-rose-50 shadow-soft flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="aspect-[4/5] rounded-2xl border-2 border-dashed border-sand-300 bg-sand-100/50 p-6 flex flex-col items-center justify-center text-center mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-cream-50 flex items-center justify-center text-cognac-700 shadow-soft mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="font-serif font-semibold text-charcoal-900 text-sm mb-1">
                    Add Outfit Photography
                  </p>
                  <p className="text-xs text-charcoal-500 max-w-xs mb-4">
                    High resolution photography from your camera or gallery (JPG, PNG, WebP · Max 10MB)
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-charcoal-900 text-cream-50 rounded-xl text-xs font-semibold hover:bg-charcoal-800 transition-colors shadow-soft"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingImage ? 'Uploading...' : 'Device Files'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-sand-200 text-charcoal-900 rounded-xl text-xs font-semibold hover:bg-sand-300 transition-colors shadow-soft"
                    >
                      <Camera className="w-3.5 h-3.5 text-cognac-700" />
                      <span>Take Photo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Direct Image URL fallback */}
              <div>
                <input
                  type="url"
                  placeholder="Or enter image URL (https://...)"
                  value={image.startsWith('http') ? image : ''}
                  onChange={(e) => setImage(e.target.value)}
                  className="w-full bg-cream-100/60 border border-sand-300 rounded-xl px-3 py-1.5 text-xs text-charcoal-800 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-cognac-600"
                />
              </div>
            </div>

            {/* Tagged Wardrobe Items Section (Only for permanent posts) */}
            {publishType === 'post' && (
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
            )}
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

                {publishType === 'post' && (
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
                )}
              </div>

              {/* Live Card Preview Box */}
              <div className="pt-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-charcoal-400 mb-2 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cognac-600" />
                  {publishType === 'post' ? 'Feed Preview' : 'Discovery Moment Preview'}
                </span>
                <div className="p-3 bg-sand-100 rounded-2xl border border-sand-200 text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-charcoal-900">@{currentUser.username}</span>
                    <span className="text-[10px] text-charcoal-400">
                      {publishType === 'post' ? '· Permanent Post' : '· 24h Outfit Moment'}
                    </span>
                    <span className="ml-auto text-[10px] bg-cream-50 px-2 py-0.5 rounded-full font-semibold">
                      {occasion}
                    </span>
                  </div>
                  <p className="text-charcoal-700 line-clamp-2">{caption || '(Caption preview will appear here...)'}</p>
                  {hashtags && <p className="text-cognac-700 text-[11px] mt-1 font-medium">{hashtags}</p>}
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
                  {publishType === 'post' ? 'Publish Outfit to Feed' : 'Publish 24h Outfit Moment'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
};

