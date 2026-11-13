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
  BarChart2,
  Plus,
  Trash2,
  HelpCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { EditorialPageHeader } from '../components/editorial/EditorialPageHeader';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { Occasion, CreatePollPayload } from '../types';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../utils/imageUrl';
import { optimizeImage, formatBytes } from '../utils/imageOptimizer';
import { perfMonitor } from '../utils/performanceMonitor';

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

  const [publishType, setPublishType] = useState<'post' | 'moment' | 'poll'>(() => {
    const t = searchParams.get('type');
    if (t === 'moment') return 'moment';
    if (t === 'poll') return 'poll';
    return 'post';
  });

  const [image, setImage] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [occasion, setOccasion] = useState<Occasion>('Casual Daily');
  const [location, setLocation] = useState(currentUser.location || '');
  const [taggedItemIds, setTaggedItemIds] = useState<string[]>([]);
  const [showWardrobePicker, setShowWardrobePicker] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const isPublishingRef = useRef(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: string;
    optimizedSize: string;
    savedPercent: number;
    durationMs: number;
  } | null>(null);

  // Poll state
  const [includePoll, setIncludePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDurationHours, setPollDurationHours] = useState<number>(24);
  const [allowVoteChange, setAllowVoteChange] = useState<boolean>(false);
  const [showResultsBeforeVote, setShowResultsBeforeVote] = useState<boolean>(false);
  const [allowCreatorVote, setAllowCreatorVote] = useState<boolean>(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleAddPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions((prev) => [...prev, '']);
    }
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handlePollOptionChange = (index: number, val: string) => {
    setPollOptions((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const processFile = async (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, or WebP)', 'info');
      return;
    }

    const MAX_SIZE_MB = 12;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast(`Image is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max size is ${MAX_SIZE_MB}MB.`, 'info');
      return;
    }

    // Immediate local preview so the interface reacts instantly
    const instantLocalUrl = URL.createObjectURL(file);
    setImage(instantLocalUrl);

    // Client-side adaptive optimization
    setIsCompressingImage(true);
    let fileToUpload: File = file;
    let originalBytes = file.size;
    let optimizedBytes = file.size;
    let savedPercent = 0;
    let compressionTime = 0;

    try {
      const preset = publishType === 'moment' ? 'moment' : 'feed';
      const result = await optimizeImage(file, { preset });
      fileToUpload = result.optimizedFile;
      originalBytes = result.originalSize;
      optimizedBytes = result.optimizedSize;
      savedPercent = Math.round(result.compressionRatio * 100);
      compressionTime = result.processingTimeMs;

      setCompressionStats({
        originalSize: formatBytes(result.originalSize),
        optimizedSize: formatBytes(result.optimizedSize),
        savedPercent,
        durationMs: compressionTime,
      });

      perfMonitor.recordImageOptimization({
        fileName: file.name,
        originalBytes,
        optimizedBytes,
        savedPercent,
        compressionDurationMs: compressionTime,
      });
    } catch (optErr) {
      console.warn('[CreatePost] Client-side optimization fallback to original:', optErr);
    } finally {
      setIsCompressingImage(false);
    }

    // Upload optimized asset
    setIsUploadingImage(true);
    const uploadTimerKey = `upload_${Date.now()}`;
    perfMonitor.startTimer(uploadTimerKey);

    try {
      const uploaded = await api.media.upload(fileToUpload);
      setImage(uploaded.image_url);
      const uploadElapsed = perfMonitor.stopTimer(uploadTimerKey);

      if (savedPercent > 0) {
        showToast(
          `Image optimized (${formatBytes(originalBytes)} → ${formatBytes(optimizedBytes)}, -${savedPercent}%)`,
          'success'
        );
      } else {
        showToast('Image uploaded successfully', 'success');
      }
    } catch {
      // Keep local preview if offline/fallback
      showToast('Image saved locally (offline preview)', 'info');
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

  const buildPollPayload = (contentType: 'post' | 'moment' | 'standalone'): CreatePollPayload => {
    const cleaned = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim()) {
      throw new Error('Please enter a question for your poll');
    }
    if (cleaned.length < 2) {
      throw new Error('Please enter at least 2 distinct poll options');
    }
    return {
      question: pollQuestion.trim(),
      options: cleaned,
      duration_hours: contentType === 'moment' ? 24 : pollDurationHours,
      allow_vote_change: allowVoteChange,
      show_results_before_vote: showResultsBeforeVote,
      allow_creator_vote: allowCreatorVote,
      content_type: contentType,
    };
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing || isPublishingRef.current) return;

    // Standalone poll submission
    if (publishType === 'poll') {
      try {
        isPublishingRef.current = true;
        setIsPublishing(true);
        const pollPayload = buildPollPayload('standalone');
        await api.polls.create(pollPayload);
        showToast('Community Poll published successfully!', 'success');
        navigate('/home');
      } catch (err: any) {
        showToast(err?.message || 'Failed to publish poll', 'info');
      } finally {
        isPublishingRef.current = false;
        setIsPublishing(false);
      }
      return;
    }

    // Post / Moment submission requires photo
    if (!image) {
      showToast('Please upload or select an outfit photo', 'info');
      return;
    }

    if (!caption.trim()) {
      showToast('Please add a caption for your look', 'info');
      return;
    }

    isPublishingRef.current = true;
    setIsPublishing(true);

    try {
      const parsedTags = hashtags
        .split(/[,\s#]+/)
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      let pollPayload: CreatePollPayload | undefined = undefined;
      if (includePoll) {
        pollPayload = buildPollPayload(publishType === 'post' ? 'post' : 'moment');
      }

      if (publishType === 'post') {
        await publishPost({
          image,
          caption: caption.trim(),
          tags: parsedTags,
          occasion,
          location: location.trim() || undefined,
          taggedItemIds,
          poll: pollPayload,
        });
        showToast('Permanent outfit post published to profile & Following feed', 'success');
        navigate('/home?tab=following');
      } else {
        await api.moments.create({
          image_url: image,
          caption: caption.trim(),
          occasion,
          tags: parsedTags,
          poll: pollPayload,
        });
        showToast('24-Hour Outfit Moment live in For You discovery!', 'success');
        navigate('/home?tab=for-you');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to publish', 'info');
    } finally {
      isPublishingRef.current = false;
      setIsPublishing(false);
    }
  };

  const taggedItems = wardrobe.filter((i) => taggedItemIds.includes(i.id));

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto pb-12">
        {/* Editorial Page Header */}
        <EditorialPageHeader
          eyebrow="COMMUNITY ATELIER & PUBLICATION"
          title="Publish Look"
          italicTitle="or Poll."
          description="Share your daily styling as a permanent look, 24-hour discovery moment, or ask the community with a fashion poll."
        />

        {/* Publication Type Selector */}
        <div className="mb-6 bg-white dark:bg-[#1F1922] p-4 rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E]">
          <label className="block text-[10px] font-mono uppercase tracking-[0.16em] text-[#777078] mb-2">
            Publication Channel
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPublishType('post')}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 min-h-[44px] rounded-[2px] text-xs font-mono uppercase tracking-[0.12em] transition-all cursor-pointer border ${
                publishType === 'post'
                  ? 'bg-[#29202B] dark:bg-[#FAF6F0] text-[#F3EEE8] dark:text-[#29202B] border-transparent font-semibold shadow-xs'
                  : 'bg-[#FAF6F0] dark:bg-[#241D27] text-[#777078] dark:text-[#DCD4CC] border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49]'
              }`}
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Permanent Post</span>
            </button>
            <button
              type="button"
              onClick={() => setPublishType('moment')}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 min-h-[44px] rounded-[2px] text-xs font-mono uppercase tracking-[0.12em] transition-all cursor-pointer border ${
                publishType === 'moment'
                  ? 'bg-[#29202B] dark:bg-[#FAF6F0] text-[#F3EEE8] dark:text-[#29202B] border-transparent font-semibold shadow-xs'
                  : 'bg-[#FAF6F0] dark:bg-[#241D27] text-[#777078] dark:text-[#DCD4CC] border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49]'
              }`}
            >
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">24h Moment</span>
            </button>
            <button
              type="button"
              onClick={() => setPublishType('poll')}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 sm:px-4 min-h-[44px] rounded-[2px] text-xs font-mono uppercase tracking-[0.12em] transition-all cursor-pointer border ${
                publishType === 'poll'
                  ? 'bg-[#29202B] dark:bg-[#FAF6F0] text-[#F3EEE8] dark:text-[#29202B] border-transparent font-semibold shadow-xs'
                  : 'bg-[#FAF6F0] dark:bg-[#241D27] text-[#777078] dark:text-[#DCD4CC] border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49]'
              }`}
            >
              <BarChart2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Community Poll</span>
            </button>
          </div>
          <div className="mt-2.5 px-1 text-xs text-[#777078] font-mono flex items-center gap-1.5">
            {publishType === 'post' && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#743C49] inline-block flex-shrink-0" />
                <span>Permanent Post: Stays on your profile grid and appears in your followers&apos; feed with optional poll.</span>
              </>
            )}
            {publishType === 'moment' && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#B49B82] inline-block flex-shrink-0" />
                <span>24-Hour Moment: Appears in For You discovery deck. Automatically expires after 24 hours.</span>
              </>
            )}
            {publishType === 'poll' && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#D5A6A0] inline-block flex-shrink-0" />
                <span>Community Poll: Collect style opinions, vote on pieces or outfit pairings directly from the fashion community.</span>
              </>
            )}
          </div>
        </div>

        <form onSubmit={handlePublish} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Image & Poll Options */}
          <div className="lg:col-span-6 space-y-6">
            {/* Image Preview & Upload (Required for Post/Moment, Optional for Standalone Poll) */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                Outfit Photography {publishType !== 'poll' && '*'}
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
                  {/* Real-time Compression & Upload Badge */}
                  <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 pointer-events-none">
                    {isCompressingImage && (
                      <span className="text-[11px] font-medium bg-black/80 text-amber-300 px-2.5 py-1 rounded backdrop-blur-sm border border-amber-500/30">
                        ⚡ Optimizing WebP...
                      </span>
                    )}
                    {isUploadingImage && !isCompressingImage && (
                      <span className="text-[11px] font-medium bg-black/80 text-sky-300 px-2.5 py-1 rounded backdrop-blur-sm border border-sky-500/30">
                        ☁️ Uploading to storage...
                      </span>
                    )}
                    {compressionStats && !isCompressingImage && !isUploadingImage && (
                      <span className="text-[11px] font-medium bg-black/80 text-emerald-300 px-2.5 py-1 rounded backdrop-blur-sm border border-emerald-500/30">
                        ⚡ {compressionStats.originalSize} → {compressionStats.optimizedSize} (-{compressionStats.savedPercent}%)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImage('');
                      setCompressionStats(null);
                    }}
                    className="absolute top-3 right-3 p-2 min-h-[44px] min-w-[44px] rounded-md bg-black/70 text-white hover:bg-rose-600 transition-colors flex items-center justify-center cursor-pointer"
                    title="Remove image"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-md p-8 text-center flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-800/40 min-h-[220px]">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 dark:text-zinc-400">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {publishType === 'poll' ? 'Attach optional look photo' : 'Upload look photo'}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      WebP, JPEG, or PNG supported (auto-optimized)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isUploadingImage}
                      icon={<Upload className="w-4 h-4" />}
                    >
                      {isUploadingImage ? 'Uploading...' : 'Choose File'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isUploadingImage}
                      icon={<Camera className="w-4 h-4" />}
                    >
                      Take Photo
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Wardrobe Tagging for Permanent Post */}
            {publishType === 'post' && (
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Tag Wardrobe Garments
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowWardrobePicker(!showWardrobePicker)}
                  >
                    {showWardrobePicker ? 'Hide Picker' : '+ Select Pieces'}
                  </Button>
                </div>

                {taggedItems.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {taggedItems.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700"
                      >
                        {item.name}
                        <button
                          type="button"
                          onClick={() => toggleTagItem(item.id)}
                          className="hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {showWardrobePicker && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 max-h-48 overflow-y-auto space-y-1">
                    {wardrobe.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleTagItem(item.id)}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer text-xs ${
                          taggedItemIds.includes(item.id)
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        <span className="font-medium truncate">{item.name}</span>
                        <span className="opacity-70 capitalize ml-2">{item.category}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Post Details & Poll Configuration */}
          <div className="lg:col-span-6 space-y-6">
            {/* Poll Configuration Section */}
            {(publishType === 'poll' || includePoll) ? (
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-blue-200 dark:border-blue-900/50 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {publishType === 'poll' ? 'Community Poll Setup' : 'Attached Poll Setup'}
                    </span>
                  </div>
                  {publishType !== 'poll' && (
                    <button
                      type="button"
                      onClick={() => setIncludePoll(false)}
                      className="text-xs text-rose-500 hover:underline"
                    >
                      Remove Poll
                    </button>
                  )}
                </div>

                {/* Question */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Poll Question *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Which shoes should I pair with this blazer?"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 min-h-[44px] text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                {/* Options List */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Poll Options (2 to 6) *
                  </label>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-400 w-4 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        required
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                        className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePollOption(idx)}
                          className="p-2 text-zinc-400 hover:text-rose-500 rounded transition-colors"
                          title="Remove option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  {pollOptions.length < 6 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddPollOption}
                      icon={<Plus className="w-3.5 h-3.5" />}
                      className="mt-1"
                    >
                      Add Option
                    </Button>
                  )}
                </div>

                {/* Duration */}
                {publishType !== 'moment' ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Poll Duration
                    </label>
                    <select
                      value={pollDurationHours}
                      onChange={(e) => setPollDurationHours(Number(e.target.value))}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2.5 min-h-[44px] text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer"
                    >
                      <option value={24}>24 Hours (1 Day)</option>
                      <option value={72}>3 Days</option>
                      <option value={168}>7 Days (1 Week)</option>
                      <option value={336}>14 Days (2 Weeks)</option>
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Poll automatically closes when this 24-hour outfit moment expires.</span>
                  </p>
                )}

                {/* Advanced Voting Rules */}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Voting Policies
                  </span>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={allowVoteChange}
                      onChange={(e) => setAllowVoteChange(e.target.checked)}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0"
                    />
                    <span>Allow voters to change their vote before the poll closes</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={showResultsBeforeVote}
                      onChange={(e) => setShowResultsBeforeVote(e.target.checked)}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0"
                    />
                    <span>Show live results before voting (otherwise hidden until user votes or poll closes)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={allowCreatorVote}
                      onChange={(e) => setAllowCreatorVote(e.target.checked)}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0"
                    />
                    <span>Allow me to vote on my own poll (disabled by default to prevent bias)</span>
                  </label>
                </div>
              </div>
            ) : (
              /* Toggle to Attach Poll to Post / Moment */
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-md">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Add a Community Poll
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Ask your audience for styling feedback or vote on outfit pieces
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIncludePoll(true)}
                >
                  + Add Poll
                </Button>
              </div>
            )}

            {/* Post Details Card */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
              {/* Caption */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {publishType === 'poll' ? 'Background Context (Optional)' : 'Look Caption *'}
                </label>
                <textarea
                  rows={3}
                  required={publishType !== 'poll'}
                  placeholder={
                    publishType === 'poll'
                      ? 'Add any styling context, dress code details, or styling dilemmas...'
                      : 'Share the inspiration behind this look, styling advice, or garment fit notes...'
                  }
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md p-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
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
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 min-h-[44px] text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
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
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2.5 min-h-[44px] text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer"
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
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md pl-9 pr-3 py-2.5 min-h-[44px] text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      />
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3.5" />
                    </div>
                  </div>
                )}
              </div>

              {/* Publish Button */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isPublishing}
                  loadingText="Publishing..."
                  className="w-full min-h-[44px]"
                >
                  {publishType === 'poll'
                    ? 'Publish Community Poll'
                    : publishType === 'post'
                    ? (includePoll ? 'Publish Post with Poll' : 'Publish Outfit to Feed')
                    : (includePoll ? 'Publish 24h Moment with Poll' : 'Publish 24h Outfit Moment')}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
};
