import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Camera,
  Shirt,
  Sparkles,
  SlidersHorizontal,
  Check,
  RefreshCw,
  AlertCircle,
  Eye,
  CheckCircle2,
  Loader2,
  Tag,
  Palette,
  Sliders,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  ProcessingStage,
  GarmentProcessingStatus,
  ClothingPrediction,
  ClothingAttributesData,
} from '../../types';

interface AddClothingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Taxonomy Definitions for Progressive Disclosure
const TAXONOMY_GROUPS = [
  { id: 'western', label: 'Western' },
  { id: 'indian', label: 'Indian Ethnic' },
  { id: 'footwear', label: 'Footwear' },
  { id: 'accessories', label: 'Accessories' },
];

const CATEGORIES_BY_GROUP: Record<string, { id: string; label: string }[]> = {
  western: [
    { id: 'shirt', label: 'Shirt' },
    { id: 't_shirt', label: 'T-Shirt' },
    { id: 'jeans', label: 'Jeans' },
    { id: 'pants', label: 'Pants / Trousers' },
    { id: 'skirt', label: 'Skirt' },
    { id: 'western_dress', label: 'Western Dress' },
    { id: 'jacket', label: 'Jacket' },
    { id: 'blazer', label: 'Blazer' },
  ],
  indian: [
    { id: 'saree', label: 'Saree' },
    { id: 'blouse', label: 'Saree Blouse / Choli' },
    { id: 'kurta', label: 'Kurta' },
    { id: 'kurti', label: 'Kurti' },
    { id: 'salwar', label: 'Salwar' },
    { id: 'churidar', label: 'Churidar' },
    { id: 'lehenga', label: 'Lehenga' },
    { id: 'sherwani', label: 'Sherwani' },
    { id: 'dupatta', label: 'Dupatta' },
  ],
  footwear: [
    { id: 'sneakers', label: 'Sneakers' },
    { id: 'sandals', label: 'Sandals' },
    { id: 'heels', label: 'Heels' },
    { id: 'flats', label: 'Flats' },
    { id: 'formal_shoes', label: 'Formal Shoes' },
    { id: 'boots', label: 'Boots' },
  ],
  accessories: [
    { id: 'handbag', label: 'Handbag' },
    { id: 'backpack', label: 'Backpack' },
    { id: 'belt', label: 'Belt' },
    { id: 'watch', label: 'Watch' },
    { id: 'scarf', label: 'Scarf' },
    { id: 'other_accessory', label: 'Other Accessory' },
  ],
};

const PATTERNS = [
  'solid',
  'striped',
  'plaid_check',
  'floral',
  'printed',
  'abstract',
  'textured',
  'polka_dot',
  'geometric',
  'tie_dye',
  'embroidered',
];

const STYLES = [
  'casual',
  'formal',
  'semi_formal',
  'ethnic',
  'streetwear',
  'party',
  'loungewear',
  'business_casual',
];

const SEASONS = ['all_season', 'summer', 'winter', 'monsoon', 'spring', 'autumn'];

const OCCASIONS = [
  'casual',
  'work',
  'evening',
  'festive',
  'party',
  'wedding',
  'sports',
  'everyday',
];

const FABRICS = [
  'cotton',
  'silk',
  'denim',
  'linen',
  'wool',
  'polyester',
  'chiffon',
  'georgette',
  'velvet',
  'leather',
  'satin',
  'rayon',
  'lace',
  'unknown',
];

const STAGES_SEQUENCE: { stage: ProcessingStage; label: string; desc: string }[] = [
  { stage: 'uploaded', label: 'Photo Uploaded', desc: 'Securely saved in PostgreSQL BYTEA' },
  { stage: 'queued', label: 'Queued', desc: 'Dispatched to CPU processing worker' },
  { stage: 'analyzing_clothing', label: 'Analyzing Garment', desc: 'Detecting category, colors & boundaries' },
  { stage: 'removing_background', label: 'Removing Background', desc: 'Segmenting garment & suppressing human skin' },
  { stage: 'preparing_catalog_image', label: 'Catalog Composition', desc: 'Centering on neutral white with 15% margin' },
  { stage: 'understanding_garment', label: 'AI Understanding', desc: 'Category and attribute extraction' },
  { stage: 'ready_for_review', label: 'Ready for Review', desc: 'AI classification complete' },
];

