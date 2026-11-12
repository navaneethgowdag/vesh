import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Check,
  Crown,
  Cpu,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableCombobox } from './SearchableCombobox';
import { api } from '../../services/api';
import { ClothingItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import defaultClassMappings from '../../data/classMappings.json';

interface ClothingReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ClothingItem[];
  initialIndex?: number;
  onItemAccepted?: (acceptedItem: ClothingItem) => void;
}

const FIT_OPTIONS = ['Regular', 'Slim', 'Relaxed', 'Oversized', 'Tailored', 'Skinny', 'Loose'];
const MATERIAL_OPTIONS = ['Cotton', 'Linen', 'Wool', 'Silk', 'Denim', 'Leather', 'Cashmere', 'Polyester', 'Rayon', 'Suede', 'Blend', 'Knit'];
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', 'Custom'];

export const ClothingReviewModal: React.FC<ClothingReviewModalProps> = ({
  isOpen,
  onClose,
  items,
  initialIndex = 0,
  onItemAccepted,
}) => {
  const { showToast, refreshData } = useApp();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [classOptions, setClassOptions] = useState<Record<string, string[]>>(defaultClassMappings);
  const [isLoadingAttributes, setIsLoadingAttributes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [attributesData, setAttributesData] = useState<any>(null);

  // Essential & Classification Form State
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [articleType, setArticleType] = useState('Shirts');
  const [masterCategory, setMasterCategory] = useState('Apparel');
  const [subCategory, setSubCategory] = useState('Topwear');
  const [baseColour, setBaseColour] = useState('Black');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [pattern, setPattern] = useState('Solid');
  const [gender, setGender] = useState('Unisex');
  const [season, setSeason] = useState('Summer');
  const [usage, setUsage] = useState('Casual');
  const [ageGroup, setAgeGroup] = useState('Adults-Unisex');

  // Additional Details State
  const [fit, setFit] = useState('Regular');
  const [material, setMaterial] = useState('Cotton');
  const [size, setSize] = useState('M');
  const [showAdditional, setShowAdditional] = useState(false);

  // Occasion Vault & Wardrobe Protection Attributes
  const [wearTier, setWearTier] = useState<'daily' | 'elevated' | 'luxury_special'>('daily');
  const [isLuxury, setIsLuxury] = useState<boolean>(false);
  const [careType, setCareType] = useState<'machine_wash' | 'hand_wash' | 'dry_clean_only' | 'delicate'>('machine_wash');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>('');
  const [wardrobeGroups, setWardrobeGroups] = useState<string[]>(['daily_work']);
  const [formalityScore, setFormalityScore] = useState<number>(0.4);

  // Track manual edits
  const [editedFields, setEditedFields] = useState<Record<string, boolean>>({});

  // System A: Track unconfirmed heads and training exclusion
  const [unconfirmedHeads, setUnconfirmedHeads] = useState<Record<string, boolean>>({});
  const [excludeFromTraining, setExcludeFromTraining] = useState<boolean>(false);

  const currentItem = items[currentIndex];

  const toggleUnconfirmed = (head: string) => {
    setUnconfirmedHeads((prev) => ({ ...prev, [head]: !prev[head] }));
  };

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(initialIndex, Math.max(0, items.length - 1)));
    }
  }, [isOpen, initialIndex, items.length]);

  // Load backend attribute options once
  useEffect(() => {
    api.clothing
      .getAttributeOptions()
      .then((opts) => {
        if (opts && Object.keys(opts).length > 0) {
          setClassOptions(opts);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch full prediction and attribute details for current garment
  useEffect(() => {
    if (!isOpen || !currentItem) return;

    let isSubscribed = true;
    setIsLoadingAttributes(true);
    setEditedFields({});

    api.clothing
      .getAttributes(currentItem.id)
      .then((attrs) => {
        if (!isSubscribed) return;
        setAttributesData(attrs);
        const cur = attrs.current_attributes || {};
        const pred = attrs.original_prediction?.predicted_attributes || {};

        setName(cur.name || currentItem.name || '');
        setBrand(cur.brand || currentItem.brand || '');
        setArticleType(cur.article_type || pred.article_type || currentItem.category || 'Shirts');
        setMasterCategory(cur.master_category || pred.master_category || 'Apparel');
        setSubCategory(cur.sub_category || pred.sub_category || 'Topwear');
        setBaseColour(cur.base_colour || cur.primary_color || currentItem.color || 'Black');
        setSecondaryColor(cur.secondary_color || currentItem.secondaryColor || currentItem.secondary_color || '');
        setPattern(cur.pattern || currentItem.pattern || 'Solid');
        setGender(cur.gender || pred.gender || 'Unisex');
        setSeason(cur.season || currentItem.season || 'Summer');
        setUsage(cur.usage || cur.occasion || (currentItem as any)?.occasion || 'Casual');
        setAgeGroup(cur.age_group || pred.age_group || 'Adults-Unisex');

        // Additional attributes
        setFit(cur.fit || currentItem.fit || 'Regular');
        setMaterial(cur.material || currentItem.material || 'Cotton');
        setSize(cur.size || currentItem.size || 'M');

        // Vault fields
        setWearTier(cur.wear_tier || currentItem.wearTier || currentItem.wear_tier || 'daily');
        setIsLuxury(Boolean(cur.is_luxury ?? currentItem.isLuxury ?? currentItem.is_luxury ?? false));
        setCareType(cur.care_type || currentItem.careType || currentItem.care_type || 'machine_wash');
        setPurchasePrice(cur.purchase_price ? String(cur.purchase_price) : currentItem.purchasePrice ? String(currentItem.purchasePrice) : '');
        setPurchaseDate(cur.purchase_date || currentItem.purchaseDate || currentItem.purchase_date || '');
        setWardrobeGroups(cur.wardrobe_groups || currentItem.wardrobeGroups || currentItem.wardrobe_groups || ['daily_work']);
        setFormalityScore(cur.formality ?? currentItem.formality ?? 0.4);
      })
      .catch((err) => {
        if (!isSubscribed) return;
        console.warn('Failed to load item attributes:', err);
        setName(currentItem.name || '');
        setBrand(currentItem.brand || '');
        setArticleType(currentItem.category || 'Shirts');
        setBaseColour(currentItem.color || 'Black');
        setPattern(currentItem.pattern || 'Solid');
        setSeason(currentItem.season || 'Summer');
        setUsage((currentItem as any)?.occasion || 'Casual');
        setFit(currentItem.fit || 'Regular');
        setMaterial(currentItem.material || 'Cotton');
        setSize(currentItem.size || 'M');
        setWearTier(currentItem.wearTier || currentItem.wear_tier || 'daily');
        setIsLuxury(Boolean(currentItem.isLuxury ?? currentItem.is_luxury ?? false));
        setCareType(currentItem.careType || currentItem.care_type || 'machine_wash');
        setPurchasePrice(currentItem.purchasePrice ? String(currentItem.purchasePrice) : '');
        setPurchaseDate(currentItem.purchaseDate || currentItem.purchase_date || '');
        setWardrobeGroups(currentItem.wardrobeGroups || currentItem.wardrobe_groups || ['daily_work']);
        setFormalityScore(currentItem.formality ?? 0.4);
      })
      .finally(() => {
        if (isSubscribed) setIsLoadingAttributes(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, currentItem?.id]);

  const markFieldEdited = (field: string) => {
    setEditedFields((prev) => ({ ...prev, [field]: true }));
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Re-run AI analysis
  const handleReanalyze = async () => {
    if (!currentItem) return;
    setIsReanalyzing(true);
    try {
      await api.clothing.reanalyze(currentItem.id);
      showToast('Re-analyzed garment with EfficientNet model.', 'success');
      const freshAttrs = await api.clothing.getAttributes(currentItem.id);
      setAttributesData(freshAttrs);
      const cur = freshAttrs.current_attributes || {};
      const pred = freshAttrs.original_prediction?.predicted_attributes || {};
      setArticleType(cur.article_type || pred.article_type || 'Shirts');
      setMasterCategory(cur.master_category || pred.master_category || 'Apparel');
      setSubCategory(cur.sub_category || pred.sub_category || 'Topwear');
      setBaseColour(cur.base_colour || cur.primary_color || 'Black');
      setPattern(cur.pattern || 'Solid');
      setGender(cur.gender || pred.gender || 'Unisex');
      setSeason(cur.season || 'Summer');
      setUsage(cur.usage || cur.occasion || 'Casual');
      setAgeGroup(cur.age_group || pred.age_group || 'Adults-Unisex');
      setEditedFields({});
    } catch (err: any) {
      showToast(err.message || 'Reanalysis failed.', 'info');
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Reject / Delete garment
  const handleReject = async () => {
    if (!currentItem) return;
    setIsSaving(true);
    try {
      await api.clothing.delete(currentItem.id);
      showToast('Garment rejected and removed from your wardrobe.', 'info');
      await refreshData();
      if (currentIndex < items.length - 1) {
        setCurrentIndex((prev) => prev);
      } else {
        onClose();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reject garment.', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm and Accept garment
  const handleAccept = async () => {
    if (!currentItem) return;
    setIsSaving(true);
    try {
      const garmentName = name.trim() || articleType;

      const verifiedAttributes: Record<string, any> = {
        name: garmentName,
        brand: brand.trim() || undefined,
        fit: fit,
        material: material,
        size: size,
        secondary_color: secondaryColor.trim() || undefined,
        // Classification heads
        article_type: articleType,
        master_category: masterCategory,
        sub_category: subCategory,
        gender: gender,
        base_colour: baseColour,
        season: season,
        usage: usage,
        age_group: ageGroup,
        pattern: pattern,
        // Occasion Vault & Garment Protection
        wear_tier: wearTier,
        is_luxury: isLuxury,
        care_type: careType,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : undefined,
        purchase_date: purchaseDate || undefined,
        wardrobe_groups: wardrobeGroups,
        formality: formalityScore,
        // Legacy column sync
        category: articleType,
        primary_color: baseColour,
        occasion: usage,
      };

      // Submit explicit decisions to System A review service
      const decisions: Record<string, any> = {
        article_type: { status: unconfirmedHeads.article_type ? 'unconfirmed' : editedFields.article_type ? 'corrected' : 'accepted', value: articleType },
        master_category: { status: unconfirmedHeads.master_category ? 'unconfirmed' : editedFields.master_category ? 'corrected' : 'accepted', value: masterCategory },
        sub_category: { status: unconfirmedHeads.sub_category ? 'unconfirmed' : editedFields.sub_category ? 'corrected' : 'accepted', value: subCategory },
        gender: { status: unconfirmedHeads.gender ? 'unconfirmed' : editedFields.gender ? 'corrected' : 'accepted', value: gender },
        base_colour: { status: unconfirmedHeads.base_colour ? 'unconfirmed' : editedFields.base_colour ? 'corrected' : 'accepted', value: baseColour },
        season: { status: unconfirmedHeads.season ? 'unconfirmed' : editedFields.season ? 'corrected' : 'accepted', value: season },
        usage: { status: unconfirmedHeads.usage ? 'unconfirmed' : editedFields.usage ? 'corrected' : 'accepted', value: usage },
        pattern: { status: unconfirmedHeads.pattern ? 'unconfirmed' : editedFields.pattern ? 'corrected' : 'accepted', value: pattern },
        age_group: { status: unconfirmedHeads.age_group ? 'unconfirmed' : editedFields.age_group ? 'corrected' : 'accepted', value: ageGroup },
      };

      await Promise.all([
        api.modelLearning.submitReview(currentItem.id, {
          attribute_decisions: decisions,
          exclude_from_training: excludeFromTraining,
          name: verifiedAttributes.name,
          finalize: true,
          vault_updates: {
            wear_tier: wearTier,
            is_luxury: isLuxury,
            care_type: careType,
            purchase_price: verifiedAttributes.purchase_price,
            purchase_date: verifiedAttributes.purchase_date,
            wardrobe_groups: wardrobeGroups,
            formality: formalityScore,
          },
        }).catch((e) => console.warn('Model learning review record warning:', e)),
        api.clothing.finalize(currentItem.id, verifiedAttributes),
      ]);

      showToast(`"${garmentName}" verified and added to your wardrobe!`, 'success');

      if (onItemAccepted) {
        onItemAccepted(currentItem);
      }
      await refreshData();

      if (currentIndex < items.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onClose();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to accept clothing item.', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentItem) return null;

  const predScores = attributesData?.original_prediction?.prediction_scores || {};
  const overallConf = attributesData?.original_prediction?.category_score
    ? Math.round(attributesData.original_prediction.category_score * 100)
    : null;

  const getHeadConfidence = (key: string): number | undefined => {
    const headObj = predScores[key];
    if (headObj && typeof headObj.confidence === 'number') {
      return headObj.confidence;
    }
    return undefined;
  };

  const getHeadAlternatives = (key: string) => {
    const headObj = predScores[key];
    if (headObj && Array.isArray(headObj.alternatives)) {
      return headObj.alternatives.map((alt: any) => ({
        label: alt.label || String(alt),
        confidence: alt.confidence || 0.0,
      }));
    }
    return [];
  };

  const imgUrl = resolveImageUrl(
    currentItem.originalImageUrl || currentItem.preferredImageUrl || currentItem.image
  ) || FALLBACK_POST_IMAGE;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Verify & Accept Garment"
      subtitle={`Garment ${currentIndex + 1} of ${items.length} · Fashion Editorial Atelier Review`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Batch Navigation Header */}
        {items.length > 1 && (
          <div className="flex items-center justify-between p-2.5 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E]">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={currentIndex === 0 || isSaving}
              icon={<ChevronLeft className="w-4 h-4" />}
              className="text-xs font-mono"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#29202B] dark:text-[#F3EEE8]">
              <span>Look {currentIndex + 1} / {items.length}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              disabled={currentIndex === items.length - 1 || isSaving}
              className="text-xs font-mono"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Two-Column Atelier Review Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Garment Image & AI Analysis Metadata */}
          <div className="md:col-span-5 space-y-3">
            {/* Uncropped Garment Image */}
            <div className="aspect-[3/4] rounded-[3px] overflow-hidden bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] relative group shadow-xs">
              <img
                src={imgUrl}
                alt={currentItem.name}
                onError={(e) => {
                  if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                    e.currentTarget.src = FALLBACK_POST_IMAGE;
                  }
                }}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
              />
              <div className="absolute top-2 left-2">
                <span className="text-[10px] uppercase font-mono font-semibold tracking-wider px-2 py-0.5 rounded-[2px] bg-[#29202B]/85 text-white backdrop-blur-xs">
                  Original Upload
                </span>
              </div>
            </div>

            {/* AI Classifier Diagnostics Card */}
            <div className="p-3.5 rounded-[3px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] space-y-2 text-xs">
              <div className="flex items-center justify-between font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                <span className="flex items-center gap-1.5 font-sans">
                  <Sparkles className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
                  Multi-Task Classifier
                </span>
                {overallConf !== null && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[2px] bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400 border border-[#426B50]/20">
                    {overallConf}% Confidence
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6D7068] dark:text-[#A89E9B] leading-relaxed">
                Attributes extracted across 9 multi-task prediction heads. Edits automatically improve your personal styling recommendations.
              </p>
              <div className="pt-1 flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReanalyze}
                  isLoading={isReanalyzing}
                  loadingText="Reanalyzing..."
                  icon={<RefreshCw className="w-3 h-3" />}
                  className="text-xs h-7 px-2 font-mono"
                >
                  Re-run AI Analysis
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Structured Attribute Editor */}
          <div className="md:col-span-7 space-y-5">
            {isLoadingAttributes ? (
              <div className="py-16 text-center text-xs text-[#6D7068] dark:text-[#A89E9B] flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#743C49] dark:text-[#D5A6A0]" />
                <span className="font-mono">Loading extracted garment attributes...</span>
              </div>
            ) : (
              <>
                {/* Header Inputs: Name & Brand */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#6D7068] dark:text-[#A89E9B] mb-1">
                      Garment Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        markFieldEdited('name');
                      }}
                      placeholder="e.g. Linen Button-Down Shirt"
                      className="w-full bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-3 py-2 text-xs sm:text-sm text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#6D7068] dark:text-[#A89E9B] mb-1">
                      Brand (Optional)
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => {
                        setBrand(e.target.value);
                        markFieldEdited('brand');
                      }}
                      placeholder="e.g. Celine, Toteme, Uniqlo"
                      className="w-full bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-3 py-2 text-xs sm:text-sm text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                    />
                  </div>
                </div>

                {/* GROUP 1: Essential Details */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#DCD4CC] dark:border-[#392F3E]">
                    <span className="font-serif font-bold text-sm text-[#29202B] dark:text-[#F3EEE8]">
                      1. Essential Details
                    </span>
                    <span className="text-[10px] font-mono text-[#6D7068] dark:text-[#A89E9B]">
                      Primary Clothing Anatomy
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SearchableCombobox
                      label="Category (Article Type)"
                      value={articleType}
                      options={classOptions.article_type || []}
                      onChange={(val) => {
                        setArticleType(val);
                        markFieldEdited('article_type');
                      }}
                      confidence={getHeadConfidence('article_type')}
                      alternatives={getHeadAlternatives('article_type')}
                      isEdited={Boolean(editedFields.article_type)}
                      isUnconfirmed={Boolean(unconfirmedHeads.article_type)}
                      onToggleUnconfirmed={() => toggleUnconfirmed('article_type')}
                      placeholder="Select category..."
                      required
                    />

                    <SearchableCombobox
                      label="Subcategory"
                      value={subCategory}
                      options={classOptions.sub_category || []}
                      onChange={(val) => {
                        setSubCategory(val);
                        markFieldEdited('sub_category');
                      }}
                      confidence={getHeadConfidence('sub_category')}
                      alternatives={getHeadAlternatives('sub_category')}
                      isEdited={Boolean(editedFields.sub_category)}
                      isUnconfirmed={Boolean(unconfirmedHeads.sub_category)}
                      onToggleUnconfirmed={() => toggleUnconfirmed('sub_category')}
                      placeholder="Select subcategory..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SearchableCombobox
                      label="Primary Colour"
                      value={baseColour}
                      options={classOptions.base_colour || []}
                      onChange={(val) => {
                        setBaseColour(val);
                        markFieldEdited('base_colour');
                      }}
                      confidence={getHeadConfidence('base_colour')}
                      alternatives={getHeadAlternatives('base_colour')}
                      isEdited={Boolean(editedFields.base_colour)}
                      isUnconfirmed={Boolean(unconfirmedHeads.base_colour)}
                      onToggleUnconfirmed={() => toggleUnconfirmed('base_colour')}
                      placeholder="Select primary colour..."
                      required
                    />

                    <SearchableCombobox
                      label="Pattern"
                      value={pattern}
                      options={classOptions.pattern || []}
                      onChange={(val) => {
                        setPattern(val);
                        markFieldEdited('pattern');
                      }}
                      confidence={getHeadConfidence('pattern')}
                      alternatives={getHeadAlternatives('pattern')}
                      isEdited={Boolean(editedFields.pattern)}
                      isUnconfirmed={Boolean(unconfirmedHeads.pattern)}
                      onToggleUnconfirmed={() => toggleUnconfirmed('pattern')}
                      placeholder="Select pattern..."
                      required
                    />
                  </div>
                </div>

                {/* GROUP 2: Classification Details */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#DCD4CC] dark:border-[#392F3E]">
                    <span className="font-serif font-bold text-sm text-[#29202B] dark:text-[#F3EEE8]">
                      2. Classification & Lifestyle
                    </span>
                    <span className="text-[10px] font-mono text-[#6D7068] dark:text-[#A89E9B]">
                      Styling Context
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SearchableCombobox
                      label="Occasion / Usage"
                      value={usage}
                      options={classOptions.usage || []}
                      onChange={(val) => {
                        setUsage(val);
                        markFieldEdited('usage');
                      }}
                      confidence={getHeadConfidence('usage')}
                      alternatives={getHeadAlternatives('usage')}
                      isEdited={Boolean(editedFields.usage)}
                      isUnconfirmed={Boolean(unconfirmedHeads.usage)}
                      onToggleUnconfirmed={() => toggleUnconfirmed('usage')}
                      placeholder="Select occasion..."
                      required
                    />

                    <SearchableCombobox
                      label="Season"
                      value={season}
                      options={classOptions.season || []}
                      onChange={(val) => {
                        setSeason(val);
                        markFieldEdited('season');
                      }}
                      confidence={getHeadConfidence('season')}
                      alternatives={getHeadAlternatives('season')}
                      isEdited={Boolean(editedFields.season)}
                      isUnconfirmed={Boolean(unconfirmedHeads.season)}
                      onToggleUnconfirmed={() => toggleUnconfirmed('season')}
                      placeholder="Select season..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SearchableCombobox
                      label="Gender Fit"
                      value={gender}
                      options={classOptions.gender || []}
                      onChange={(val) => {
                        setGender(val);
                        markFieldEdited('gender');
                      }}
                      confidence={getHeadConfidence('gender')}
                      alternatives={getHeadAlternatives('gender')}
                      isEdited={Boolean(editedFields.gender)}
                      isUnconfirmed={Boolean(unconfirmedHeads.gender)}
                      onToggleUnconfirmed={() => toggleUnconfirmed('gender')}
                      placeholder="Select gender..."
                    />

                    <SearchableCombobox
                      label="Age Group"
                      value={ageGroup}
                      options={classOptions.age_group || []}
                      onChange={(val) => {
                        setAgeGroup(val);
                        markFieldEdited('age_group');
                      }}
                      confidence={getHeadConfidence('age_group')}
                      alternatives={getHeadAlternatives('age_group')}
                      isEdited={Boolean(editedFields.age_group)}
                      isUnconfirmed={Boolean(unconfirmedHeads.age_group)}
                      onToggleUnconfirmed={() => toggleUnconfirmed('age_group')}
                      placeholder="Select age group..."
                    />
                  </div>
                </div>

                {/* GROUP 3: Additional Specifications (Collapsible / Toggleable) */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdditional(!showAdditional)}
                    className="w-full flex items-center justify-between pb-1.5 border-b border-[#DCD4CC] dark:border-[#392F3E] text-left cursor-pointer group"
                  >
                    <span className="font-serif font-bold text-sm text-[#29202B] dark:text-[#F3EEE8] group-hover:text-[#743C49] transition-colors">
                      3. Additional Details & Fit
                    </span>
                    <span className="text-[11px] font-mono text-[#6D7068] dark:text-[#A89E9B] flex items-center gap-1">
                      {showAdditional ? 'Hide' : 'Expand'}
                      {showAdditional ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>

                  {showAdditional && (
                    <div className="space-y-3 animate-fade-in pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#6D7068] dark:text-[#A89E9B] mb-1">
                            Fit Silhouette
                          </label>
                          <select
                            value={fit}
                            onChange={(e) => {
                              setFit(e.target.value);
                              markFieldEdited('fit');
                            }}
                            className="w-full bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-2.5 py-2 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                          >
                            {FIT_OPTIONS.map((f) => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#6D7068] dark:text-[#A89E9B] mb-1">
                            Material / Fabric
                          </label>
                          <select
                            value={material}
                            onChange={(e) => {
                              setMaterial(e.target.value);
                              markFieldEdited('material');
                            }}
                            className="w-full bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-2.5 py-2 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                          >
                            {MATERIAL_OPTIONS.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#6D7068] dark:text-[#A89E9B] mb-1">
                            Garment Size
                          </label>
                          <select
                            value={size}
                            onChange={(e) => {
                              setSize(e.target.value);
                              markFieldEdited('size');
                            }}
                            className="w-full bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-2.5 py-2 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                          >
                            {SIZE_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#6D7068] dark:text-[#A89E9B] mb-1">
                          Secondary Accent Colour
                        </label>
                        <input
                          type="text"
                          value={secondaryColor}
                          onChange={(e) => {
                            setSecondaryColor(e.target.value);
                            markFieldEdited('secondary_color');
                          }}
                          placeholder="e.g. Cream, Navy, Gold"
                          className="w-full bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-3 py-2 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* GROUP 4: Occasion Vault & Model Learning Controls */}
                <div className="p-4 rounded-[3px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-[#29202B] dark:text-[#F3EEE8] font-serif text-sm">
                      <Crown className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                      <span>Occasion Vault & Garment Protection</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#6D7068] dark:text-[#A89E9B]">
                      Rotation Controls
                    </span>
                  </div>

                  {/* Wear Tier Radio Buttons */}
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-[#6D7068] dark:text-[#A89E9B] mb-1">
                      Wear Tier
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'daily', label: 'Daily Rotation' },
                        { key: 'elevated', label: 'Elevated & Smart' },
                        { key: 'luxury_special', label: 'Special & Luxury' },
                      ].map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => {
                            setWearTier(t.key as any);
                            markFieldEdited('wear_tier');
                          }}
                          className={`py-1.5 px-2 rounded-[2px] border text-center transition-all cursor-pointer font-medium text-[11px] font-mono ${
                            wearTier === t.key
                              ? 'bg-[#743C49]/10 border-[#743C49] text-[#743C49] dark:text-[#D5A6A0] font-bold'
                              : 'bg-[#F3EEE8] dark:bg-[#1A151C] border-[#DCD4CC] dark:border-[#392F3E] text-[#6D7068] dark:text-[#A89E9B]'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Luxury Toggle & Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <label className="flex items-center gap-2 p-2 rounded-[2px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isLuxury}
                        onChange={(e) => {
                          setIsLuxury(e.target.checked);
                          markFieldEdited('is_luxury');
                        }}
                        className="w-3.5 h-3.5 accent-[#743C49] rounded cursor-pointer"
                      />
                      <span className="text-[11px] font-sans font-medium text-[#29202B] dark:text-[#F3EEE8]">
                        Mark as Luxury Piece
                      </span>
                    </label>

                    <div>
                      <input
                        type="number"
                        value={purchasePrice}
                        onChange={(e) => {
                          setPurchasePrice(e.target.value);
                          markFieldEdited('purchase_price');
                        }}
                        placeholder="Purchase price ($)"
                        className="w-full bg-[#FFFFFF] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] px-2.5 py-1.5 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                      />
                    </div>
                  </div>

                  {/* Personal Model Learning Consent Toggle */}
                  <div className="pt-2 border-t border-[#DCD4CC]/80 dark:border-[#392F3E]/80 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[#29202B] dark:text-[#F3EEE8] flex items-center gap-1.5 font-sans">
                        <Cpu className="w-3.5 h-3.5 text-[#6D7068] dark:text-[#A89E9B]" />
                        <span>Model Training Eligibility</span>
                      </div>
                      <p className="text-[10px] text-[#6D7068] dark:text-[#A89E9B]">
                        {excludeFromTraining
                          ? 'Excluded from candidate model fine-tuning.'
                          : 'Eligible to train personal recommendation model.'}
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!excludeFromTraining}
                        onChange={(e) => setExcludeFromTraining(!e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[#DCD4CC] peer-focus:outline-none rounded-full peer dark:bg-[#392F3E] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#743C49]"></div>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[#DCD4CC] dark:border-[#392F3E]">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReject}
              disabled={isSaving}
              icon={<X className="w-3.5 h-3.5" />}
              className="text-[#A33D42] hover:bg-[#A33D42]/10 border-[#DCD4CC] font-mono text-xs"
            >
              Reject Item
            </Button>
            <div className="text-xs text-[#6D7068] dark:text-[#A89E9B] hidden sm:block font-mono">
              {Object.keys(editedFields).length > 0 ? (
                <span className="text-[#743C49] dark:text-[#D5A6A0] font-semibold">
                  {Object.keys(editedFields).length} attribute(s) edited
                </span>
              ) : (
                <span className="text-[#426B50] dark:text-emerald-400 font-semibold">
                  AI predictions matched
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="font-mono text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleAccept}
              isLoading={isSaving}
              loadingText="Verifying..."
              icon={<Check className="w-4 h-4" />}
              className="font-mono text-xs bg-[#743C49] hover:bg-[#5E303B] text-white"
            >
              {items.length > 1 && currentIndex < items.length - 1
                ? 'Confirm & Next'
                : 'Confirm & Add to Wardrobe'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
