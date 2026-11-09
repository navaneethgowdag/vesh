import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Tag,
  Palette,
  Compass,
  Shirt,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { SearchableCombobox } from '../components/wardrobe/SearchableCombobox';
import defaultClassMappings from '../data/classMappings.json';

export const ClothingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { wardrobe, refreshData, showToast } = useApp();

  const item = wardrobe.find((i) => i.id === id);

  // Class options
  const [classOptions, setClassOptions] = useState<Record<string, string[]>>(defaultClassMappings);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [attributesData, setAttributesData] = useState<any>(null);

  // 9 Model Attributes Form State
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editArticleType, setEditArticleType] = useState('Shirts');
  const [editMasterCategory, setEditMasterCategory] = useState('Apparel');
  const [editSubCategory, setEditSubCategory] = useState('Topwear');
  const [editBaseColour, setEditBaseColour] = useState('Black');
  const [editPattern, setEditPattern] = useState('Solid');
  const [editGender, setEditGender] = useState('Unisex');
  const [editSeason, setEditSeason] = useState('Summer');
  const [editUsage, setEditUsage] = useState('Casual');
  const [editAgeGroup, setEditAgeGroup] = useState('Adults-Unisex');

  // Load class options and item details
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

        setEditName(cur.name || item?.name || '');
        setEditBrand(cur.brand || item?.brand || '');
        setEditArticleType(cur.article_type || pred.article_type || item?.category || 'Shirts');
        setEditMasterCategory(cur.master_category || pred.master_category || 'Apparel');
        setEditSubCategory(cur.sub_category || pred.sub_category || 'Topwear');
        setEditBaseColour(cur.base_colour || cur.primary_color || item?.color || 'Black');
        setEditPattern(cur.pattern || item?.pattern || 'Solid');
        setEditGender(cur.gender || pred.gender || 'Unisex');
        setEditSeason(cur.season || item?.season || 'Summer');
        setEditUsage(cur.usage || cur.occasion || (item as any)?.occasion || 'Casual');
        setEditAgeGroup(cur.age_group || pred.age_group || 'Adults-Unisex');
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

  // Handle saving attribute corrections
  const handleSaveAttributes = async () => {
    if (!id) return;
    try {
      setIsSaving(true);
      const updates = {
        name: editName.trim() || undefined,
        brand: editBrand.trim() || undefined,
        article_type: editArticleType,
        master_category: editMasterCategory,
        sub_category: editSubCategory,
        base_colour: editBaseColour,
        pattern: editPattern,
        gender: editGender,
        season: editSeason,
        usage: editUsage,
        age_group: editAgeGroup,
        // Backward compatibility
        category: editArticleType,
        primary_color: editBaseColour,
        occasion: editUsage,
      };

      await api.clothing.updateAttributes(id, updates);
      await loadItemDetails(id);
      if (refreshData) await refreshData();
      setIsEditing(false);
      showToast?.('Garment attributes updated successfully!', 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to update attributes', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  if (!item) {
    return (
      <AppShell>
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
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

  const originalImgUrl = api.clothing.getOriginalImageUrl(item.id);
  const displayImgUrl = originalImgUrl || item.image;
  const isFinalized = attributesData?.is_finalized || false;
  const pred = attributesData?.original_prediction;
  const predScores = pred?.prediction_scores || {};
  const currentAttrs = attributesData?.current_attributes || {};

  return (
    <AppShell>
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/wardrobe')}
          className="inline-flex items-center gap-2 h-10 px-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to My Wardrobe</span>
        </button>

        <div className="flex items-center gap-2">
          {isFinalized ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirmed Attributes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-3.5 h-3.5" />
              Review Pending
            </span>
          )}
        </div>
      </div>

      {/* Main Item Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden p-6 sm:p-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left: Original Photograph Showcase */}
          <div className="md:col-span-5 space-y-3">
            <div className="rounded-2xl overflow-hidden aspect-[3/4] bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 relative group flex items-center justify-center">
              <img
                src={displayImgUrl}
                alt={item.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = item.image;
                }}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute top-3 left-3">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md text-white border border-white/20">
                  Wardrobe Piece
                </span>
              </div>
            </div>

            {/* AI Architecture Pill */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  EfficientNet-B0 Classification
                </span>
                <span className="text-[10px] font-mono text-zinc-500">v1.0.0</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Extracted directly from the original uploaded photo across 9 multi-task prediction heads.
              </p>
            </div>
          </div>

          {/* Right: Attributes Display / Form */}
          <div className="md:col-span-7 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  <span>{currentAttrs.master_category || 'Apparel'}</span>
                  <span>·</span>
                  <span>{currentAttrs.sub_category || 'Topwear'}</span>
                  {item.brand && <span>· {item.brand}</span>}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {currentAttrs.name || item.name}
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Cataloged · Worn {item.timesWorn || 0} times
                </p>
              </div>

              {!isEditing ? (
                <div className="flex items-center gap-2">
                  {!isFinalized && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        try {
                          await api.clothing.finalize(id!);
                          await loadItemDetails(id!);
                          if (refreshData) await refreshData();
                          showToast?.('Garment confirmed and accepted into wardrobe!', 'success');
                        } catch (err: any) {
                          showToast?.(err.message || 'Failed to accept garment', 'info');
                        }
                      }}
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Accept & Confirm
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    icon={<Sliders className="w-3.5 h-3.5" />}
                  >
                    Edit Attributes
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveAttributes}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>

            {/* VIEW MODE: 3 Sensible Groups with Confidence Badges */}
            {!isEditing ? (
              <div className="space-y-6">
                {/* 1. Garment identification */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-zinc-100 dark:border-zinc-800">
                    <Tag className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                      Garment Identification
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                        Article Type
                      </span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block truncate">
                        {currentAttrs.article_type || item.category}
                      </span>
                      {predScores.article_type?.confidence && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                          {Math.round(predScores.article_type.confidence * 100)}% match
                        </span>
                      )}
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                        Master Category
                      </span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block truncate">
                        {currentAttrs.master_category || 'Apparel'}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                        Subcategory
                      </span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block truncate">
                        {currentAttrs.sub_category || 'Topwear'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Appearance */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-zinc-100 dark:border-zinc-800">
                    <Palette className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                      Appearance
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                        Base Colour
                      </span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-zinc-900 dark:bg-zinc-100 border border-zinc-300 dark:border-zinc-700" />
                        {currentAttrs.base_colour || item.color}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                        Pattern
                      </span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                        {currentAttrs.pattern || item.pattern || 'Solid'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Catalog Context */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-zinc-100 dark:border-zinc-800">
                    <Compass className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                      Catalog Context
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                        Gender
                      </span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                        {currentAttrs.gender || 'Unisex'}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                        Season
                      </span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                        {currentAttrs.season || item.season || 'Summer'}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                        Usage / Occasion
                      </span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                        {currentAttrs.usage || currentAttrs.occasion || 'Casual'}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                        Age Group
                      </span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block truncate">
                        {currentAttrs.age_group || 'Adults-Unisex'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* EDIT MODE: Combobox inputs strictly from actual class mappings */
              <div className="space-y-5 p-5 bg-zinc-50 dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                {/* Basic fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                      Garment Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                      Brand (Optional)
                    </label>
                    <input
                      type="text"
                      value={editBrand}
                      onChange={(e) => setEditBrand(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Garment Identification */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SearchableCombobox
                    label="Article Type"
                    value={editArticleType}
                    options={classOptions.article_type || []}
                    onChange={setEditArticleType}
                  />
                  <SearchableCombobox
                    label="Master Category"
                    value={editMasterCategory}
                    options={classOptions.master_category || []}
                    onChange={setEditMasterCategory}
                  />
                  <SearchableCombobox
                    label="Subcategory"
                    value={editSubCategory}
                    options={classOptions.sub_category || []}
                    onChange={setEditSubCategory}
                  />
                </div>

                {/* Appearance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SearchableCombobox
                    label="Base Colour"
                    value={editBaseColour}
                    options={classOptions.base_colour || []}
                    onChange={setEditBaseColour}
                  />
                  <SearchableCombobox
                    label="Pattern"
                    value={editPattern}
                    options={classOptions.pattern || []}
                    onChange={setEditPattern}
                  />
                </div>

                {/* Catalog Context */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <SearchableCombobox
                    label="Gender"
                    value={editGender}
                    options={classOptions.gender || []}
                    onChange={setEditGender}
                  />
                  <SearchableCombobox
                    label="Season"
                    value={editSeason}
                    options={classOptions.season || []}
                    onChange={setEditSeason}
                  />
                  <SearchableCombobox
                    label="Usage"
                    value={editUsage}
                    options={classOptions.usage || []}
                    onChange={setEditUsage}
                  />
                  <SearchableCombobox
                    label="Age Group"
                    value={editAgeGroup}
                    options={classOptions.age_group || []}
                    onChange={setEditAgeGroup}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};
