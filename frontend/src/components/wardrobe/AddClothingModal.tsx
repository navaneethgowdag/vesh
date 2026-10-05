import React, { useState } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ClothingCategory, ClothingColor, Season, StyleVibe } from '../../types';
import { useApp } from '../../context/AppContext';

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

const SAMPLE_PRESETS = [
  {
    name: 'Washed Camel Oversized Trench',
    category: 'Outerwear' as ClothingCategory,
    color: 'Beige' as ClothingColor,
    style: 'Quiet Luxury' as StyleVibe,
    season: 'Autumn' as Season,
    brand: 'Totême',
    pattern: 'Solid',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=700&q=80',
    notes: 'Timeless gabardine cut with generous storm flap.',
  },
  {
    name: 'Pleated Raw Silk Ivory Shirt',
    category: 'Tops' as ClothingCategory,
    color: 'Cream' as ClothingColor,
    style: 'Minimal' as StyleVibe,
    season: 'All-Season' as Season,
    brand: 'Lemaire',
    pattern: 'Solid',
    image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=700&q=80',
    notes: 'Architectural collar and relaxed sleeve drop.',
  },
  {
    name: 'Wide-Leg Ecru Tailored Slacks',
    category: 'Bottoms' as ClothingCategory,
    color: 'Cream' as ClothingColor,
    style: 'Smart Casual' as StyleVibe,
    season: 'Summer' as Season,
    brand: 'The Frankie Shop',
    pattern: 'Solid',
    image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=700&q=80',
    notes: 'High-waist double pleat for clean fall.',
  },
  {
    name: 'Minimalist Chunky Derby Shoes',
    category: 'Shoes' as ClothingCategory,
    color: 'Black' as ClothingColor,
    style: 'Smart Casual' as StyleVibe,
    season: 'All-Season' as Season,
    brand: 'Prada',
    pattern: 'Solid',
    image: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=700&q=80',
    notes: 'Polished calf leather with lugged rubber sole.',
  }
];

export const AddClothingModal: React.FC<AddClothingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addClothingItem } = useApp();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClothingCategory>('Tops');
  const [color, setColor] = useState<ClothingColor>('White');
  const [pattern, setPattern] = useState('Solid');
  const [style, setStyle] = useState<StyleVibe>('Minimal');
  const [season, setSeason] = useState<Season>('All-Season');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState(
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=700&q=80'
  );

  const applyPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setName(preset.name);
    setCategory(preset.category);
    setColor(preset.color);
    setStyle(preset.style);
    setSeason(preset.season);
    setBrand(preset.brand);
    setPattern(preset.pattern);
    setImageUrl(preset.image);
    setNotes(preset.notes);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addClothingItem({
      name: name.trim(),
      category,
      color,
      pattern: pattern || 'Solid',
      style,
      season,
      brand: brand.trim() || undefined,
      notes: notes.trim() || undefined,
      image: imageUrl,
      tags: [category.toLowerCase(), style.toLowerCase(), color.toLowerCase()],
      isFavorite: false,
    });

    // Reset form
    setName('');
    setBrand('');
    setNotes('');
    onClose();
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
        {/* Quick Sample Presets */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-500 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cognac-600" />
            Quick Presets (or enter custom details below)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SAMPLE_PRESETS.map((p) => (
              <button
                type="button"
                key={p.name}
                onClick={() => applyPreset(p)}
                className="text-left p-2 rounded-xl bg-sand-100/70 hover:bg-sand-200 border border-sand-200/80 transition-all flex items-center gap-2"
              >
                <img src={p.image} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                <span className="text-[11px] font-medium text-charcoal-800 line-clamp-1">
                  {p.name.split(' ')[0]} {p.name.split(' ')[1]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Image Preview & Upload */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div className="sm:col-span-4 aspect-square rounded-2xl bg-sand-100 overflow-hidden border border-sand-300 relative group shadow-inner">
            <img src={imageUrl} alt="Clothing preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-charcoal-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-medium">Garment Preview</span>
            </div>
          </div>

          <div className="sm:col-span-8 space-y-2.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-600">
              Clothing Image
            </label>
            <div className="flex gap-2">
              <label className="cursor-pointer flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-sand-300 rounded-2xl text-xs font-medium text-charcoal-600 hover:border-cognac-600 hover:bg-sand-100 transition-colors">
                <Upload className="w-4 h-4 text-cognac-600" />
                <span>Upload File from Device</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
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
          <Button type="submit" variant="primary" size="md" disabled={!name.trim()}>
            Add to Wardrobe
          </Button>
        </div>
      </form>
    </Modal>
  );
};

