import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, AlertCircle, Sparkles } from 'lucide-react';

export interface ComboboxAlternative {
  label: string;
  confidence: number;
}

export interface SearchableComboboxProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  confidence?: number;
  reviewRequired?: boolean;
  isEdited?: boolean;
  isUnconfirmed?: boolean;
  onToggleUnconfirmed?: () => void;
  alternatives?: ComboboxAlternative[];
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  label,
  value,
  options,
  onChange,
  confidence,
  reviewRequired,
  isEdited,
  isUnconfirmed = false,
  onToggleUnconfirmed,
  alternatives = [],
  placeholder = 'Select option...',
  className = '',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const confPercent = confidence !== undefined ? Math.round(confidence * 100) : null;
  const isLowConfidence = reviewRequired || (confidence !== undefined && confidence < 0.45);

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {/* Label and Badge Row */}
      <div className="flex items-center justify-between gap-1.5 text-xs min-h-[22px]">
        <label className="font-semibold text-[#29202B] dark:text-[#F3EEE8] flex items-center gap-1 font-sans">
          {label}
          {required && <span className="text-[#A33D42]">*</span>}
        </label>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {onToggleUnconfirmed && (
            <button
              type="button"
              onClick={onToggleUnconfirmed}
              className="text-[10px] text-[#6D7068] hover:text-[#29202B] dark:hover:text-[#F3EEE8] underline mr-1 cursor-pointer"
            >
              {isUnconfirmed ? 'Confirm' : 'Leave Unconfirmed'}
            </button>
          )}

          {isUnconfirmed ? (
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-[2px] bg-[#DCD4CC] dark:bg-[#392F3E] text-[#6D7068] dark:text-[#A89E9B] border border-[#DCD4CC] dark:border-[#392F3E]">
              Unconfirmed
            </span>
          ) : isEdited ? (
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-[2px] bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0] border border-[#743C49]/30">
              User Corrected
            </span>
          ) : (
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-[2px] bg-[#426B50]/15 text-[#426B50] dark:text-emerald-400 border border-[#426B50]/30">
              AI Predicted
            </span>
          )}

          {confPercent !== null && (
            <span
              className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-[2px] flex items-center gap-1 border ${
                isLowConfidence
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  : 'bg-[#426B50]/10 text-[#426B50] dark:text-emerald-400 border-[#426B50]/20'
              }`}
              title={`EfficientNet-B0 confidence: ${confPercent}%`}
            >
              {isLowConfidence ? (
                <>
                  <AlertCircle className="w-2.5 h-2.5" />
                  <span>{confPercent}% · Review</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{confPercent}% match</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Main Select Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full min-h-[40px] px-3.5 py-2 text-left text-xs sm:text-sm rounded-[3px] border transition-all flex items-center justify-between gap-2 bg-[#FFFFFF] dark:bg-[#241D27] cursor-pointer ${
            isOpen
              ? 'border-[#743C49] dark:border-[#D5A6A0] ring-1 ring-[#743C49]/20'
              : isLowConfidence
              ? 'border-amber-400/80 dark:border-amber-500/60 shadow-xs'
              : 'border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#6D7068]'
          }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`truncate font-medium ${value ? 'text-[#29202B] dark:text-[#F3EEE8]' : 'text-[#6D7068]'}`}>
            {value || placeholder}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[#6D7068] transition-transform duration-200 flex-shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Popover */}
        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[3px] shadow-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
            {/* Search Input Filter */}
            <div className="p-2 border-b border-[#DCD4CC] dark:border-[#392F3E] bg-[#F3EEE8] dark:bg-[#1A151C]">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#6D7068] pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${options.length} options...`}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-[2px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] placeholder:text-[#6D7068] focus:outline-none focus:border-[#743C49] dark:focus:border-[#D5A6A0]"
                />
              </div>
            </div>

            {/* Options List */}
            <ul className="max-h-56 overflow-y-auto py-1 text-xs divide-y divide-zinc-100 dark:divide-zinc-800/40">
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-4 text-center text-zinc-400 italic">
                  No matching options found
                </li>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.toLowerCase() === value?.toLowerCase();
                  return (
                    <li key={opt}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(opt);
                          setIsOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-2 transition-colors ${
                          isSelected
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="truncate">{opt}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Alternative Quick Suggestion Chips */}
      {alternatives.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] text-zinc-400">Model suggestions:</span>
          {alternatives.slice(0, 3).map((alt) => {
            const isAltSelected = alt.label.toLowerCase() === value?.toLowerCase();
            return (
              <button
                key={alt.label}
                type="button"
                onClick={() => onChange(alt.label)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                  isAltSelected
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-semibold'
                    : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                }`}
                title={`Confidence: ${Math.round(alt.confidence * 100)}%`}
              >
                {alt.label} <span className="opacity-60">({Math.round(alt.confidence * 100)}%)</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
