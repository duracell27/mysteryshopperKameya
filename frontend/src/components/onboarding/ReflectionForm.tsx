import React, { useState } from 'react';
import { ReflectionPayload } from '../../services/onboardingService';
import { OnboardingReflection } from '../../types';

interface ReflectionFormProps {
  existing?: OnboardingReflection;
  onSubmit: (data: ReflectionPayload) => Promise<void>;
  onCancel?: () => void;
}

const RATING_QUESTIONS: { key: keyof Pick<ReflectionPayload, 'q1'|'q2'|'q3'|'q5'>; label: string }[] = [
  { key: 'q1', label: 'Як твій настрій сьогодні?' },
  { key: 'q2', label: 'Наскільки зрозумілим був матеріал дня?' },
  { key: 'q3', label: 'Наскільки комфортно ти почувався в салоні?' },
  { key: 'q5', label: 'Твоя лояльність до Камеї' },
];

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600 mb-2">{label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-full border-2 text-sm font-bold transition-all
              ${value === n
                ? 'bg-kameya-burgundy border-kameya-burgundy text-white shadow-sm'
                : 'border-slate-200 text-slate-400 hover:border-kameya-burgundy/50 hover:text-kameya-burgundy'}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export const ReflectionForm: React.FC<ReflectionFormProps> = ({ existing, onSubmit, onCancel }) => {
  const [form, setForm] = useState<ReflectionPayload>({
    q1: existing?.q1 ?? 3,
    q2: existing?.q2 ?? 3,
    q3: existing?.q3 ?? 3,
    q4: existing?.q4 ?? '',
    q5: existing?.q5 ?? 3,
    comments: existing?.comments ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setRating = (key: 'q1'|'q2'|'q3'|'q5') => (v: number) => setForm((f) => ({ ...f, [key]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.q1 || !form.q2 || !form.q3 || !form.q5) {
      setError('Будь ласка, оціни всі питання.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
    } catch {
      setError('Помилка збереження. Спробуй ще раз.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h3 className="text-sm font-bold text-slate-700">Рефлексія дня</h3>

      {RATING_QUESTIONS.map((q) => (
        <RatingRow
          key={q.key}
          label={q.label}
          value={form[q.key] as number}
          onChange={setRating(q.key)}
        />
      ))}

      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">
          Що тебе стресувало або дивувало сьогодні?
        </label>
        <textarea
          value={form.q4}
          onChange={(e) => setForm((f) => ({ ...f, q4: e.target.value }))}
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-kameya-burgundy resize-none"
          placeholder="Необов'язково..."
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Коментар</label>
        <textarea
          value={form.comments}
          onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-kameya-burgundy resize-none"
          placeholder="Необов'язково..."
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-kameya-burgundy text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {saving ? 'Збереження...' : existing ? 'Оновити рефлексію' : 'Зберегти рефлексію'}
      </button>
    </form>
  );
};
