import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Check,
  Image as ImageIcon,
  Layers,
  Bot,
  Tag,
  Sliders,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const TAILORBIRD_COLORS = [
  'Black', 'Charcoal', 'Gray', 'White', 'Cream', 'Beige',
  'Navy', 'Blue', 'Light Blue', 'Red', 'Maroon', 'Pink',
  'Green', 'Olive', 'Yellow', 'Orange', 'Brown', 'Purple', 'Multicolor'
];

const CATEGORIES = [
  // Western Tops
  { id: 'shirt', label: 'Shirt', group: 'western' },
  { id: 't_shirt', label: 'T-Shirt', group: 'western' },
  { id: 'blouse', label: 'Blouse', group: 'western' },
  { id: 'sweater', label: 'Sweater / Knitwear', group: 'western' },
  { id: 'jacket', label: 'Jacket / Blazer', group: 'western' },
  // Western Bottoms
  { id: 'jeans', label: 'Jeans', group: 'western' },
  { id: 'trousers', label: 'Trousers / Pants', group: 'western' },
  { id: 'skirt', label: 'Skirt', group: 'western' },
  { id: 'shorts', label: 'Shorts', group: 'western' },
  // Western Dresses
  { id: 'western_dress', label: 'Dress', group: 'western' },
  // Indian Clothing
  { id: 'kurta', label: 'Kurta / Kurti', group: 'indian' },
  { id: 'saree', label: 'Saree', group: 'indian' },
  { id: 'lehenga', label: 'Lehenga', group: 'indian' },
  { id: 'sherwani', label: 'Sherwani', group: 'indian' },
];

const PATTERNS = [
  'solid', 'striped', 'checked', 'plaid', 'floral', 'geometric',
  'printed', 'abstract', 'embroidered', 'textured', 'multicolor', 'unknown'
];

const SLEEVE_TYPES = [
  'sleeveless', 'cap_sleeve', 'short_sleeve', 'three_quarter', 'full_sleeve', 'unknown'
];

const NECKLINES = [
  'crew_neck', 'v_neck', 'round_neck', 'mandarin_collar', 'classic_collar', 'scoop_neck', 'boat_neck', 'off_shoulder', 'unknown'
];

