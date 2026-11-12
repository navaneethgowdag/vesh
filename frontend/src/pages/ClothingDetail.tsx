import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  Sliders,
  RefreshCw,
  Crown,
  Cpu,
  Trash2,
  ChevronDown,
  ChevronUp,
  Tag,
  Palette,
  Compass,
  X,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { SearchableCombobox } from '../components/wardrobe/SearchableCombobox';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../utils/imageUrl';
import defaultClassMappings from '../data/classMappings.json';

const FIT_OPTIONS = ['Regular', 'Slim', 'Relaxed', 'Oversized', 'Tailored', 'Skinny', 'Loose'];
const MATERIAL_OPTIONS = ['Cotton', 'Linen', 'Wool', 'Silk', 'Denim', 'Leather', 'Cashmere', 'Polyester', 'Rayon', 'Suede', 'Blend', 'Knit'];
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', 'Custom'];

export const ClothingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { wardrobe, refreshData, showToast } = useApp();

  const item = wardrobe.find((i) => i.id === id);

  // Class options from backend or fallback to classMappings.json
  const [classOptions, setClassOptions] = useState<Record<string, string[]>>(defaultClassMappings);

  // Editing & Loading states
  const [isEditing, setIsEditing] = useState(false);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
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

  const markFieldEdited = (field: string) => {
    setEditedFields((prev) => ({ ...prev, [field]: true }));
  };

  const toggleUnconfirmed = (head: string) => {
    setUnconfirmedHeads((prev) => ({ ...prev, [head]: !prev[head] }));
  };

  // Load class options once
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

  const loadItemDetails = async (clothingId: string) => {
    try {
      setLoadingAttributes(true);
      const attrs = await api.clothing.getAttributes(clothingId).catch(() => null);

      if (attrs) {
        setAttributesData(attrs);
        const cur = attrs.current_attributes || {};
        const pred = attrs.original_prediction?.predicted_attributes || {};

        setName(cur.name || item?.name || '');
        setBrand(cur.brand || item?.brand || '');
        setArticleType(cur.article_type || pred.article_type || item?.category || 'Shirts');
        setMasterCategory(cur.master_category || pred.master_category || 'Apparel');
        setSubCategory(cur.sub_category || pred.sub_category || 'Topwear');
        setBaseColour(cur.base_colour || cur.primary_color || item?.color || 'Black');
        setSecondaryColor(cur.secondary_color || item?.secondaryColor || (item as any)?.secondary_color || '');
        setPattern(cur.pattern || item?.pattern || 'Solid');
        setGender(cur.gender || pred.gender || 'Unisex');
        setSeason(cur.season || item?.season || 'Summer');
        setUsage(cur.usage || cur.occasion || (item as any)?.occasion || 'Casual');
        setAgeGroup(cur.age_group || pred.age_group || 'Adults-Unisex');

        // Additional attributes
        setFit(cur.fit || item?.fit || 'Regular');
        setMaterial(cur.material || item?.material || 'Cotton');
        setSize(cur.size || item?.size || 'M');

        // Vault fields
        setWearTier(cur.wear_tier || item?.wearTier || (item as any)?.wear_tier || 'daily');
        setIsLuxury(Boolean(cur.is_luxury ?? item?.isLuxury ?? (item as any)?.is_luxury ?? false));
        setCareType(cur.care_type || item?.careType || (item as any)?.care_type || 'machine_wash');
        setPurchasePrice(cur.purchase_price ? String(cur.purchase_price) : item?.purchasePrice ? String(item.purchasePrice) : '');
        setPurchaseDate(cur.purchase_date || item?.purchaseDate || (item as any)?.purchase_date || '');
        setWardrobeGroups(cur.wardrobe_groups || item?.wardrobeGroups || (item as any)?.wardrobe_groups || ['daily_work']);
        setFormalityScore(cur.formality ?? item?.formality ?? 0.4);
      } else if (item) {
        setName(item.name || '');
        setBrand(item.brand || '');
        setArticleType(item.category || 'Shirts');
        setBaseColour(item.color || 'Black');
        setSecondaryColor(item.secondaryColor || (item as any)?.secondary_color || '');
        setPattern(item.pattern || 'Solid');
        setSeason(item.season || 'Summer');
        setUsage((item as any)?.occasion || 'Casual');
        setFit(item.fit || 'Regular');
        setMaterial(item.material || 'Cotton');
        setSize(item.size || 'M');
        setWearTier(item.wearTier || (item as any)?.wear_tier || 'daily');
        setIsLuxury(Boolean(item.isLuxury ?? (item as any)?.is_luxury ?? false));
        setCareType(item.careType || (item as any)?.care_type || 'machine_wash');
        setPurchasePrice(item.purchasePrice ? String(item.purchasePrice) : '');
        setPurchaseDate(item.purchaseDate || (item as any)?.purchase_date || '');
        setWardrobeGroups(item.wardrobeGroups || (item as any)?.wardrobe_groups || ['daily_work']);
        setFormalityScore(item.formality ?? 0.4);
      }
    } catch (err) {
      console.warn('Failed to load item attributes:', err);
    } finally {
      setLoadingAttributes(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadItemDetails(id);
    }
  }, [id]);

  // Re-run AI analysis
  const handleReanalyze = async () => {
    if (!id) return;
    setIsReanalyzing(true);
    try {
      await api.clothing.reanalyze(id);
      showToast?.('Re-analyzed garment with EfficientNet model.', 'success');
      await loadItemDetails(id);
      if (refreshData) await refreshData();
      setEditedFields({});
    } catch (err: any) {
      showToast?.(err.message || 'Reanalysis failed.', 'info');
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Delete / Reject garment
  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to remove this garment from your wardrobe?')) {
      return;
    }
    setIsSaving(true);
    try {
      await api.clothing.delete(id);
      showToast?.('Garment removed from your wardrobe.', 'info');
      if (refreshData) await refreshData();
      navigate('/wardrobe');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to remove garment.', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  // Accept & Confirm garment (finalizes and registers in recommendation model)
  const handleFinalize = async () => {
    if (!id) return;
    try {
      setIsSaving(true);
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
        api.modelLearning.submitReview(id, {
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
        api.clothing.finalize(id, verifiedAttributes),
      ]);

      showToast?.(`"${garmentName}" verified and accepted into your wardrobe!`, 'success');
      await loadItemDetails(id);
      if (refreshData) await refreshData();
      setIsEditing(false);
      setEditedFields({});
    } catch (err: any) {
      showToast?.(err.message || 'Failed to accept garment.', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle saving attribute corrections
  const handleSaveAttributes = async () => {
    if (!id) return;
    try {
      setIsSaving(true);
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
        api.modelLearning.submitReview(id, {
          attribute_decisions: decisions,
          exclude_from_training: excludeFromTraining,
          name: verifiedAttributes.name,
          finalize: attributesData?.is_finalized || false,
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
        api.clothing.updateAttributes(id, verifiedAttributes),
      ]);

      showToast?.('Garment attributes updated successfully!', 'success');
      await loadItemDetails(id);
      if (refreshData) await refreshData();
      setIsEditing(false);
      setEditedFields({});
    } catch (err: any) {
      showToast?.(err.message || 'Failed to update attributes', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  if (!item) {
    return (
      <AppShell>
        <div className="text-center py-20 bg-[#FFFFFF] dark:bg-[#241D27] rounded-[4px] border border-[#DCD4CC] dark:border-[#392F3E]">
          <p className="font-serif font-bold text-lg text-[#29202B] dark:text-[#F3EEE8]">
            Garment not found in your wardrobe
          </p>
          <p className="text-xs font-mono text-[#6D7068] dark:text-[#A89E9B] mt-1">
            The item may have been removed or the link is invalid.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/wardrobe')}
            icon={<ArrowLeft className="w-4 h-4" />}
            className="mt-4 font-mono text-xs border-[#DCD4CC]"
          >
            Back to Wardrobe
          </Button>
        </div>
      </AppShell>
    );
  }

  const isFinalized = attributesData?.is_finalized || false;
  const predScores = attributesData?.original_prediction?.prediction_scores || {};
  const overallConf = attributesData?.original_prediction?.category_score
    ? Math.round(attributesData.original_prediction.category_score * 100)
    : (attributesData?.overall_confidence ? Math.round(attributesData.overall_confidence * 100) : null);

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
    item.originalImageUrl || api.clothing.getOriginalImageUrl(item.id) || item.preferredImageUrl || item.image
  ) || FALLBACK_POST_IMAGE;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Editorial Top Navigation & Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DCD4CC] dark:border-[#392F3E]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/wardrobe')}
              className="inline-flex items-center gap-2 h-9 px-2.5 rounded-[3px] text-xs font-mono font-medium text-[#6D7068] dark:text-[#A89E9B] hover:text-[#29202B] dark:hover:text-[#F3EEE8] hover:bg-[#F3EEE8] dark:hover:bg-[#1A151C] transition-colors group cursor-pointer border border-transparent hover:border-[#DCD4CC] dark:hover:border-[#392F3E]"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Wardrobe</span>
            </button>

            <div>
              {isFinalized ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-mono font-semibold bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400 border border-[#426B50]/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirmed Attributes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-mono font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Review Pending
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {!isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isSaving}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  className="text-[#A33D42] hover:bg-[#A33D42]/10 border-[#DCD4CC] font-mono text-xs"
                >
                  Delete Garment
                </Button>

                {!isFinalized && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleFinalize}
                    isLoading={isSaving}
                    loadingText="Confirming..."
                    icon={<Check className="w-3.5 h-3.5" />}
                    className="font-mono text-xs bg-[#743C49] hover:bg-[#5E303B] text-white"
                  >
                    Accept & Confirm
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  icon={<Sliders className="w-3.5 h-3.5" />}
                  className="font-mono text-xs border-[#DCD4CC]"
                >
                  Edit Attributes
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedFields({});
                    if (id) loadItemDetails(id);
                  }}
                  disabled={isSaving}
                  className="font-mono text-xs border-[#DCD4CC]"
                >
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAttributes}
                  isLoading={isSaving}
                  loadingText="Saving..."
                  icon={<Check className="w-3.5 h-3.5" />}
                  className="font-mono text-xs bg-[#743C49] hover:bg-[#5E303B] text-white"
                >
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Two-Column Editorial Atelier Layout */}
        <div className="bg-[#FFFFFF] dark:bg-[#241D27] rounded-[4px] border border-[#DCD4CC] dark:border-[#392F3E] p-6 sm:p-8 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left Column: Garment Image & Multi-Task Diagnostics */}
            <div className="md:col-span-5 space-y-3">
              {/* Uncropped Garment Image */}
              <div className="aspect-[3/4] rounded-[3px] overflow-hidden bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] relative group shadow-xs">
                <img
                  src={imgUrl}
                  alt={item.name}
                  onError={(e) => {
                    if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                      e.currentTarget.src = FALLBACK_POST_IMAGE;
                    }
                  }}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
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

            {/* Right Column: Structured Attribute Showcase / Editor */}
            <div className="md:col-span-7 space-y-6">
              {loadingAttributes ? (
                <div className="py-20 text-center text-xs text-[#6D7068] dark:text-[#A89E9B] flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#743C49] dark:text-[#D5A6A0]" />
                  <span className="font-mono">Loading extracted garment attributes...</span>
                </div>
              ) : isEditing ? (
                /* EDIT MODE: 4 Structured Groups matching ClothingReviewModal */
                <div className="space-y-5">
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
                        className="w-full bg-[#FFFFFF] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-3 py-2 text-xs sm:text-sm text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
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
                        className="w-full bg-[#FFFFFF] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-3 py-2 text-xs sm:text-sm text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
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

                  {/* GROUP 3: Additional Details & Fit (Collapsible) */}
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
                              className="w-full bg-[#FFFFFF] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-2.5 py-2 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
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
                              className="w-full bg-[#FFFFFF] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-2.5 py-2 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
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
                              className="w-full bg-[#FFFFFF] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-2.5 py-2 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
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
                            className="w-full bg-[#FFFFFF] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] px-3 py-2 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* GROUP 4: Occasion Vault & Model Learning Controls */}
                  <div className="p-4 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-3.5 text-xs">
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
                                : 'bg-[#FFFFFF] dark:bg-[#241D27] border-[#DCD4CC] dark:border-[#392F3E] text-[#6D7068] dark:text-[#A89E9B]'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Luxury Toggle & Price */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <label className="flex items-center gap-2 p-2 rounded-[2px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] cursor-pointer">
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
                          className="w-full bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] px-2.5 py-1.5 text-xs text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
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

                  {/* Edit Mode Bottom Action Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#DCD4CC] dark:border-[#392F3E]">
                    <div className="text-xs font-mono text-[#6D7068] dark:text-[#A89E9B]">
                      {Object.keys(editedFields).length > 0 ? (
                        <span className="text-[#743C49] dark:text-[#D5A6A0] font-semibold">
                          {Object.keys(editedFields).length} attribute(s) modified
                        </span>
                      ) : (
                        <span className="text-[#426B50] dark:text-emerald-400 font-semibold">
                          No pending modifications
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedFields({});
                          if (id) loadItemDetails(id);
                        }}
                        disabled={isSaving}
                        className="font-mono text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleSaveAttributes}
                        isLoading={isSaving}
                        loadingText="Saving..."
                        icon={<Check className="w-3.5 h-3.5" />}
                        className="font-mono text-xs bg-[#743C49] hover:bg-[#5E303B] text-white"
                      >
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* VIEW MODE: Elegant Atelier Structured Showcase */
                <div className="space-y-6">
                  {/* Item Headline & Header Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6D7068] dark:text-[#A89E9B]">
                      <span>{masterCategory || 'Apparel'}</span>
                      <span>·</span>
                      <span>{subCategory || 'Topwear'}</span>
                      {brand && <span>· {brand}</span>}
                    </div>
                    <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#29202B] dark:text-[#F3EEE8]">
                      {name || item.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs font-mono text-[#6D7068] dark:text-[#A89E9B]">
                      <span>Cataloged · Worn {item.timesWorn || 0} times</span>
                      {careType && (
                        <span className="px-2 py-0.5 rounded-[2px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E]">
                          {careType.replace(/_/g, ' ')}
                        </span>
                      )}
                      {isLuxury && (
                        <span className="px-2 py-0.5 rounded-[2px] bg-[#743C49]/10 text-[#743C49] dark:text-[#D5A6A0] border border-[#743C49]/30 font-semibold flex items-center gap-1">
                          <Crown className="w-3 h-3" />
                          Luxury Piece
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 1. Essential Details */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#DCD4CC] dark:border-[#392F3E]">
                      <span className="font-serif font-bold text-sm text-[#29202B] dark:text-[#F3EEE8] flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
                        1. Essential Details
                      </span>
                      <span className="text-[10px] font-mono text-[#6D7068] dark:text-[#A89E9B]">
                        Primary Clothing Anatomy
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Category</span>
                          {getHeadConfidence('article_type') !== undefined && (
                            <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded-[2px] bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400">
                              {Math.round(getHeadConfidence('article_type')! * 100)}%
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] block truncate">
                          {articleType}
                        </span>
                      </div>

                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Subcategory</span>
                          {getHeadConfidence('sub_category') !== undefined && (
                            <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded-[2px] bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400">
                              {Math.round(getHeadConfidence('sub_category')! * 100)}%
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] block truncate">
                          {subCategory}
                        </span>
                      </div>

                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Primary Colour</span>
                          {getHeadConfidence('base_colour') !== undefined && (
                            <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded-[2px] bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400">
                              {Math.round(getHeadConfidence('base_colour')! * 100)}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span
                            className="w-3 h-3 rounded-full border border-[#DCD4CC] dark:border-[#392F3E] shrink-0"
                            style={{ backgroundColor: baseColour?.toLowerCase() || '#29202B' }}
                          />
                          <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] truncate">
                            {baseColour}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Pattern</span>
                          {getHeadConfidence('pattern') !== undefined && (
                            <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded-[2px] bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400">
                              {Math.round(getHeadConfidence('pattern')! * 100)}%
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] block truncate">
                          {pattern}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Classification & Lifestyle */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#DCD4CC] dark:border-[#392F3E]">
                      <span className="font-serif font-bold text-sm text-[#29202B] dark:text-[#F3EEE8] flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
                        2. Classification & Lifestyle
                      </span>
                      <span className="text-[10px] font-mono text-[#6D7068] dark:text-[#A89E9B]">
                        Styling Context
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Occasion</span>
                          {getHeadConfidence('usage') !== undefined && (
                            <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded-[2px] bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400">
                              {Math.round(getHeadConfidence('usage')! * 100)}%
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] block truncate">
                          {usage}
                        </span>
                      </div>

                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Season</span>
                          {getHeadConfidence('season') !== undefined && (
                            <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded-[2px] bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400">
                              {Math.round(getHeadConfidence('season')! * 100)}%
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] block truncate">
                          {season}
                        </span>
                      </div>

                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Gender Fit</span>
                          {getHeadConfidence('gender') !== undefined && (
                            <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded-[2px] bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400">
                              {Math.round(getHeadConfidence('gender')! * 100)}%
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] block truncate">
                          {gender}
                        </span>
                      </div>

                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Age Group</span>
                          {getHeadConfidence('age_group') !== undefined && (
                            <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded-[2px] bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400">
                              {Math.round(getHeadConfidence('age_group')! * 100)}%
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] block truncate">
                          {ageGroup}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Additional Details & Fit */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#DCD4CC] dark:border-[#392F3E]">
                      <span className="font-serif font-bold text-sm text-[#29202B] dark:text-[#F3EEE8] flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
                        3. Additional Details & Fit
                      </span>
                      <span className="text-[10px] font-mono text-[#6D7068] dark:text-[#A89E9B]">
                        Silhouette & Fabrication
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E]">
                        <span className="block text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Fit Silhouette</span>
                        <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] mt-0.5 block truncate">
                          {fit || 'Regular'}
                        </span>
                      </div>

                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E]">
                        <span className="block text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Material</span>
                        <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] mt-0.5 block truncate">
                          {material || 'Cotton'}
                        </span>
                      </div>

                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E]">
                        <span className="block text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Size</span>
                        <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] mt-0.5 block truncate">
                          {size || 'M'}
                        </span>
                      </div>

                      <div className="p-3 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E]">
                        <span className="block text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Secondary Accent</span>
                        <span className="text-xs sm:text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] mt-0.5 block truncate">
                          {secondaryColor || 'None'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Occasion Vault & Garment Protection Card */}
                  <div className="p-4 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] space-y-3.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-[#29202B] dark:text-[#F3EEE8] font-serif text-sm">
                        <Crown className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                        <span>Occasion Vault & Garment Protection</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#6D7068] dark:text-[#A89E9B]">
                        Rotation Controls
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded-[2px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E]">
                        <span className="block text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Wear Tier</span>
                        <span className="text-xs font-mono font-bold text-[#743C49] dark:text-[#D5A6A0] mt-0.5 block">
                          {wearTier === 'luxury_special' ? 'Special & Luxury' : wearTier === 'elevated' ? 'Elevated & Smart' : 'Daily Rotation'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-[2px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E]">
                        <span className="block text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Luxury Status</span>
                        <span className="text-xs font-mono font-bold text-[#29202B] dark:text-[#F3EEE8] mt-0.5 block">
                          {isLuxury ? 'Marked as Luxury Piece' : 'Standard Wardrobe Piece'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-[2px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E]">
                        <span className="block text-[10px] font-mono uppercase text-[#6D7068] dark:text-[#A89E9B]">Purchase Price</span>
                        <span className="text-xs font-mono font-bold text-[#29202B] dark:text-[#F3EEE8] mt-0.5 block">
                          {purchasePrice ? `$${parseFloat(purchasePrice).toFixed(2)}` : 'Not recorded'}
                        </span>
                      </div>
                    </div>

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

                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-[2px] ${
                        excludeFromTraining
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400 border border-[#426B50]/20'
                      }`}>
                        {excludeFromTraining ? 'Excluded' : 'Eligible'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