export const AddClothingModal: React.FC<AddClothingModalProps> = ({ isOpen, onClose }) => {
  const { refreshData, showToast } = useApp();

  // Basic info states
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');

  // Structured taxonomy attributes
  const [taxonomyGroup, setTaxonomyGroup] = useState<string>('western');
  const [category, setCategory] = useState<string>('shirt');
  const [primaryColor, setPrimaryColor] = useState<string>('White');
  const [secondaryColor, setSecondaryColor] = useState<string>('');
  const [pattern, setPattern] = useState<string>('solid');
  const [style, setStyle] = useState<string>('casual');
  const [season, setSeason] = useState<string>('all_season');
  const [occasion, setOccasion] = useState<string>('casual');
  const [fabric, setFabric] = useState<string>('cotton');
  const [formality, setFormality] = useState<number>(0.5);
  const [categorySpecific, setCategorySpecific] = useState<Record<string, any>>({});

  // AI Prediction & Audit Trail states
  const [prediction, setPrediction] = useState<ClothingPrediction | null>(null);
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());
  const [isFabricUncertain, setIsFabricUncertain] = useState<boolean>(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<GarmentProcessingStatus | null>(null);
  const [currentStage, setCurrentStage] = useState<ProcessingStage | 'idle'>('idle');
  const [isUploading, setIsUploading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Comparison slider view ('slider' | 'processed' | 'original')
  const [viewMode, setViewMode] = useState<'slider' | 'processed' | 'original'>('slider');
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Reset when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setBrand('');
      setNotes('');
      setTaxonomyGroup('western');
      setCategory('shirt');
      setPrimaryColor('White');
      setSecondaryColor('');
      setPattern('solid');
      setStyle('casual');
      setSeason('all_season');
      setOccasion('casual');
      setFabric('cotton');
      setFormality(0.5);
      setCategorySpecific({});
      setPrediction(null);
      setEditedFields(new Set());
      setIsFabricUncertain(false);
      setActiveItemId(null);
      setProcessingStatus(null);
      setCurrentStage('idle');
      setIsUploading(false);
      setIsActionLoading(false);
      setIsReanalyzing(false);
      setIsRetrying(false);
      setErrorMessage(null);
      setSliderPosition(50);
      setViewMode('slider');
    }
  }, [isOpen]);

  // Load predictions and current attributes from backend
  const loadAttributesAndPredictions = async (itemId: string) => {
    try {
      const data: ClothingAttributesData = await api.clothing.getAttributes(itemId);
      const attrs = data.current_attributes;
      const pred = data.original_prediction;

      if (pred) {
        setPrediction(pred);
        setIsFabricUncertain(Boolean(pred.prediction_scores?.fabric_uncertain));
      }

      if (attrs) {
        if (attrs.category_group) setTaxonomyGroup(attrs.category_group);
        if (attrs.category) setCategory(attrs.category);
        if (attrs.primary_color) setPrimaryColor(attrs.primary_color);
        if (attrs.secondary_color) setSecondaryColor(attrs.secondary_color);
        if (attrs.pattern) setPattern(attrs.pattern);
        if (attrs.style) setStyle(attrs.style);
        if (attrs.season) setSeason(attrs.season);
        if (attrs.occasion) setOccasion(attrs.occasion);
        if (attrs.fabric) setFabric(attrs.fabric);
        if (attrs.formality !== undefined) setFormality(attrs.formality);
        if (attrs.brand) setBrand(attrs.brand);
        if (attrs.category_specific) setCategorySpecific(attrs.category_specific);

        // Auto-generate name if empty
        if (!name.trim()) {
          const catLabel = attrs.category_display || attrs.category || 'Piece';
          setName(`${attrs.primary_color || ''} ${catLabel}`.trim());
        }
      }
    } catch (err: any) {
      console.warn('Failed to load attributes:', err);
    }
  };

  // Retry background garment processing
  const handleRetryProcessing = async () => {
    if (!activeItemId) return;
    setIsRetrying(true);
    setErrorMessage(null);
    setCurrentStage('queued');
    try {
      await api.clothing.retryProcessing(activeItemId);
      showToast('Retrying garment processing...', 'info');
    } catch (err: any) {
      setErrorMessage(err.message || 'Retry failed');
      showToast(err.message || 'Retry failed', 'info');
    } finally {
      setIsRetrying(false);
    }
  };

  // Polling hook for processing status (2s interval, stops at terminal states)
  useEffect(() => {
    if (
      !activeItemId ||
      currentStage === 'ready_for_review' ||
      currentStage === 'completed' ||
      currentStage === 'failed'
    ) {
      return;
    }

    let isMounted = true;
    let pollCount = 0;
    const interval = setInterval(async () => {
      try {
        pollCount += 1;
        const status = await api.clothing.getProcessingStatus(activeItemId);
        if (!isMounted) return;

        setProcessingStatus(status);
        if (status.stage) {
          setCurrentStage(status.stage as ProcessingStage);
        }

        // Terminal state: failed
        if (status.status === 'failed') {
          setErrorMessage(status.errorMessage || 'Image processing failed.');
          setCurrentStage('failed');
          clearInterval(interval);
          return;
        }

        // Terminal state: completed or ready_for_review
        if (status.stage === 'ready_for_review' || status.status === 'completed') {
          clearInterval(interval);
          await loadAttributesAndPredictions(activeItemId);
          return;
        }

        // Timeout advisory after 50 seconds (25 polls * 2000ms)
        if (pollCount > 25) {
          setErrorMessage('Processing is taking longer than usual. You can wait or retry.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Status poll warning:', err);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeItemId, currentStage]);

  // Handle file selection (Gallery or Camera)
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

    setIsUploading(true);
    setErrorMessage(null);
    setCurrentStage('uploaded');

    try {
      const res = await api.clothing.upload(file, {
        name: name.trim() || undefined,
        category,
        color: primaryColor,
        pattern,
        brand: brand.trim() || undefined,
        season,
        occasion: style,
        description: notes.trim() || undefined,
      });

      setActiveItemId(res.itemId);
      setCurrentStage('queued');
      showToast('Photo uploaded! AI background removal and understanding in progress...', 'info');
    } catch (err: any) {
      setCurrentStage('failed');
      const msg = err.message || 'Failed to upload photo';
      setErrorMessage(msg);
      showToast(msg, 'info');
    } finally {
      setIsUploading(false);
    }
  };

  // Helper to mark field as user-edited
  const markEdited = (fieldName: string) => {
    setEditedFields((prev) => new Set(prev).add(fieldName));
  };

  // Select alternative category
  const selectAlternativeCategory = (altCategory: string) => {
    setCategory(altCategory);
    markEdited('category');
    // Find taxonomy group
    for (const [grp, cats] of Object.entries(CATEGORIES_BY_GROUP)) {
      if (cats.some((c) => c.id === altCategory)) {
        setTaxonomyGroup(grp);
        break;
      }
    }
  };

  // Reanalyze garment with AI
  const handleReanalyze = async () => {
    if (!activeItemId) return;
    setIsReanalyzing(true);
    try {
      const res = await api.clothing.reanalyze(activeItemId);
      if (res.prediction) {
        setPrediction(res.prediction);
        setIsFabricUncertain(Boolean(res.prediction.prediction_scores?.fabric_uncertain));
        await loadAttributesAndPredictions(activeItemId);
        showToast('Garment reanalyzed with latest AI predictions!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Reanalysis failed', 'info');
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Finalize clothing piece and add to wardrobe
  const handleFinalize = async (acceptImage: boolean = true) => {
    if (!activeItemId) return;
    setIsActionLoading(true);

    try {
      // 1. Accept or reject catalog image
      if (acceptImage) {
        await api.clothing.acceptImage(activeItemId);
      } else {
        await api.clothing.rejectImage(activeItemId);
      }

      // 2. Prepare verified attributes payload
      const verifiedAttrs = {
        name: name.trim() || `${primaryColor} ${category}`,
        category,
        category_group: taxonomyGroup,
        primary_color: primaryColor,
        secondary_color: secondaryColor || null,
        pattern,
        style,
        season,
        occasion,
        formality,
        fabric,
        brand: brand.trim() || null,
        category_specific: categorySpecific,
      };

      // 3. Finalize on backend (stores user corrections and verified properties)
      await api.clothing.finalize(activeItemId, verifiedAttrs);
      await refreshData();

      showToast(`"${verifiedAttrs.name}" added to your wardrobe!`, 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Could not finalize garment', 'info');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Interactive slider mouse & touch handlers
  const handleSliderMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const originalImageUrl = activeItemId ? api.clothing.getOriginalImageUrl(activeItemId) : null;
  const processedImageUrl =
    activeItemId && processingStatus?.isProcessedAvailable
      ? api.clothing.getProcessedImageUrl(activeItemId)
      : null;

  const normalizedStage = currentStage === 'claimed_by_worker' ? 'queued' : currentStage;
  const currentStageIndex = STAGES_SEQUENCE.findIndex((s) => s.stage === normalizedStage);
  const isProcessingActive =
    currentStage !== 'idle' &&
    currentStage !== 'ready_for_review' &&
    currentStage !== 'completed' &&
    currentStage !== 'failed';

  // Formality descriptive text
  const getFormalityLabel = (val: number) => {
    if (val < 0.25) return 'Casual / Everyday';
    if (val < 0.50) return 'Smart Casual / Daywear';
    if (val < 0.75) return 'Semi-Formal / Professional';
    return 'Formal / Festive / Black Tie';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add to Digital Wardrobe"
      subtitle="AI-powered background removal, classification & attribute extraction"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Hidden inputs for gallery & camera */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileChosen(file);
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileChosen(file);
          }}
        />

        {/* STEP 1: INITIAL UPLOAD OR CAMERA CAPTURE */}
        {currentStage === 'idle' && (
          <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/80 transition-all">
            <div className="w-14 h-14 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 mb-4 shadow-sm border border-zinc-200 dark:border-zinc-700">
              <Shirt className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Upload Garment Photo
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Works with flat-lays, hanger shots, worn outfits, and mirror selfies.
              Our on-device CPU model removes background clutter, suppresses skin, and extracts structured fashion attributes (Western, Indian, Footwear & Accessories).
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <Button
                variant="primary"
                size="md"
                onClick={() => fileInputRef.current?.click()}
                icon={<Upload className="w-4 h-4" />}
                className="min-h-[44px]"
              >
                Choose from Gallery
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => cameraInputRef.current?.click()}
                icon={<Camera className="w-4 h-4" />}
                className="min-h-[44px]"
              >
                Take Camera Photo
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: ACTIVE PROCESSING STATUS PROGRESS */}
        {isProcessingActive && (
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">
                  AI Image Processing
                </span>
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  Analyzing & Formatting Garment
                </h4>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-900 dark:text-zinc-100" />
                <span>Running on CPU</span>
              </div>
            </div>

            {/* Stepper list */}
            <div className="space-y-3">
              {STAGES_SEQUENCE.map((s, idx) => {
                const isPassed = currentStageIndex > idx;
                const isCurrent = currentStageIndex === idx;
                return (
                  <div
                    key={s.stage}
                    className={`flex items-start gap-3 p-2.5 rounded-lg transition-all ${
                      isCurrent
                        ? 'bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700'
                        : 'opacity-70'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-semibold ${
                          isCurrent
                            ? 'text-zinc-900 dark:text-zinc-100'
                            : isPassed
                            ? 'text-zinc-700 dark:text-zinc-300'
                            : 'text-zinc-400'
                        }`}
                      >
                        {s.label}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {errorMessage && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryProcessing}
                  disabled={isRetrying}
                  icon={<RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />}
                  className="flex-shrink-0"
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2.5: FAILED STATE */}
        {currentStage === 'failed' && (
          <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-red-900 dark:text-red-200">Processing Issue</h4>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1 max-w-sm mx-auto">
                {errorMessage || 'We were unable to isolate and format this garment photograph.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleRetryProcessing}
                disabled={isRetrying}
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />}
              >
                Retry Processing
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentStage('idle');
                  setErrorMessage(null);
                  setActiveItemId(null);
                }}
              >
                Upload Different Photo
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: COMPARISON REVIEW & AI ATTRIBUTE EXTRACTION */}
        {(currentStage === 'ready_for_review' || currentStage === 'completed') && (
          <div className="space-y-6">
            {/* View Mode Tabs */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('slider')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    viewMode === 'slider'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 inline mr-1" />
                  Split Slider
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('processed')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    viewMode === 'processed'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
                  Clean Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('original')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    viewMode === 'original'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 inline mr-1" />
                  Original
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReanalyze}
                  disabled={isReanalyzing}
                  icon={<RefreshCw className={`w-3.5 h-3.5 ${isReanalyzing ? 'animate-spin' : ''}`} />}
                >
                  Reanalyze AI
                </Button>
              </div>
            </div>

            {/* Interactive Image Container */}
            <div
              ref={containerRef}
              className="relative aspect-square max-h-[300px] mx-auto rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 select-none shadow-inner"
              onMouseDown={() => {
                isDraggingRef.current = true;
              }}
              onMouseMove={(e) => {
                if (isDraggingRef.current) handleSliderMove(e.clientX);
              }}
              onMouseUp={() => {
                isDraggingRef.current = false;
              }}
              onMouseLeave={() => {
                isDraggingRef.current = false;
              }}
              onTouchMove={(e) => {
                if (e.touches.length > 0) handleSliderMove(e.touches[0].clientX);
              }}
            >
              {/* Processed catalog image */}
              {(viewMode === 'slider' || viewMode === 'processed') && processedImageUrl && (
                <img
                  src={processedImageUrl}
                  alt="AI Clean Catalog"
                  className="absolute inset-0 w-full h-full object-contain p-4 bg-white"
                />
              )}

              {/* Original photo overlay */}
              {originalImageUrl && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{
                    width:
                      viewMode === 'slider'
                        ? `${sliderPosition}%`
                        : viewMode === 'original'
                        ? '100%'
                        : '0%',
                  }}
                >
                  <img
                    src={originalImageUrl}
                    alt="Original Upload"
                    className="absolute inset-0 w-full h-full object-contain p-2 max-w-none"
                    style={{
                      width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%',
                      height: '100%',
                    }}
                  />
                  {viewMode === 'slider' && (
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold">
                      Original Photo
                    </div>
                  )}
                </div>
              )}

              {viewMode === 'slider' && (
                <>
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-zinc-900 dark:bg-white shadow-lg pointer-events-none"
                    style={{ left: `${sliderPosition}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl flex items-center justify-center cursor-ew-resize border-2 border-white dark:border-zinc-900 pointer-events-none"
                    style={{ left: `${sliderPosition}%` }}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 rotate-90" />
                  </div>
                  <div className="absolute top-3 right-3 bg-zinc-900/80 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold">
                    Catalog Garment
                  </div>
                </>
              )}
            </div>

            {/* AI PREDICTION BANNER & ALTERNATIVES */}
            {prediction && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/70 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      AI Identified: {prediction.predicted_attributes?.category_display || prediction.predicted_category}
                    </span>
                    <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] px-2 py-0.5 rounded-full font-mono font-medium">
                      {Math.round(prediction.category_score * 100)}% match
                    </span>
                  </div>

                  <span className="text-[11px] text-zinc-400">
                    Source: {prediction.input_image_source === 'processed' ? 'Catalog Cut' : 'Original Photo'}
                  </span>
                </div>

                {/* Suggested Alternatives pills */}
                {prediction.category_alternatives && prediction.category_alternatives.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-zinc-500 font-medium">Or choose:</span>
                    {prediction.category_alternatives.map((alt) => (
                      <button
                        key={alt.category}
                        type="button"
                        onClick={() => selectAlternativeCategory(alt.category)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                          category === alt.category
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                        }`}
                      >
                        {alt.display_name} ({Math.round(alt.score * 100)}%)
                      </button>
                    ))}
                  </div>
                )}

                {/* Perceptual Color Palette extracted via CIELAB */}
                {prediction.color_palette && prediction.color_palette.length > 0 && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1.5">
                      <span className="font-semibold flex items-center gap-1">
                        <Palette className="w-3.5 h-3.5" /> CIELAB Foreground Colors:
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {prediction.color_palette.map((cp, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setPrimaryColor(cp.name);
                            markEdited('primary_color');
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:border-zinc-400 transition-colors shadow-sm"
                          title={`Click to set as primary color (${Math.round(cp.percentage * 100)}% of garment)`}
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-black/20"
                            style={{ backgroundColor: cp.hex }}
                          />
                          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {cp.name}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {Math.round(cp.percentage * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* EXPLICIT FABRIC UNCERTAINTY NOTICE */}
            {isFabricUncertain && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Visual Fabric Uncertainty</p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                    Fabric weaves can appear visually ambiguous in photographs. Please check the garment wash care label to select or verify the exact material.
                  </p>
                </div>
              </div>
            )}

            {/* PROGRESSIVE ATTRIBUTE REVIEW & CORRECTION FORM */}
            <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Structured Garment Attributes
                </h4>
                {editedFields.size > 0 && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    {editedFields.size} attribute{editedFields.size > 1 ? 's' : ''} corrected
                  </span>
                )}
              </div>

              {/* Garment Name and Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Piece Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Silk Banarasi Saree, Poplin Shirt"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      markEdited('name');
                    }}
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Brand / Designer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sabyasachi, Manyavar, Zara, COS"
                    value={brand}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      markEdited('brand');
                    }}
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              {/* Taxonomy Group Tabs */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Taxonomy Group
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TAXONOMY_GROUPS.map((grp) => (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => {
                        setTaxonomyGroup(grp.id);
                        const firstCat = CATEGORIES_BY_GROUP[grp.id][0].id;
                        setCategory(firstCat);
                        markEdited('category_group');
                      }}
                      className={`text-xs px-3 py-2 rounded-md border font-medium transition-all ${
                        taxonomyGroup === grp.id
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                          : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      {grp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Category {editedFields.has('category') && <span className="text-amber-500 text-[10px]">(Edited)</span>}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      markEdited('category');
                    }}
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer"
                  >
                    {(CATEGORIES_BY_GROUP[taxonomyGroup] || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Primary Color
                  </label>
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      markEdited('primary_color');
                    }}
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              {/* Pattern, Style, Season, Fabric */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Pattern
                  </label>
                  <select
                    value={pattern}
                    onChange={(e) => {
                      setPattern(e.target.value);
                      markEdited('pattern');
                    }}
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                  >
                    {PATTERNS.map((p) => (
                      <option key={p} value={p}>
                        {p.replace('_', ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Style
                  </label>
                  <select
                    value={style}
                    onChange={(e) => {
                      setStyle(e.target.value);
                      markEdited('style');
                    }}
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                  >
                    {STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace('_', ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Season
                  </label>
                  <select
                    value={season}
                    onChange={(e) => {
                      setSeason(e.target.value);
                      markEdited('season');
                    }}
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                  >
                    {SEASONS.map((sea) => (
                      <option key={sea} value={sea}>
                        {sea.replace('_', ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Fabric
                  </label>
                  <select
                    value={fabric}
                    onChange={(e) => {
                      setFabric(e.target.value);
                      markEdited('fabric');
                    }}
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                  >
                    {FABRICS.map((f) => (
                      <option key={f} value={f}>
                        {f.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Formality Index Slider */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                    Formality Score: <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{formality.toFixed(2)}</span>
                  </span>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    {getFormalityLabel(formality)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formality}
                  onChange={(e) => {
                    setFormality(parseFloat(e.target.value));
                    markEdited('formality');
                  }}
                  className="w-full accent-zinc-900 dark:accent-zinc-100 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-medium">
                  <span>0.00 (Ultra Casual)</span>
                  <span>0.50 (Smart Casual)</span>
                  <span>1.00 (Black Tie / Bridal)</span>
                </div>
              </div>

              {/* CATEGORY-SPECIFIC ATTRIBUTES */}
              {category === 'saree' && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Saree Specific Attributes
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-500 block mb-1">Border Type</span>
                      <select
                        value={categorySpecific.border_type || 'zari'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, border_type: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="zari">Zari</option>
                        <option value="contrast">Contrast</option>
                        <option value="embroidered">Embroidered</option>
                        <option value="printed">Printed</option>
                        <option value="minimal">Minimal</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-1">Pallu Design</span>
                      <select
                        value={categorySpecific.pallu_design || 'heavy_zari'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, pallu_design: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="heavy_zari">Heavy Zari</option>
                        <option value="printed">Printed</option>
                        <option value="striped">Striped</option>
                        <option value="simple">Simple</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-1">Weave Type</span>
                      <select
                        value={categorySpecific.weave_type || 'banarasi'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, weave_type: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="banarasi">Banarasi</option>
                        <option value="kanjeevaram">Kanjeevaram</option>
                        <option value="chanderi">Chanderi</option>
                        <option value="cotton">Cotton</option>
                        <option value="silk_blend">Silk Blend</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-1">Embroidery Work</span>
                      <select
                        value={categorySpecific.embroidery_work || 'zari'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, embroidery_work: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="zari">Zari</option>
                        <option value="threadwork">Threadwork</option>
                        <option value="sequins">Sequins</option>
                        <option value="mirror_work">Mirror Work</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {(category === 'kurta' || category === 'kurti') && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    {category === 'kurta' ? 'Kurta' : 'Kurti'} Details
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-500 block mb-1">Length</span>
                      <select
                        value={categorySpecific.length || 'knee_length'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, length: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="short">Short</option>
                        <option value="knee_length">Knee Length</option>
                        <option value="calf_length">Calf Length</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-1">Neckline</span>
                      <select
                        value={categorySpecific.neckline || 'mandarin_collar'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, neckline: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="mandarin_collar">Mandarin Collar</option>
                        <option value="round_neck">Round Neck</option>
                        <option value="v_neck">V-Neck</option>
                        <option value="boat_neck">Boat Neck</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-1">Sleeves</span>
                      <select
                        value={categorySpecific.sleeve_length || 'full'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, sleeve_length: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="full">Full Sleeves</option>
                        <option value="three_quarter">3/4 Sleeves</option>
                        <option value="short">Short Sleeves</option>
                        <option value="sleeveless">Sleeveless</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-1">Fit</span>
                      <select
                        value={categorySpecific.fit_type || 'straight'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, fit_type: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="straight">Straight</option>
                        <option value="anarkali">Anarkali</option>
                        <option value="a_line">A-Line</option>
                        <option value="regular">Regular</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {(category === 'shirt' || category === 't_shirt') && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    {category === 'shirt' ? 'Shirt' : 'T-Shirt'} Fit & Collar
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-500 block mb-1">Collar Style</span>
                      <select
                        value={categorySpecific.collar_style || (category === 't_shirt' ? 'crew_neck' : 'classic_collar')}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, collar_style: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="classic_collar">Classic Collar</option>
                        <option value="button_down">Button-Down</option>
                        <option value="mandarin_collar">Mandarin Collar</option>
                        <option value="crew_neck">Crew Neck</option>
                        <option value="v_neck">V-Neck</option>
                        <option value="polo_collar">Polo Collar</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-1">Sleeve Length</span>
                      <select
                        value={categorySpecific.sleeve_length || (category === 't_shirt' ? 'short' : 'long')}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, sleeve_length: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="short">Short Sleeves</option>
                        <option value="long">Long Sleeves</option>
                        <option value="sleeveless">Sleeveless</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-1">Fit</span>
                      <select
                        value={categorySpecific.fit_type || 'regular'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, fit_type: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="slim">Slim Fit</option>
                        <option value="regular">Regular Fit</option>
                        <option value="relaxed">Relaxed</option>
                        <option value="oversized">Oversized</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {(category === 'jeans' || category === 'pants') && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Trousers / Jeans Fit
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-500 block mb-1">Fit Type</span>
                      <select
                        value={categorySpecific.fit_type || 'slim'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, fit_type: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="skinny">Skinny</option>
                        <option value="slim">Slim</option>
                        <option value="regular">Straight / Regular</option>
                        <option value="relaxed">Relaxed</option>
                        <option value="wide_leg">Wide Leg</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-1">Waist Rise</span>
                      <select
                        value={categorySpecific.waist_style || 'mid_rise'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, waist_style: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="high_rise">High Rise</option>
                        <option value="mid_rise">Mid Rise</option>
                        <option value="low_rise">Low Rise</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-1">Length</span>
                      <select
                        value={categorySpecific.length || 'full_length'}
                        onChange={(e) => {
                          setCategorySpecific({ ...categorySpecific, length: e.target.value });
                          markEdited('category_specific');
                        }}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-1.5"
                      >
                        <option value="full_length">Full Length</option>
                        <option value="ankle_length">Ankle Length</option>
                        <option value="cropped">Cropped</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: FAILURE NOTICE */}
        {currentStage === 'failed' && (
          <div className="p-5 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/40 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <h4 className="text-sm font-bold text-red-900 dark:text-red-200">
              Processing Notice
            </h4>
            <p className="text-xs text-red-700 dark:text-red-300 max-w-sm mx-auto">
              {errorMessage || 'Segmentation encountered an issue. You can retry with CPU refinement or finalize with the original photo.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (activeItemId) {
                    setIsActionLoading(true);
                    try {
                      await api.clothing.retryProcessing(activeItemId);
                      setCurrentStage('queued');
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setIsActionLoading(false);
                    }
                  }
                }}
                disabled={isActionLoading}
              >
                Retry Segmentation
              </Button>
              {originalImageUrl && (
                <Button variant="primary" size="sm" onClick={() => handleFinalize(false)} disabled={isActionLoading}>
                  Keep Original Photo & Finalize
                </Button>
              )}
            </div>
          </div>
        )}

        {/* MODAL FOOTER ACTIONS */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            className="min-h-[44px]"
            disabled={isActionLoading}
          >
            Cancel
          </Button>

          {/* When ready for review, show Finalize button */}
          {(currentStage === 'ready_for_review' || currentStage === 'completed') ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => handleFinalize(false)}
                isLoading={isActionLoading}
                disabled={isActionLoading}
                className="min-h-[44px]"
              >
                Keep Original Photo
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => handleFinalize(true)}
                isLoading={isActionLoading}
                disabled={isActionLoading || !name.trim()}
                icon={<Sparkles className="w-4 h-4 text-amber-300" />}
                className="min-h-[44px]"
              >
                Finalize & Add to Wardrobe
              </Button>
            </>
          ) : currentStage === 'idle' ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              isLoading={isUploading}
              icon={<Upload className="w-4 h-4" />}
              className="min-h-[44px]"
            >
              Select Image
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
};
