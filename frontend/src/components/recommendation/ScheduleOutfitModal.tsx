import React, { useState } from 'react';
import { Calendar, Clock, MapPin, FileText, Check, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Recommendation, CalendarEvent } from '../../types';
import { api } from '../../services/api';

interface ScheduleOutfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: Recommendation;
  onScheduled: (event: CalendarEvent) => void;
}

export const ScheduleOutfitModal: React.FC<ScheduleOutfitModalProps> = ({
  isOpen,
  onClose,
  recommendation,
  onScheduled,
}) => {
  // Default to tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const [date, setDate] = useState<string>(defaultDateStr);
  const [time, setTime] = useState<string>('09:00');
  const [occasion, setOccasion] = useState<string>(recommendation.outfit.occasion || 'Casual Daily');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError('Please select a calendar date');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const scheduledEvent = await api.calendar.scheduleRecommendation(recommendation.id, {
        date,
        time: time ? `${time}:00` : undefined,
        occasion,
        notes: notes.trim() || undefined,
      });

      onScheduled(scheduledEvent);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to schedule outfit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Planned Outfit">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Outfit Summary Card */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-sand-50 border border-sand-200">
          {recommendation.outfit.image ? (
            <img
              src={recommendation.outfit.image}
              alt={recommendation.outfit.title}
              className="w-16 h-16 rounded-xl object-cover shadow-soft-sm flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-sand-200 flex items-center justify-center text-charcoal-400">
              <Calendar className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cognac-700">
              {recommendation.outfit.occasion}
            </span>
            <h4 className="text-sm font-bold text-charcoal-900 truncate">
              {recommendation.outfit.title}
            </h4>
            <p className="text-xs text-charcoal-500 mt-0.5">
              {recommendation.outfit.pieces.length} curated garments · {recommendation.score}% Match
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Date & Time Picker Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-500 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cognac-600" />
              Event Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-sand-300 bg-cream-50/50 text-sm font-medium text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-cognac-500/20 focus:border-cognac-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-500 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cognac-600" />
              Time (Optional)
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-sand-300 bg-cream-50/50 text-sm font-medium text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-cognac-500/20 focus:border-cognac-600"
            />
          </div>
        </div>

        {/* Occasion / Context */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-500 mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cognac-600" />
            Occasion / Destination
          </label>
          <input
            type="text"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="e.g. Gallery Opening, Board Meeting, Dinner Date"
            className="w-full px-3.5 py-2.5 rounded-xl border border-sand-300 bg-cream-50/50 text-sm font-medium text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-cognac-500/20 focus:border-cognac-600"
          />
        </div>

        {/* Styling Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-500 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-cognac-600" />
            Styling Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add accessory ideas, perfume pairings, or layer adjustments..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-sand-300 bg-cream-50/50 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-cognac-500/20 focus:border-cognac-600 resize-none"
          />
        </div>

        {/* Notice: Does NOT count as worn */}
        <p className="text-[11px] text-charcoal-400 bg-sand-100/60 p-2.5 rounded-xl border border-sand-200">
          ℹ️ Scheduling this look adds it to your calendar as a planned outfit. It will not increment wear counts until you wear it.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting}
            icon={isSubmitting ? undefined : <Check className="w-4 h-4" />}
          >
            {isSubmitting ? 'Scheduling...' : 'Save to Calendar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