export const ClothingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { wardrobe, refreshData, showToast } = useApp();

  const item = wardrobe.find((i) => i.id === id);

  // State for AI predictions and review editing
  const [activeTab, setActiveTab] = useState<'catalog' | 'original'>('catalog');
  const [isEditing, setIsEditing] = useState(false);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [attributesData, setAttributesData] = useState<any>(null);
  const [avatarData, setAvatarData] = useState<any>(null);

  // Form edit state
  const [editCategory, setEditCategory] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editSecondaryColor, setEditSecondaryColor] = useState('');
  const [editPattern, setEditPattern] = useState('');
  const [editSleeveType, setEditSleeveType] = useState('');
  const [editNeckline, setEditNeckline] = useState('');
  const [editStyle, setEditStyle] = useState('');
  const [editSeason, setEditSeason] = useState('');
  const [editOccasion, setEditOccasion] = useState('');

  // Fetch verified attributes, AI predictions, and avatar readiness
  const loadItemDetails = async (clothingId: string) => {
    try {
      setLoadingAttributes(true);
      const [attrs, avatar] = await Promise.all([
        api.clothing.getAttributes(clothingId).catch(() => null),
        api.clothing.getAvatarAttributes(clothingId).catch(() => null),
      ]);

      if (attrs) {
        setAttributesData(attrs);
        const cur = attrs.current_attributes || {};
        const cs = cur.category_specific || {};
        setEditCategory(cur.category || item?.category || 'shirt');
        setEditColor(cur.primary_color || item?.color || 'Black');
        setEditSecondaryColor(cur.secondary_color || item?.secondaryColor || '');
        setEditPattern(cur.pattern || item?.pattern || 'solid');
        setEditSleeveType(cs.sleeve_type || cs.sleeve_length || 'short_sleeve');
        setEditNeckline(cs.neckline || cs.collar_style || 'crew_neck');
        setEditStyle(cur.style || item?.style || 'casual');
        setEditSeason(cur.season || item?.season || 'all_season');
        setEditOccasion(cur.occasion || (item as any)?.occasion || 'everyday');
      }

      if (avatar) {
        setAvatarData(avatar);
      }
    } catch (err) {
      console.warn('Failed to fetch detailed attributes:', err);
    } finally {
      setLoadingAttributes(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadItemDetails(id);
    }
  }, [id]);

  // Handle saving attribute corrections
  const handleSaveAttributes = async () => {
    if (!id) return;
    try {
      setIsSaving(true);
      const updates = {
        category: editCategory,
        primary_color: editColor,
        secondary_color: editSecondaryColor || null,
        pattern: editPattern,
        style: editStyle,
        season: editSeason,
        occasion: editOccasion,
        category_specific: {
          sleeve_type: editSleeveType,
          neckline: editNeckline,
        },
      };

      await api.clothing.updateAttributes(id, updates);
      await loadItemDetails(id);
      if (refreshData) await refreshData();
      setIsEditing(false);
      showToast?.('Garment attributes updated successfully!', 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to update attributes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle finalization
  const handleFinalize = async () => {
    if (!id) return;
    try {
      setIsSaving(true);
      const verifiedAttrs = {
        category: editCategory,
        primary_color: editColor,
        secondary_color: editSecondaryColor || null,
        pattern: editPattern,
        style: editStyle,
        season: editSeason,
        occasion: editOccasion,
        category_specific: {
          sleeve_type: editSleeveType,
          neckline: editNeckline,
        },
      };

      await api.clothing.finalize(id, verifiedAttrs);
      await loadItemDetails(id);
      if (refreshData) await refreshData();
      showToast?.('Garment finalized & confirmed in your wardrobe!', 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to finalize garment', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle re-running CV pipeline
  const handleRetryProcessing = async () => {
    if (!id) return;
    try {
      setIsRetrying(true);
      await api.clothing.retryProcessing(id);
      showToast?.('Garment re-queued for computer-vision processing.', 'info');
      setTimeout(() => loadItemDetails(id), 2500);
    } catch (err: any) {
      showToast?.(err.message || 'Retry failed', 'error');
    } finally {
      setIsRetrying(false);
    }
  };

  // Generate outfit combinations that incorporate this item
  const relatedOutfits = useMemo(() => {
    if (!item) return [];

    const otherCategories = wardrobe.filter((i) => i.id !== item.id && i.category !== item.category);

    return [
      {
        id: 'combo_1',
        title: `${item.style || 'Signature'} Daily Fit`,
        occasion: (item as any)?.occasion || 'Casual Daily',
        pieces: [item, ...otherCategories.slice(0, 3)],
      },
      {
        id: 'combo_2',
        title: `Harmonious ${item.color || 'Editorial'} Contrast`,
        occasion: 'Work & Office',
        pieces: [item, ...otherCategories.slice(3, 6)],
      },
    ];
  }, [item, wardrobe]);

  if (!item) {
    return (
      <AppShell>
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800">
          <p className="font-bold text-lg text-zinc-900 dark:text-zinc-100">Clothing item not found</p>
          <Button
            variant="outline"
            size="md"
            onClick={() => navigate('/wardrobe')}
            icon={<ArrowLeft className="w-4 h-4" />}
            className="mt-4"
          >
            Back to Wardrobe
          </Button>
        </div>
      </AppShell>
    );
  }

  const catalogImgUrl = api.clothing.getProcessedImageUrl(item.id);
  const originalImgUrl = api.clothing.getOriginalImageUrl(item.id);
  const displayImgUrl = activeTab === 'catalog' ? catalogImgUrl : originalImgUrl;
  const isFinalized = attributesData?.is_finalized || false;
  const pred = attributesData?.original_prediction;
  const predAttrs = pred?.predicted_attributes || {};

  return (
    <AppShell>
      {/* Back button */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/wardrobe')}
          className="inline-flex items-center gap-2 h-11 px-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to My Wardrobe</span>
        </button>

        <div className="flex items-center gap-2">
          {isFinalized ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Finalized & Confirmed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-3.5 h-3.5" />
              Ready for Review
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRetryProcessing}
            disabled={isRetrying}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />}
          >
            Re-run CV
          </Button>
        </div>
      </div>

      {/* Main Item Detail Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden p-6 sm:p-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Image Column with Catalog vs Original Toggle */}
          <div className="md:col-span-5 space-y-3">
            <div className="rounded-md overflow-hidden aspect-[3/4] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 relative group flex items-center justify-center">
              <img
                src={displayImgUrl}
                alt={item.name}
                onError={(e) => {
                  // Fallback to item.image if processed URL fails
                  (e.target as HTMLImageElement).src = item.image;
                }}
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
              />
              {item.isFavorite && (
                <span className="absolute top-4 left-4 bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 px-3 py-1 rounded-md text-xs font-semibold shadow-sm flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                  Capsule Favorite
                </span>
              )}
            </div>

            {/* Catalog vs Original Switcher */}
            <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setActiveTab('catalog')}
                className={`py-1.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'catalog'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200 dark:border-zinc-700'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Clean Catalog</span>
              </button>
              <button
                onClick={() => setActiveTab('original')}
                className={`py-1.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'original'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200 dark:border-zinc-700'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Original Photo</span>
              </button>
            </div>

            {/* Avatar Readiness Pill */}
            {avatarData && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    2D Avatar Ready
                  </span>
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-mono">
                    {avatarData.avatar_sprite_key}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  <span>Tint:</span>
                  <span
                    className="w-3 h-3 rounded-full border border-zinc-300 dark:border-zinc-600"
                    style={{ backgroundColor: avatarData.avatar_color_tint }}
                  />
                  <span>{avatarData.dominant_color}</span>
                </div>
              </div>
            )}
          </div>

          {/* Item Attributes & Review Column */}
          <div className="md:col-span-7 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  <span>{item.category}</span>
                  {item.brand && <span>· {item.brand}</span>}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {item.name}
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Cataloged · {item.timesWorn || 0} times worn
                </p>
              </div>

              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  icon={<Sliders className="w-3.5 h-3.5" />}
                >
                  Edit Attributes
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveAttributes}
                    disabled={isSaving}
                  >
                    Save Changes
                  </Button>
                </div>
              )}
            </div>

            {/* Attribute Grid or Editable Review Form */}
            {!isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                    <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Primary Color</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block flex items-center gap-1.5">
                      <span
                        className="w-3 h-3 rounded-full border border-zinc-300 dark:border-zinc-700 shrink-0"
                        style={{ backgroundColor: predAttrs.primary_hex || '#121212' }}
                      />
                      {item.color}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                    <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Pattern</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block capitalize">
                      {item.pattern || 'Solid'}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                    <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Category</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block capitalize">
                      {item.category}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                    <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Sleeve Type</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block capitalize">
                      {editSleeveType.replace('_', ' ') || 'Regular'}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                    <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Neckline / Collar</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block capitalize">
                      {editNeckline.replace('_', ' ') || 'Regular'}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                    <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Formality</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                      {predAttrs.formality ? `${Math.round(predAttrs.formality * 100)}%` : 'Everyday'}
                    </span>
                  </div>
                </div>

                {/* AI Evidence & Classification Method Card */}
                {pred && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
                    <div className="flex items-center justify-between font-semibold text-zinc-800 dark:text-zinc-200">
                      <span className="flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        CV Model Extraction Evidence
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {pred.model_name} v{pred.model_version}
                      </span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Deterministic pixel-level CIELAB color clustering & spatial frequency gradient analysis executed entirely on-device without generative extrapolation.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* EDITABLE ATTRIBUTE FORM */
              <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-md border border-zinc-200 dark:border-zinc-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Garment Category
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} ({c.group})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Primary Color Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Primary Color
                    </label>
                    <select
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    >
                      {TAILORBIRD_COLORS.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Pattern Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Pattern
                    </label>
                    <select
                      value={editPattern}
                      onChange={(e) => setEditPattern(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    >
                      {PATTERNS.map((p) => (
                        <option key={p} value={p}>
                          {p.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sleeve Type */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Sleeve Type
                    </label>
                    <select
                      value={editSleeveType}
                      onChange={(e) => setEditSleeveType(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    >
                      {SLEEVE_TYPES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Neckline */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Neckline / Collar
                    </label>
                    <select
                      value={editNeckline}
                      onChange={(e) => setEditNeckline(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    >
                      {NECKLINES.map((n) => (
                        <option key={n} value={n}>
                          {n.replace('_', ' ').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Secondary Color */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Secondary Color (Optional)
                    </label>
                    <select
                      value={editSecondaryColor}
                      onChange={(e) => setEditSecondaryColor(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="">None / Solid</option>
                      {TAILORBIRD_COLORS.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveAttributes}
                    disabled={isSaving}
                  >
                    Save & Confirm Attributes
                  </Button>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {!isFinalized && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleFinalize}
                  disabled={isSaving}
                  icon={<Check className="w-4 h-4" />}
                >
                  Finalize & Confirm Garment
                </Button>
              )}
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/create')}
                icon={<Sparkles className="w-4 h-4" />}
              >
                Create Outfit Post With This Piece
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/daily-fit')}
              >
                Test in Daily Fit
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Outfits Using This Item */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Outfits Using This Item
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              Algorithmically synthesized combinations featuring this garment.
            </p>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            {relatedOutfits.length} Generated Combos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {relatedOutfits.map((combo) => (
            <div
              key={combo.id}
              className="bg-white dark:bg-zinc-900 rounded-md p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  {combo.title}
                </h3>
                <span className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-2.5 py-0.5 rounded-md font-medium border border-zinc-200 dark:border-zinc-700">
                  {combo.occasion}
                </span>
              </div>

              {/* Pieces horizontal reel */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {combo.pieces.map((piece) => (
                  <div key={piece.id} className="relative group/piece">
                    <img
                      src={piece.image}
                      alt={piece.name}
                      className="w-full aspect-square rounded-md object-cover border border-zinc-200 dark:border-zinc-800"
                    />
                    <span className="text-[11px] block text-zinc-600 dark:text-zinc-400 truncate mt-1">
                      {piece.name}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/daily-fit')}
                className="w-full text-xs"
              >
                Style in Daily Fit →
              </Button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
};
