import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Check,
  Tag,
  Palette,
  ShieldCheck,
  Layers,
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

  // Form State for the 9 Prediction Heads
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [articleType, setArticleType] = useState('Shirts');
  const [masterCategory, setMasterCategory] = useState('Apparel');
  const [subCategory, setSubCategory] = useState('Topwear');
  const [baseColour, setBaseColour] = useState('Black');
  const [pattern, setPattern] = useState('Solid');
  const [gender, setGender] = useState('Unisex');
  const [season, setSeason] = useState('Summer');
  const [usage, setUsage] = useState('Casual');
  const [ageGroup, setAgeGroup] = useState('Adults-Unisex');

  // Track which fields the user has manually edited
  const [editedFields, setEditedFields] = useState<Record<string, boolean>>({});

  const currentItem = items[currentIndex];

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

  // Fetch full prediction and attribute details for the current garment
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
        setPattern(cur.pattern || currentItem.pattern || 'Solid');
        setGender(cur.gender || pred.gender || 'Unisex');
        setSeason(cur.season || currentItem.season || 'Summer');
        setUsage(cur.usage || cur.occasion || (currentItem as any)?.occasion || 'Casual');
        setAgeGroup(cur.age_group || pred.age_group || 'Adults-Unisex');
      })
      .catch((err) => {
        if (!isSubscribed) return;
        console.warn('Failed to load item attributes:', err);
        // Fallback to current item properties
        setName(currentItem.name || '');
        setBrand(currentItem.brand || '');
        setArticleType(currentItem.category || 'Shirts');
        setBaseColour(currentItem.color || 'Black');
        setPattern(currentItem.pattern || 'Solid');
        setSeason(currentItem.season || 'Summer');
        setUsage((currentItem as any)?.occasion || 'Casual');
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

  // Re-run AI analysis if needed
  const handleReanalyze = async () => {
    if (!currentItem) return;
    setIsReanalyzing(true);
    try {
      await api.clothing.reanalyze(currentItem.id);
      showToast('Re-analyzed garment with AI model.', 'success');
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

  // Confirm and Accept garment
  const handleAccept = async () => {
    if (!currentItem) return;
    setIsSaving(true);
    try {
      const verifiedAttributes = {
        name: name.trim() || `${baseColour} ${articleType}`,
        brand: brand.trim() || undefined,
        article_type: articleType,
        master_category: masterCategory,
        sub_category: subCategory,
        base_colour: baseColour,
        pattern: pattern,
        gender: gender,
        season: season,
        usage: usage,
        age_group: ageGroup,
        // Legacy column sync
        category: articleType,
        primary_color: baseColour,
        occasion: usage,
      };

      await api.clothing.finalize(currentItem.id, verifiedAttributes);
      showToast(`"${verifiedAttributes.name}" accepted and added to your wardrobe!`, 'success');

      if (onItemAccepted) {
        onItemAccepted(currentItem);
      }
      await refreshData();

      // If there are more items, navigate to next; otherwise close
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

  const originalPred = attributesData?.original_prediction?.predicted_attributes || {};
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
      subtitle={`Item ${currentIndex + 1} of ${items.length} · Review AI-predicted attributes before adding to your capsule closet.`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Navigation Bar for Sequential Batch Review */}
        {items.length > 1 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={currentIndex === 0 || isSaving}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>
                Reviewing {currentIndex + 1} of {items.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              disabled={currentIndex === items.length - 1 || isSaving}
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Two-Column Review Layout: Image (Left) + Attributes (Right) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Image & AI Confidence */}
          <div className="md:col-span-5 space-y-3">
            <div className="aspect-[3/4] rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 relative group">
              <img
                src={imgUrl}
                alt={currentItem.name}
                onError={(e) => {
                  if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                    e.currentTarget.src = FALLBACK_POST_IMAGE;
                  }
                }}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute top-2.5 left-2.5">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-black/75 backdrop-blur-md text-white border border-white/20">
                  Original Upload
                </span>
              </div>
            </div>

            {/* Model & Confidence Pill */}
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs">
              <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  EfficientNet-B0
                </span>
                {overallConf !== null && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {overallConf}% Confidence
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Extracted directly from the original uploaded photo across 9 multi-task prediction heads.
              </p>
              <div className="pt-2 flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReanalyze}
                  isLoading={isReanalyzing}
                  loadingText="Reanalyzing..."
                  icon={<RefreshCw className="w-3 h-3" />}
                  className="text-xs h-7 px-2"
                >
                  Re-run AI Analysis
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Editable Attribute Controls */}
          <div className="md:col-span-7 space-y-4">
            {isLoadingAttributes ? (
              <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                Loading garment attributes...
              </div>
            ) : (
              <>
                {/* Garment Name & Brand */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
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
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                      Brand (Optional)
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => {
                        setBrand(e.target.value);
                        markFieldEdited('brand');
                      }}
                      placeholder="e.g. Zara, Uniqlo, Ralph Lauren"
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                  </div>
                </div>

                {/* 1. Article Type (Primary Classification) */}
                <SearchableCombobox
                  label="Article Type"
                  value={articleType}
                  options={classOptions.article_type || []}
                  onChange={(val) => {
                    setArticleType(val);
                    markFieldEdited('article_type');
                  }}
                  confidence={getHeadConfidence('article_type')}
                  alternatives={getHeadAlternatives('article_type')}
                  isEdited={Boolean(editedFields.article_type)}
                  placeholder="Select article type (e.g. Shirts, Jeans, Dresses)..."
                  required
                />

                {/* 2 & 3: Master Category & Sub Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SearchableCombobox
                    label="Master Category"
                    value={masterCategory}
                    options={classOptions.master_category || []}
                    onChange={(val) => {
                      setMasterCategory(val);
                      markFieldEdited('master_category');
                    }}
                    confidence={getHeadConfidence('master_category')}
                    alternatives={getHeadAlternatives('master_category')}
                    isEdited={Boolean(editedFields.master_category)}
                    placeholder="Select master category..."
                    required
                  />

                  <SearchableCombobox
                    label="Sub Category"
                    value={subCategory}
                    options={classOptions.sub_category || []}
                    onChange={(val) => {
                      setSubCategory(val);
                      markFieldEdited('sub_category');
                    }}
                    confidence={getHeadConfidence('sub_category')}
                    alternatives={getHeadAlternatives('sub_category')}
                    isEdited={Boolean(editedFields.sub_category)}
                    placeholder="Select sub-category..."
                    required
                  />
                </div>

                {/* 4 & 5: Base Colour & Pattern */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SearchableCombobox
                    label="Base Colour"
                    value={baseColour}
                    options={classOptions.base_colour || []}
                    onChange={(val) => {
                      setBaseColour(val);
                      markFieldEdited('base_colour');
                    }}
                    confidence={getHeadConfidence('base_colour')}
                    alternatives={getHeadAlternatives('base_colour')}
                    isEdited={Boolean(editedFields.base_colour)}
                    placeholder="Select colour..."
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
                    placeholder="Select pattern..."
                    required
                  />
                </div>

                {/* 6 & 7: Season & Usage / Occasion */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    placeholder="Select season..."
                    required
                  />

                  <SearchableCombobox
                    label="Usage / Occasion"
                    value={usage}
                    options={classOptions.usage || []}
                    onChange={(val) => {
                      setUsage(val);
                      markFieldEdited('usage');
                    }}
                    confidence={getHeadConfidence('usage')}
                    alternatives={getHeadAlternatives('usage')}
                    isEdited={Boolean(editedFields.usage)}
                    placeholder="Select occasion..."
                    required
                  />
                </div>

                {/* 8 & 9: Gender & Age Group */}
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
                    placeholder="Select age group..."
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {Object.keys(editedFields).length > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {Object.keys(editedFields).length} attribute(s) edited manually
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                All attributes matched with AI model predictions
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleAccept}
              isLoading={isSaving}
              loadingText="Accepting..."
              icon={<Check className="w-4 h-4" />}
            >
              {items.length > 1 && currentIndex < items.length - 1
                ? 'Accept & Next'
                : 'Accept & Add to Wardrobe'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
