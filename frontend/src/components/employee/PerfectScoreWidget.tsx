import React, { useState } from 'react';
import { AuditResult } from '../../types';
import { submitScoreInsight } from '../../services/reportsService';

interface Props {
  report: AuditResult;
  perfectCount: number;
  onInsightUpdated: (updated: AuditResult) => void;
}

const STAR_POSITIONS = [
  { left: '8%',  top: '18%', size: '1rem',    delay: '0s'    },
  { left: '20%', top: '72%', size: '0.75rem', delay: '0.5s'  },
  { left: '35%', top: '12%', size: '1.2rem',  delay: '0.9s'  },
  { left: '52%', top: '80%', size: '0.8rem',  delay: '0.3s'  },
  { left: '65%', top: '15%', size: '1rem',    delay: '1.1s'  },
  { left: '78%', top: '65%', size: '0.7rem',  delay: '0.7s'  },
  { left: '88%', top: '28%', size: '1.1rem',  delay: '0.2s'  },
  { left: '92%', top: '75%', size: '0.9rem',  delay: '1.4s'  },
];

export const PerfectScoreWidget: React.FC<Props> = ({ report, perfectCount, onInsightUpdated }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportId = report._id ?? report.id ?? '';
  const insight = report.scoreInsight;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitScoreInsight(reportId, {});
      onInsightUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="perfect-score-widget bg-white rounded-2xl border border-yellow-200 overflow-hidden relative min-h-[220px]">
      {STAR_POSITIONS.map((s, i) => (
        <span
          key={i}
          className="float-star absolute text-yellow-400 select-none pointer-events-none"
          style={{ left: s.left, top: s.top, fontSize: s.size, animationDelay: s.delay }}
        >
          ✦
        </span>
      ))}

      <div className="relative z-10 p-6 flex flex-col items-center justify-center text-center space-y-3 h-full">
        <div className="trophy-bounce text-5xl">🏆</div>
        <p className="text-xl font-bold text-slate-800">Ідеальна перевірка!</p>
        <p className="text-sm font-semibold text-amber-600">
          {perfectCount > 1
            ? `Ви досягали 100% вже ${perfectCount} рази`
            : 'Перший результат 100% — неймовірно!'}
        </p>

        {!insight ? (
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="mt-1 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 shadow-md"
          >
            {submitting ? 'Зберігаємо...' : '🌟 Відзначити досягнення'}
          </button>
        ) : (
          <span className="text-sm text-green-600 flex items-center gap-1 font-semibold">
            <i className="fas fa-circle-check"></i> Досягнення зафіксовано
          </span>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
};
