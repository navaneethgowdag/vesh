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
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, or WebP)', 'info');
      return;
    }

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
      showToast('Please upload or select an outfit photo', 'info');
      return;
    }

    if (!caption.trim()) {
      showToast('Please add a caption for your look', 'info');
      return;
    }

    setIsPublishing(true);

    try {
      const parsedTags = hashtags
        .split(/[,\s#]+/)
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

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
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Publish Outfit Look
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Share your daily styling with the StyleSphere community as a permanent look or a 24-hour discovery moment.
          </p>
        </div>

        {/* Publication Type Selector */}
        <div className="mb-6 bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            Publication Channel
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPublishType('post')}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 min-h-[44px] rounded-md text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
                publishType === 'post'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Permanent Post</span>
            </button>
            <button
              type="button"
              onClick={() => setPublishType('moment')}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 min-h-[44px] rounded-md text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
                publishType === 'moment'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">24h Outfit Moment</span>
            </button>
          </div>
          <div className="mt-2.5 px-1 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            {publishType === 'post' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
                <span>Permanent Post: Stays on your profile grid and appears in your followers&apos; Following feed.</span>
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
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
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
                <div className="relative rounded-md overflow-hidden aspect-[4/5] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 group mb-3">
                  <img
                    src={resolveImageUrl(image) || FALLBACK_POST_IMAGE}
                    alt="Outfit capture"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    className="absolute top-3 right-3 p-2 min-h-[44px] min-w-[44px] rounded-md bg-black/70 text-white hover:bg-rose-600 transition-colors flex items-center justify-center cursor-pointer"
                    title="Remove image"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-md aspect-[4/5] flex flex-col items-center justify-center p-6 text-center bg-zinc-50 dark:bg-zinc-800/40 mb-3">
                  <div className="w-14 h-14 rounded-md bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 mb-3">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                    Upload Lookbook Photo
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 max-w-xs">
                    Choose from device gallery or take an instant outfit photo.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 min-h-[44px] rounded-md text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{isUploadingImage ? 'Uploading...' : 'Choose File'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 min-h-[44px] rounded-md text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700"
                    >
                      <Camera className="w-4 h-4" />
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
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 min-h-[44px] text-base sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            </div>

            {/* Tagged Wardrobe Items Section (Only for permanent posts) */}
            {publishType === 'post' && (
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                      Tag Wardrobe Items ({taggedItemIds.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWardrobePicker(!showWardrobePicker)}
                    className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                  >
                    {showWardrobePicker ? 'Done Tagging' : '+ Tag From Wardrobe'}
                  </button>
                </div>

                {/* Tagged Items Pills */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {taggedItems.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700"
                    >
                      <img src={item.image} alt={item.name} className="w-4 h-4 rounded object-cover" />
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
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-700 max-h-52 overflow-y-auto space-y-1.5">
                    <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-2">
                      Click items from your digital closet to tag:
                    </p>
                    {wardrobe.map((item) => {
                      const isTagged = taggedItemIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleTagItem(item.id)}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors ${
                            isTagged
                              ? 'bg-zinc-900 dark:bg-zinc-100 font-bold text-white dark:text-zinc-900'
                              : 'bg-white dark:bg-zinc-800 hover:bg-zinc-100 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={item.image} alt={item.name} className="w-8 h-8 rounded object-cover" />
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
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
              {/* Caption */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Caption / Styling Thoughts *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Share the inspiration behind this look, styling advice, or garment fit notes..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md p-3 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
                />
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Hashtags
                </label>
                <input
                  type="text"
                  placeholder="#Minimal #QuietLuxury #Tailoring #DailyFit"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              {/* Occasion & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Occasion
                  </label>
                  <select
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value as Occasion)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer"
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Location
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. SoHo, New York"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md pl-9 pr-3 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      />
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3.5" />
                    </div>
                  </div>
                )}
              </div>

              {/* Live Card Preview Box */}
              <div className="pt-2">
                <span className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  {publishType === 'post' ? 'Feed Preview' : 'Discovery Moment Preview'}
                </span>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">@{currentUser.username}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {publishType === 'post' ? '· Permanent Post' : '· 24h Outfit Moment'}
                    </span>
                    <span className="ml-auto text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded font-semibold text-zinc-900 dark:text-zinc-100">
                      {occasion}
                    </span>
                  </div>
                  <p className="text-zinc-900 dark:text-zinc-100 line-clamp-2">{caption || '(Caption preview will appear here...)'}</p>
                  {hashtags && <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1 font-medium">{hashtags}</p>}
                </div>
              </div>

              {/* Publish Button */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isPublishing}
                  className="w-full min-h-[44px]"
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
