import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Upload,
  Camera,
  Clock,
  MapPin,
  Tag,
  Eye,
  X,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { Occasion } from '../types';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../utils/imageUrl';

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

  const [publishType, setPublishType] = useState<'post' | 'moment'>(() => {
    const t = searchParams.get('type');
    return t === 'moment' ? 'moment' : 'post';
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
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setImage(result);
          showToast('Image loaded locally', 'info');
        }
      };
      reader.readAsDataURL(file);
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
      showToast('Please attach outfit photography', 'info');
      return;
    }

    if (!caption.trim()) {
      showToast('Please write a styling caption', 'info');
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
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-luxury-text dark:text-luxury-dark-text">
            Publish Outfit Look
          </h1>
          <p className="text-xs sm:text-sm text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1">
            Share your daily styling with the StyleSphere community as a permanent look or a 24-hour discovery moment.
          </p>
        </div>

        {/* Publication Type Selector */}
        <div className="mb-6 bg-luxury-surface dark:bg-luxury-dark-surface p-3.5 rounded-2xl border border-luxury-border dark:border-luxury-dark-border shadow-soft">
          <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-2">
            Publication Channel
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPublishType('post')}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                publishType === 'post'
                  ? 'bg-luxury-espresso dark:bg-luxury-dark-champagne text-white dark:text-luxury-dark-espresso shadow-md ring-2 ring-luxury-champagne/50'
                  : 'bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle text-luxury-text dark:text-luxury-dark-text hover:bg-luxury-border/30'
              }`}
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Permanent Post</span>
            </button>
            <button
              type="button"
              onClick={() => setPublishType('moment')}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                publishType === 'moment'
                  ? 'bg-luxury-espresso dark:bg-luxury-dark-champagne text-white dark:text-luxury-dark-espresso shadow-md ring-2 ring-luxury-champagne/50'
                  : 'bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle text-luxury-text dark:text-luxury-dark-text hover:bg-luxury-border/30'
              }`}
            >
              <Clock className="w-4 h-4 text-luxury-champagne flex-shrink-0" />
              <span className="truncate">24h Outfit Moment</span>
            </button>
          </div>
          <div className="mt-2.5 px-2 text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted flex items-center gap-1.5">
            {publishType === 'post' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
                <span>Permanent Post: Stays on your profile grid indefinitely and appears in your followers&apos; Following feed.</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block flex-shrink-0" />
                <span>24-Hour Moment: Shared exclusively with users who follow you. Automatically expires after 24 hours.</span>
              </>
            )}
          </div>
        </div>

        <form onSubmit={handlePublish} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Image & Tagging */}
          <div className="lg:col-span-6 space-y-6">
            {/* Image Preview & Upload */}
            <div className="bg-luxury-surface dark:bg-luxury-dark-surface p-5 rounded-3xl border border-luxury-border dark:border-luxury-dark-border shadow-soft">
              <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-3">
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
                <div className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle border border-luxury-border dark:border-luxury-dark-border shadow-inner group mb-3">
                  <img
                    src={resolveImageUrl(image) || FALLBACK_POST_IMAGE}
                    alt="Post preview"
                    onError={(e) => {
                      if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                        e.currentTarget.src = FALLBACK_POST_IMAGE;
                      }
                    }}
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="cursor-pointer bg-white text-luxury-espresso px-3.5 py-2 rounded-full text-xs font-bold hover:bg-neutral-100 shadow-soft flex items-center gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Change</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImage('')}
                      className="bg-white text-rose-600 px-3.5 py-2 rounded-full text-xs font-bold hover:bg-rose-50 shadow-soft flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="aspect-[4/5] rounded-2xl border-2 border-dashed border-luxury-border dark:border-luxury-dark-border bg-luxury-surfaceSubtle/40 dark:bg-luxury-dark-surfaceSubtle/40 p-6 flex flex-col items-center justify-center text-center mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-luxury-surface dark:bg-luxury-dark-surface border border-luxury-border dark:border-luxury-dark-border flex items-center justify-center text-luxury-champagne shadow-soft mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="font-serif font-semibold text-luxury-text dark:text-luxury-dark-text text-sm mb-1">
                    Add Outfit Photography
                  </p>
                  <p className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted max-w-xs mb-4">
                    High resolution photography from your camera or gallery (JPG, PNG, WebP · Max 10MB)
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-luxury-espresso dark:bg-luxury-dark-champagne text-white dark:text-luxury-dark-espresso rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity shadow-soft cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingImage ? 'Uploading...' : 'Device Files'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle text-luxury-text dark:text-luxury-dark-text rounded-xl text-xs font-semibold border border-luxury-border dark:border-luxury-dark-border hover:bg-luxury-border/30 transition-colors shadow-soft cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-luxury-champagne" />
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
                  className="w-full bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border rounded-xl px-3 py-1.5 text-xs text-luxury-text dark:text-luxury-dark-text placeholder:text-luxury-textMuted/60 focus:outline-none focus:ring-1 focus:ring-luxury-champagne"
                />
              </div>
            </div>

            {/* Tagged Wardrobe Items Section (Only for permanent posts) */}
            {publishType === 'post' && (
              <div className="bg-luxury-surface dark:bg-luxury-dark-surface p-5 rounded-3xl border border-luxury-border dark:border-luxury-dark-border shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-luxury-champagne dark:text-luxury-dark-champagne" />
                    <span className="text-xs font-bold uppercase tracking-wider text-luxury-text dark:text-luxury-dark-text">
                      Tag Wardrobe Items ({taggedItemIds.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWardrobePicker(!showWardrobePicker)}
                    className="text-xs font-semibold text-luxury-champagne dark:text-luxury-dark-champagne hover:underline cursor-pointer"
                  >
                    {showWardrobePicker ? 'Done Tagging' : '+ Tag From Wardrobe'}
                  </button>
                </div>

                {/* Tagged Items Pills */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {taggedItems.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1.5 bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle text-luxury-text dark:text-luxury-dark-text text-xs px-2.5 py-1 rounded-full border border-luxury-border dark:border-luxury-dark-border"
                    >
                      <img src={item.image} alt={item.name} className="w-4 h-4 rounded-full object-cover" />
                      <span>{item.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleTagItem(item.id)}
                        className="hover:text-rose-600 ml-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Wardrobe picker drawer */}
                {showWardrobePicker && (
                  <div className="p-3 bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 rounded-2xl border border-luxury-border dark:border-luxury-dark-border max-h-52 overflow-y-auto space-y-1.5">
                    <p className="text-[11px] font-bold text-luxury-textMuted dark:text-luxury-dark-textMuted mb-2">
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
                              ? 'bg-luxury-champagne/15 border border-luxury-champagne/40 font-bold text-luxury-champagne dark:text-luxury-dark-champagne'
                              : 'bg-luxury-surface dark:bg-luxury-dark-surface hover:bg-luxury-surfaceSubtle border border-luxury-border dark:border-luxury-dark-border text-luxury-text dark:text-luxury-dark-text'
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
            <div className="bg-luxury-surface dark:bg-luxury-dark-surface p-6 rounded-3xl border border-luxury-border dark:border-luxury-dark-border shadow-soft space-y-4">
              {/* Caption */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-1.5">
                  Caption / Styling Thoughts *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Share the inspiration behind this look, styling advice, or garment fit notes..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border rounded-2xl p-3.5 text-xs sm:text-sm text-luxury-text dark:text-luxury-dark-text placeholder:text-luxury-textMuted/60 focus:outline-none focus:ring-1 focus:ring-luxury-champagne resize-none"
                />
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-1.5">
                  Hashtags
                </label>
                <input
                  type="text"
                  placeholder="#Minimal #QuietLuxury #Tailoring #DailyFit"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="w-full bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border rounded-2xl px-3.5 py-2.5 text-xs text-luxury-text dark:text-luxury-dark-text placeholder:text-luxury-textMuted/60 focus:outline-none focus:ring-1 focus:ring-luxury-champagne"
                />
              </div>

              {/* Occasion & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-1.5">
                    Occasion
                  </label>
                  <select
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value as Occasion)}
                    className="w-full bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border rounded-2xl px-3 py-2 text-xs text-luxury-text dark:text-luxury-dark-text focus:outline-none focus:ring-1 focus:ring-luxury-champagne"
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-1.5">
                      Location
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. SoHo, New York"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border rounded-2xl pl-9 pr-3 py-2 text-xs text-luxury-text dark:text-luxury-dark-text focus:outline-none focus:ring-1 focus:ring-luxury-champagne"
                      />
                      <MapPin className="w-3.5 h-3.5 text-luxury-textMuted absolute left-3 top-2.5" />
                    </div>
                  </div>
                )}
              </div>

              {/* Live Card Preview Box */}
              <div className="pt-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-2 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-luxury-champagne dark:text-luxury-dark-champagne" />
                  {publishType === 'post' ? 'Feed Preview' : 'Discovery Moment Preview'}
                </span>
                <div className="p-3 bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 rounded-2xl border border-luxury-border dark:border-luxury-dark-border text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-luxury-text dark:text-luxury-dark-text">@{currentUser.username}</span>
                    <span className="text-[10px] text-luxury-textMuted dark:text-luxury-dark-textMuted">
                      {publishType === 'post' ? '· Permanent Post' : '· 24h Outfit Moment'}
                    </span>
                    <span className="ml-auto text-[10px] bg-luxury-surface dark:bg-luxury-dark-surface border border-luxury-border dark:border-luxury-dark-border px-2 py-0.5 rounded-full font-semibold text-luxury-text dark:text-luxury-dark-text">
                      {occasion}
                    </span>
                  </div>
                  <p className="text-luxury-text dark:text-luxury-dark-text line-clamp-2">{caption || '(Caption preview will appear here...)'}</p>
                  {hashtags && <p className="text-luxury-champagne dark:text-luxury-dark-champagne text-[11px] mt-1 font-medium">{hashtags}</p>}
                </div>
              </div>

              {/* Publish Button */}
              <div className="pt-4 border-t border-luxury-border dark:border-luxury-dark-border">
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
