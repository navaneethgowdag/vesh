import React, { useState } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ClothingCategory, ClothingColor, Season, StyleVibe } from '../../types';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';

interface AddClothingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: ClothingCategory[] = [
  'Tops',
  'Bottoms',
  'Dresses',
  'Outerwear',
  'Shoes',
  'Accessories',
  'Bags',
];

const COLORS: ClothingColor[] = [
  'White',
  'Black',
  'Beige',
  'Brown',
  'Cognac',
  'Navy',
  'Grey',
  'Olive',
  'Sage',
  'Denim Blue',
  'Terracotta',
  'Burgundy',
  'Cream',
  'Pastel Pink',
];

const STYLES: StyleVibe[] = [
  'Minimal',
  'Casual',
  'Streetwear',
  'Formal',
  'Vintage',
  'Sporty',
  'Smart Casual',
  'Trendy',
  'Quiet Luxury',
];

const SEASONS: Season[] = ['Spring', 'Summer', 'Autumn', 'Winter', 'All-Season'];

export const AddClothingModal: React.FC<AddClothingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addClothingItem, showToast } = useApp();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClothingCategory>('Tops');
  const [color, setColor] = useState<ClothingColor>('White');
  const [pattern, setPattern] = useState('Solid');
  const [style, setStyle] = useState<StyleVibe>('Minimal');
  const [season, setSeason] = useState<Season>('All-Season');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const uploaded = await api.media.upload(file);
        setImageUrl(uploaded.image_url);
        showToast('Image uploaded and optimized', 'success');
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setImageUrl(reader.result);
          }
        };
        reader.readAsDataURL(file);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter a clothing item name', 'info');
      return;
    }

    setIsSubmitting(true);
    try {
      await addClothingItem({
        name: name.trim(),
        category,
        color,
        pattern: pattern || 'Solid',
        style,
        season,
        brand: brand.trim() || undefined,
        notes: notes.trim() || undefined,
        image: imageUrl || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=700&q=80',
        tags: [category.toLowerCase(), style.toLowerCase(), color.toLowerCase()],
        isFavorite: false,
      });

      // Reset form
      setName('');
      setBrand('');
      setNotes('');
      setImageUrl('');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add clothing item', 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add to Digital Wardrobe"
      subtitle="Catalog new pieces for your AI daily recommendations"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Image Preview & Upload */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div className="sm:col-span-4 aspect-square rounded-2xl bg-sand-100 overflow-hidden border border-sand-300 relative group shadow-inner flex items-center justify-center">
            {imageUrl ? (
              <>
                <img
                  src={resolveImageUrl(imageUrl) || FALLBACK_POST_IMAGE}
                  alt="Clothing preview"
                  onError={(e) => {
                    if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                      e.currentTarget.src = FALLBACK_POST_IMAGE;
                    }
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-charcoal-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-medium">Garment Preview</span>
                </div>
              </>
            ) : (
              <div className="text-center p-3">
                <ImageIcon className="w-8 h-8 text-charcoal-400 mx-auto mb-1 opacity-60" />
                <span className="text-[11px] text-charcoal-400 font-medium">No Image Uploaded</span>
              </div>
            )}
          </div>

          <div className="sm:col-span-8 space-y-2.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600">
              Clothing Image
            </label>
            <div className="flex gap-2">
              <label className="cursor-pointer flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-sand-300 rounded-2xl text-xs font-medium text-charcoal-600 hover:border-cognac-600 hover:bg-sand-100 transition-colors">
                <Upload className="w-4 h-4 text-cognac-600" />
                <span>{isUploading ? 'Uploading...' : 'Upload File from Device'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>
            <div>
              <input
                type="url"
                placeholder="Or paste image URL (e.g. Unsplash / brand URL)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full bg-cream-50 border border-sand-300 rounded-xl px-3 py-1.5 text-xs text-charcoal-800 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-cognac-600"
              />
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1">
              Clothing Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Oversized Poplin Button-Down"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-cream-50 border border-sand-300 rounded-xl px-3.5 py-2 text-xs text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-cognac-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1">
              Brand / Label
            </label>
            <input
              type="text"
              placeholder="e.g. The Row, COS, Zara, Vintage"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full bg-cream-50 border border-sand-300 rounded-xl px-3.5 py-2 text-xs text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-cognac-600"
            />
          </div>
        </div>

        {/* Category & Color */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ClothingCategory)}
              className="w-full bg-cream-50 border border-sand-300 rounded-xl px-3.5 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1">
              Primary Color
            </label>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value as ClothingColor)}
              className="w-full bg-cream-50 border border-sand-300 rounded-xl px-3.5 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
            >
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pattern & Style & Season */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1">
              Pattern
            </label>
            <input
              type="text"
              placeholder="e.g. Solid, Striped, Ribbed"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full bg-cream-50 border border-sand-300 rounded-xl px-3 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1">
              Aesthetic Style
            </label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as StyleVibe)}
              className="w-full bg-cream-50 border border-sand-300 rounded-xl px-3 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
            >
              {STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1">
              Season
            </label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value as Season)}
              className="w-full bg-cream-50 border border-sand-300 rounded-xl px-3 py-2 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
            >
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600 mb-1">
            Care & Styling Notes
          </label>
          <textarea
            rows={2}
            placeholder="e.g. 100% French linen, dry clean only. Pairs great with loafers."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-cream-50 border border-sand-300 rounded-xl px-3.5 py-2 text-xs text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-cognac-600 resize-none"
          />
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-sand-200">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={!name.trim() || isSubmitting} isLoading={isSubmitting}>
            Add to Wardrobe
          </Button>
        </div>
      </form>
    </Modal>
  );
};

