import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Camera,
  Shirt,
  Sparkles,
  Check,
  RefreshCw,
  AlertCircle,
  Eye,
  CheckCircle2,
  Loader2,
  Tag,
  Palette,
  ShieldCheck,
  Compass,
  Layers,
  X,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  ClothingPrediction,
  ClothingAttributesData,
} from '../../types';
import { SearchableCombobox } from './SearchableCombobox';
import defaultClassMappings from '../../data/classMappings.json';
import { useAsyncLock } from '../../hooks/useAsyncLock';

interface AddClothingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToBatch?: () => void;
}

type UploadStep = 'idle' | 'analyzing' | 'review' | 'saving' | 'failed';

export const AddClothingModal: React.FC<AddClothingModalProps> = ({
  isOpen,
  onClose,
  onSwitchToBatch,
}) => {
  const { refreshData, showToast } = useApp();
  const { execute: runAnalyze, isLocked: isAnalyzing } = useAsyncLock();
  const { execute: runSave, isLocked: isSaving } = useAsyncLock();

  // Class mappings: defaults from static JSON with runtime sync from backend
  const [classOptions, setClassOptions] = useState<Record<string, string[]>>(defaultClassMappings);

  // Workflow State
  const [step, setStep] = useState<UploadStep>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Garment Basic Information
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');

  // 9 Supported Multi-Task EfficientNet-B0 Model Attributes
  // 1. Garment identification
  const [articleType, setArticleType] = useState('Shirts');
  const [masterCategory, setMasterCategory] = useState('Apparel');
  const [subCategory, setSubCategory] = useState('Topwear');

  // 2. Appearance
  const [baseColour, setBaseColour] = useState('Black');
  const [pattern, setPattern] = useState('Solid');

  // 3. Catalog context
  const [gender, setGender] = useState('Unisex');
  const [season, setSeason] = useState('Summer');
  const [usage, setUsage] = useState('Casual');
  const [ageGroup, setAgeGroup] = useState('Adults-Unisex');

  // Raw AI Prediction and Confidence Map
  const [rawPrediction, setRawPrediction] = useState<ClothingPrediction | null>(null);
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch latest attribute options on open
  useEffect(() => {
    if (isOpen) {
      api.clothing
        .getAttributeOptions()
        .then((opts) => {
          if (opts && Object.keys(opts).length > 0) {
            setClassOptions(opts);
          }
        })
        .catch(() => {
          // Fall back gracefully to bundled defaultClassMappings
        });
    }
  }, [isOpen]);

  // Reset state when modal is opened or closed
  useEffect(() => {
    if (!isOpen) {
      setStep('idle');
      setSelectedFile(null);
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
      setLocalPreviewUrl(null);
      setActiveItemId(null);
      setErrorMessage(null);
      setName('');
      setBrand('');
      setArticleType('Shirts');
      setMasterCategory('Apparel');
      setSubCategory('Topwear');
      setBaseColour('Black');
      setPattern('Solid');
      setGender('Unisex');
      setSeason('Summer');
      setUsage('Casual');
      setAgeGroup('Adults-Unisex');
      setRawPrediction(null);
      setEditedFields(new Set());
    }
  }, [isOpen]);

  const markEdited = (field: string) => {
    setEditedFields((prev) => new Set(prev).add(field));
  };

  // Extract confidence and alternatives helper
  const getFieldMeta = (fieldSnake: string) => {
    if (!rawPrediction || !rawPrediction.prediction_scores) {
      return { confidence: undefined, alternatives: [] as { label: string; confidence: number }[], reviewRequired: false };
    }
    const scoreData = rawPrediction.prediction_scores[fieldSnake];
    if (!scoreData) {
      return { confidence: undefined, alternatives: [], reviewRequired: false };
    }
    return {
      confidence: typeof scoreData.confidence === 'number' ? scoreData.confidence : undefined,
      alternatives: Array.isArray(scoreData.alternatives) ? scoreData.alternatives : [],
      reviewRequired: Boolean(scoreData.review_required),
    };
  };

  // Populate attributes from backend prediction payload
  const populateAttributesFromPrediction = (pred: any, resolvedName?: string) => {
    setRawPrediction(pred);
    const attrs = pred.predicted_attributes || {};
    const scores = pred.prediction_scores || {};

    // 1. Garment identification
    if (attrs.article_type) setArticleType(attrs.article_type);
    else if (pred.predicted_category) setArticleType(pred.predicted_category);

    if (attrs.master_category) setMasterCategory(attrs.master_category);
    else if (pred.category_group) setMasterCategory(pred.category_group);

    if (attrs.sub_category) setSubCategory(attrs.sub_category);

    // 2. Appearance
    if (attrs.base_colour) setBaseColour(attrs.base_colour);
    else if (attrs.primary_color) setBaseColour(attrs.primary_color);
    else if (attrs.color) setBaseColour(attrs.color);

    if (attrs.pattern) setPattern(attrs.pattern);

    // 3. Catalog context
    if (attrs.gender) setGender(attrs.gender);
    if (attrs.season) setSeason(attrs.season);
    if (attrs.usage) setUsage(attrs.usage);
    else if (attrs.occasion) setUsage(attrs.occasion);
    if (attrs.age_group) setAgeGroup(attrs.age_group);

    // Default item name if empty
    if (!name.trim()) {
      const art = attrs.article_type || pred.predicted_category || 'Garment';
      const col = attrs.base_colour || attrs.primary_color || '';
      setName(resolvedName || `${col} ${art}`.trim());
    }
  };

  // Step 1 & 2: Handle user image selection
  const handleFileChosen = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (JPEG, PNG, WebP).', 'info');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image file size must be 10MB or less.', 'info');
      return;
    }

    await runAnalyze(async () => {
      // Immediate local preview of the original image
      setSelectedFile(file);
      const preview = URL.createObjectURL(file);
      setLocalPreviewUrl(preview);
      setStep('analyzing');
      setErrorMessage(null);

      const baseName = file.name
        ? file.name.substring(0, file.name.lastIndexOf('.')) || file.name
        : 'Wardrobe Item';
      const friendlyName = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

      try {
        // Direct upload: runs EfficientNet-B0 on original photograph immediately
        const res = await api.clothing.upload(file, {
          name: friendlyName,
        });

        setActiveItemId(res.itemId);

        if (res.prediction) {
          populateAttributesFromPrediction(res.prediction, friendlyName);
        } else {
          // Fallback fetch if prediction not returned directly
          const attrData: ClothingAttributesData = await api.clothing.getAttributes(res.itemId);
          if (attrData.original_prediction) {
            populateAttributesFromPrediction(attrData.original_prediction, friendlyName);
          }
        }

        setStep('review');
        showToast('AI analysis complete! Review and adjust your garment attributes below.', 'success');
      } catch (err: any) {
        setStep('failed');
        const msg = err.message || 'Failed to analyze clothing photograph.';
        setErrorMessage(msg);
        showToast(msg, 'info');
      }
    });
  };

  // Step 3: Finalize and save confirmed clothing attributes
  const handleSaveToWardrobe = async () => {
    if (!activeItemId) {
      showToast('No active clothing item to save.', 'info');
      return;
    }

    await runSave(async () => {
      setStep('saving');
      try {
        const verifiedAttributes = {
          name: name.trim() || `${baseColour} ${articleType}`,
          article_type: articleType,
          master_category: masterCategory,
          sub_category: subCategory,
          base_colour: baseColour,
          pattern: pattern,
          gender: gender,
          season: season,
          usage: usage,
          age_group: ageGroup,
          brand: brand.trim() || null,
          // Sync primary color and occasion for backwards compatibility
          primary_color: baseColour,
          occasion: usage,
        };

        await api.clothing.finalize(activeItemId, verifiedAttributes);
        await refreshData();

        showToast(`"${verifiedAttributes.name}" added to your wardrobe!`, 'success');
        onClose();
      } catch (err: any) {
        setStep('review');
        const msg = err.message || 'Failed to save item to wardrobe.';
        showToast(msg, 'info');
      }
    });
  };

  const originalImageUrl = activeItemId ? api.clothing.getOriginalImageUrl(activeItemId) : localPreviewUrl;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add to Wardrobe"
      subtitle="Single Photo AI Extraction · EfficientNet-B0 Multi-Task Classifier"
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Visual Progress Stepper */}
        <div className="bg-[#FAF6F0] dark:bg-[#201824] p-3 rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E]">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {/* Step 1: Upload */}
            <div
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[2px] font-medium transition-colors ${
                step === 'idle'
                  ? 'bg-[#29202B] text-[#F3EEE8] dark:bg-[#F3EEE8] dark:text-[#29202B] font-semibold shadow-xs'
                  : 'text-[#777078] dark:text-[#D5A6A0]'
              }`}
            >
              {step !== 'idle' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              ) : (
                <Upload className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="truncate uppercase tracking-[0.1em] text-[10px]">1. Select Photo</span>
            </div>

            {/* Step 2: AI Analysis */}
            <div
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[2px] font-medium transition-colors ${
                step === 'analyzing'
                  ? 'bg-[#29202B] text-[#F3EEE8] dark:bg-[#F3EEE8] dark:text-[#29202B] font-semibold shadow-xs'
                  : step === 'review' || step === 'saving'
                  ? 'text-[#777078] dark:text-[#D5A6A0]'
                  : 'text-[#777078]/50 dark:text-[#D5A6A0]/40'
              }`}
            >
              {step === 'analyzing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              ) : step === 'review' || step === 'saving' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="truncate uppercase tracking-[0.1em] text-[10px]">2. AI Analysis</span>
            </div>

            {/* Step 3: Review Attributes */}
            <div
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[2px] font-medium transition-colors ${
                step === 'review' || step === 'saving'
                  ? 'bg-[#29202B] text-[#F3EEE8] dark:bg-[#F3EEE8] dark:text-[#29202B] font-semibold shadow-xs'
                  : 'text-[#777078]/50 dark:text-[#D5A6A0]/40'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate uppercase tracking-[0.1em] text-[10px]">3. Review & Save</span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* STEP 1: INITIAL PHOTO UPLOAD DROPZONE */}
        {/* ------------------------------------------------------------- */}
        {step === 'idle' && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChosen(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49] dark:hover:border-[#D5A6A0] rounded-[3px] p-8 sm:p-12 text-center cursor-pointer transition-all bg-[#FAF6F0]/50 dark:bg-[#201824]/50 hover:bg-[#FAF6F0] dark:hover:bg-[#201824] group"
            >
              <div className="w-16 h-16 rounded-[2px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] group-hover:scale-105 flex items-center justify-center mx-auto mb-4 text-[#743C49] dark:text-[#D5A6A0] transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-xl sm:text-2xl text-[#29202B] dark:text-[#F3EEE8] mb-1">
                Upload clothing photo
              </h3>
              <p className="text-xs sm:text-sm text-[#777078] dark:text-[#DCD4CC] max-w-sm mx-auto mb-4 font-sans leading-relaxed">
                Drag and drop your garment photo here, or click to browse. Flat-lay, hanger, or worn photos supported.
              </p>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[2px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] text-[10px] uppercase tracking-[0.08em] font-medium text-[#29202B] dark:text-[#F3EEE8]">
                <Sparkles className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
                EfficientNet-B0 extracts 9 fashion attributes directly from photo
              </div>
            </div>

            {/* Camera / Action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => cameraInputRef.current?.click()}
                icon={<Camera className="w-4 h-4" />}
                className="flex-1 sm:flex-initial rounded-[2px] border-[#DCD4CC] dark:border-[#392F3E] uppercase tracking-[0.1em] text-xs"
              >
                Take Photo
              </Button>

              {onSwitchToBatch && (
                <button
                  type="button"
                  onClick={onSwitchToBatch}
                  className="text-xs font-semibold uppercase tracking-[0.1em] text-[#743C49] dark:text-[#D5A6A0] hover:underline"
                >
                  Upload multiple items together
                </button>
              )}
            </div>

            {/* Hidden native file pickers */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/avif"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChosen(e.target.files[0]);
                }
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChosen(e.target.files[0]);
                }
              }}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 2: ANALYZING SPINNER */}
        {/* ------------------------------------------------------------- */}
        {step === 'analyzing' && (
          <div className="text-center py-12 px-4 space-y-4">
            <div className="relative w-20 h-20 mx-auto">
              {localPreviewUrl ? (
                <img
                  src={localPreviewUrl}
                  alt="Analyzing preview"
                  className="w-20 h-20 rounded-[3px] object-cover border border-[#DCD4CC] dark:border-[#392F3E] opacity-60"
                />
              ) : (
                <div className="w-20 h-20 rounded-[3px] bg-[#FAF6F0] dark:bg-[#201824] flex items-center justify-center">
                  <Shirt className="w-10 h-10 text-[#777078]" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#743C49] dark:text-[#D5A6A0] animate-spin" />
              </div>
            </div>

            <div>
              <h3 className="font-serif text-lg text-[#29202B] dark:text-[#F3EEE8]">
                Analyzing image...
              </h3>
              <p className="text-xs text-[#777078] dark:text-[#DCD4CC] mt-1 max-w-sm mx-auto font-sans">
                Running Multi-Task EfficientNet-B0 to extract garment identification, appearance, and catalog context.
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP FAILED NOTICE */}
        {/* ------------------------------------------------------------- */}
        {step === 'failed' && (
          <div className="p-5 rounded-[3px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-center space-y-3">
            <div className="w-10 h-10 rounded-[2px] bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif text-base text-rose-900 dark:text-rose-200">
                Upload or Analysis Failed
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                {errorMessage || 'An error occurred during processing. Please try again with a clear photo.'}
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep('idle')}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                className="rounded-[2px] border-[#DCD4CC] uppercase tracking-[0.1em] text-xs"
              >
                Try Another Photo
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 3: ATTRIBUTE REVIEW & PERSISTENCE FORM */}
        {/* ------------------------------------------------------------- */}
        {(step === 'review' || step === 'saving') && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Column: Original Photograph Display & AI Confidence */}
            <div className="md:col-span-5 space-y-3.5">
              <div className="rounded-[3px] overflow-hidden border border-[#DCD4CC] dark:border-[#392F3E] bg-[#FAF6F0] dark:bg-[#201824] aspect-[3/4] relative shadow-xs group">
                {originalImageUrl ? (
                  <img
                    src={originalImageUrl}
                    alt={name || 'Uploaded Garment'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#777078]">
                    <Shirt className="w-12 h-12" />
                  </div>
                )}

                <div className="absolute top-2.5 left-2.5">
                  <span className="text-[10px] uppercase font-mono font-semibold tracking-wider px-2 py-0.5 rounded-[2px] bg-[#29202B]/85 text-white backdrop-blur-xs">
                    Original Photo
                  </span>
                </div>
              </div>

              {/* Photo Metadata / Classifier Advisory */}
              <div className="p-3.5 rounded-[3px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                  <span className="flex items-center gap-1.5 font-sans">
                    <Sparkles className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
                    EfficientNet-B0
                  </span>
                  {rawPrediction?.category_score !== undefined && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[2px] bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400 border border-[#426B50]/20">
                      {Math.round(rawPrediction.category_score * 100)}% Confidence
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#6D7068] dark:text-[#A89E9B] leading-relaxed">
                  9 multi-task fashion attributes extracted directly from your photo. Edits will refine your wardrobe intelligence and recommendations.
                </p>
                <div className="flex items-center justify-between text-[10px] font-mono text-[#777078] dark:text-[#D5A6A0] pt-2 border-t border-[#DCD4CC]/60 dark:border-[#392F3E]/60">
                  <span>9 ATTRIBUTE HEADS</span>
                  <span className="text-[#426B50] dark:text-emerald-400 font-semibold">PREDICTIONS READY</span>
                </div>
              </div>
            </div>

            {/* Right Column: 9 AI-Extracted Attributes Grouped Sensibly */}
            <div className="md:col-span-7 space-y-5">
              {/* Basic Name & Brand Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-4 border-b border-[#DCD4CC] dark:border-[#392F3E]">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#6D7068] dark:text-[#A89E9B]">
                    Garment Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      markEdited('name');
                    }}
                    placeholder="e.g. Navy Oxford Cotton Shirt"
                    className="w-full bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-3.5 py-2 text-xs sm:text-sm text-[#29202B] dark:text-[#F3EEE8] min-h-[40px] focus:outline-none focus:border-[#743C49] focus:ring-1 focus:ring-[#743C49] transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#6D7068] dark:text-[#A89E9B]">
                    Brand (Optional)
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      markEdited('brand');
                    }}
                    placeholder="e.g. Zara, Uniqlo, Levi's"
                    className="w-full bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-3.5 py-2 text-xs sm:text-sm text-[#29202B] dark:text-[#F3EEE8] min-h-[40px] focus:outline-none focus:border-[#743C49] focus:ring-1 focus:ring-[#743C49] transition-colors"
                  />
                </div>
              </div>

              {/* ----------------------------------------------------------- */}
              {/* GROUP 1: GARMENT IDENTIFICATION */}
              {/* ----------------------------------------------------------- */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#DCD4CC] dark:border-[#392F3E]">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
                    <h4 className="font-serif text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                      1. Garment Identification
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-[#6D7068] dark:text-[#A89E9B]">
                    Primary Anatomy
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Article Type (142 classes) */}
                  <SearchableCombobox
                    label="Article Type"
                    value={articleType}
                    options={classOptions.article_type || []}
                    onChange={(val) => {
                      setArticleType(val);
                      markEdited('article_type');
                    }}
                    confidence={getFieldMeta('article_type').confidence}
                    reviewRequired={getFieldMeta('article_type').reviewRequired}
                    isEdited={editedFields.has('article_type')}
                    alternatives={getFieldMeta('article_type').alternatives}
                    placeholder="Select article type..."
                    required
                  />

                  {/* Subcategory (45 classes) */}
                  <SearchableCombobox
                    label="Subcategory"
                    value={subCategory}
                    options={classOptions.sub_category || []}
                    onChange={(val) => {
                      setSubCategory(val);
                      markEdited('sub_category');
                    }}
                    confidence={getFieldMeta('sub_category').confidence}
                    reviewRequired={getFieldMeta('sub_category').reviewRequired}
                    isEdited={editedFields.has('sub_category')}
                    alternatives={getFieldMeta('sub_category').alternatives}
                    placeholder="Select subcategory..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Master Category (7 classes) */}
                  <SearchableCombobox
                    label="Master Category"
                    value={masterCategory}
                    options={classOptions.master_category || []}
                    onChange={(val) => {
                      setMasterCategory(val);
                      markEdited('master_category');
                    }}
                    confidence={getFieldMeta('master_category').confidence}
                    reviewRequired={getFieldMeta('master_category').reviewRequired}
                    isEdited={editedFields.has('master_category')}
                    alternatives={getFieldMeta('master_category').alternatives}
                    placeholder="Select category..."
                    required
                  />
                </div>
              </div>

              {/* ----------------------------------------------------------- */}
              {/* GROUP 2: APPEARANCE */}
              {/* ----------------------------------------------------------- */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#DCD4CC] dark:border-[#392F3E]">
                  <div className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
                    <h4 className="font-serif text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                      2. Appearance
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-[#6D7068] dark:text-[#A89E9B]">
                    Visual Aesthetics
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Base Colour (46 classes) */}
                  <SearchableCombobox
                    label="Base Colour"
                    value={baseColour}
                    options={classOptions.base_colour || []}
                    onChange={(val) => {
                      setBaseColour(val);
                      markEdited('base_colour');
                    }}
                    confidence={getFieldMeta('base_colour').confidence}
                    reviewRequired={getFieldMeta('base_colour').reviewRequired}
                    isEdited={editedFields.has('base_colour')}
                    alternatives={getFieldMeta('base_colour').alternatives}
                    placeholder="Select base colour..."
                    required
                  />

                  {/* Pattern (16 classes) */}
                  <SearchableCombobox
                    label="Pattern"
                    value={pattern}
                    options={classOptions.pattern || []}
                    onChange={(val) => {
                      setPattern(val);
                      markEdited('pattern');
                    }}
                    confidence={getFieldMeta('pattern').confidence}
                    reviewRequired={getFieldMeta('pattern').reviewRequired}
                    isEdited={editedFields.has('pattern')}
                    alternatives={getFieldMeta('pattern').alternatives}
                    placeholder="Select pattern..."
                    required
                  />
                </div>
              </div>

              {/* ----------------------------------------------------------- */}
              {/* GROUP 3: CATALOG CONTEXT */}
              {/* ----------------------------------------------------------- */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#DCD4CC] dark:border-[#392F3E]">
                  <div className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
                    <h4 className="font-serif text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                      3. Catalog Context & Styling
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-[#6D7068] dark:text-[#A89E9B]">
                    Styling Context
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Gender (5 classes) */}
                  <SearchableCombobox
                    label="Gender"
                    value={gender}
                    options={classOptions.gender || []}
                    onChange={(val) => {
                      setGender(val);
                      markEdited('gender');
                    }}
                    confidence={getFieldMeta('gender').confidence}
                    reviewRequired={getFieldMeta('gender').reviewRequired}
                    isEdited={editedFields.has('gender')}
                    alternatives={getFieldMeta('gender').alternatives}
                    placeholder="Select gender..."
                  />

                  {/* Age Group (6 classes) */}
                  <SearchableCombobox
                    label="Age Group"
                    value={ageGroup}
                    options={classOptions.age_group || []}
                    onChange={(val) => {
                      setAgeGroup(val);
                      markEdited('age_group');
                    }}
                    confidence={getFieldMeta('age_group').confidence}
                    reviewRequired={getFieldMeta('age_group').reviewRequired}
                    isEdited={editedFields.has('age_group')}
                    alternatives={getFieldMeta('age_group').alternatives}
                    placeholder="Select age group..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Season (4 classes) */}
                  <SearchableCombobox
                    label="Season"
                    value={season}
                    options={classOptions.season || []}
                    onChange={(val) => {
                      setSeason(val);
                      markEdited('season');
                    }}
                    confidence={getFieldMeta('season').confidence}
                    reviewRequired={getFieldMeta('season').reviewRequired}
                    isEdited={editedFields.has('season')}
                    alternatives={getFieldMeta('season').alternatives}
                    placeholder="Select season..."
                  />

                  {/* Usage (8 classes) */}
                  <SearchableCombobox
                    label="Usage"
                    value={usage}
                    options={classOptions.usage || []}
                    onChange={(val) => {
                      setUsage(val);
                      markEdited('usage');
                    }}
                    confidence={getFieldMeta('usage').confidence}
                    reviewRequired={getFieldMeta('usage').reviewRequired}
                    isEdited={editedFields.has('usage')}
                    alternatives={getFieldMeta('usage').alternatives}
                    placeholder="Select usage..."
                  />
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-4 border-t border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={onClose}
                  disabled={isSaving || step === 'saving'}
                  className="rounded-[2px] border-[#DCD4CC] uppercase tracking-[0.12em] text-xs font-mono"
                >
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSaveToWardrobe}
                  isLoading={isSaving || step === 'saving'}
                  loadingText="Saving to Wardrobe..."
                  disabled={!activeItemId}
                  icon={<Check className="w-4 h-4" />}
                  className="rounded-[2px] bg-[#743C49] hover:bg-[#5b2f3a] text-white uppercase tracking-[0.14em] text-xs font-semibold shadow-xs"
                >
                  Save to Wardrobe
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
