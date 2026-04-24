import React, { useEffect, useState } from 'react';
import { AuditResult } from '../../types';
import { generateAiRecommendations, submitScoreInsight } from '../../services/reportsService';

interface Props {
  lastAudit: AuditResult;
  allReports: AuditResult[];
  onInsightUpdated: (updated: AuditResult) => void;
}

export const ScoreInsightCard: React.FC<Props> = ({ lastAudit, allReports, onInsightUpdated }) => {
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalText, setGoalText] = useState('');
  const [whatHelpedText, setWhatHelpedText] = useState('');

  const reportId = lastAudit._id ?? lastAudit.id ?? '';
  const score = lastAudit.totalScore;
  const isPerfect = score === 100;
  const ai = lastAudit.aiRecommendations;
  const insight = lastAudit.scoreInsight;
  const perfectCount = allReports.filter(r => r.totalScore === 100).length;

  // Trigger generation on first open (skip for 100%)
  useEffect(() => {
    if (isPerfect) return;
    if (ai) return;
    if (!reportId) return;

    setGenerating(true);
    generateAiRecommendations(reportId)
      .then(updated => onInsightUpdated(updated))
      .catch(err => setError(err.message))
      .finally(() => setGenerating(false));
  }, [reportId]);

  const handleSubmitGoal = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitScoreInsight(reportId, { goalText });
      onInsightUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleSubmitWhatHelped = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitScoreInsight(reportId, { whatHelpedText });
      onInsightUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 100% — static celebration ──
  if (isPerfect) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center space-y-3">
        <div className="text-5xl">🏆</div>
        <p className="text-xl font-bold text-slate-800">Ідеальна перевірка!</p>
        <p className="text-sm text-slate-500">
          {perfectCount > 1 ? `Це твій ${perfectCount}-й результат 100%` : 'Перший результат 100% — неймовірно!'}
        </p>
        {!insight && (
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="mt-2 px-5 py-2 bg-kameya-burgundy text-white rounded-xl font-bold text-sm hover:bg-red-900 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Зберігаємо...' : 'Відзначити досягнення'}
          </button>
        )}
        {insight && (
          <span className="text-xs text-green-600 flex items-center gap-1 font-semibold">
            <i className="fas fa-circle-check"></i> Зафіксовано
          </span>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  // ── Generating ──
  if (generating) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center space-y-3 min-h-[200px]">
        <i className="fas fa-spinner fa-spin text-2xl text-kameya-burgundy"></i>
        <p className="text-sm font-medium text-slate-600">Обробляємо ваші рекомендації...</p>
        <p className="text-xs text-slate-400">Це займе кілька секунд</p>
      </div>
    );
  }

  // ── Error ──
  if (error && !ai) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex flex-col items-center justify-center text-center space-y-2 min-h-[200px]">
        <i className="fas fa-circle-exclamation text-2xl text-red-400"></i>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!ai) return null;

  const tier = ai.tier;

  // ── Submitted — read-only view ──
  if (insight) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Твій план росту</p>
        <p className="text-sm text-slate-600 font-medium">{ai.mainMessage}</p>
        {ai.weakPoints.length > 0 && (
          <ul className="space-y-2">
            {ai.weakPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <i className="fas fa-circle-arrow-right text-kameya-burgundy mt-0.5 flex-shrink-0"></i>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-slate-100 pt-3 space-y-1">
          {tier === 'below85' && insight.goalText && (
            <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Твоя ціль</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">{insight.goalText}</p>
            </>
          )}
          {tier === 'range85to94' && insight.confirmedAt && (
            <p className="text-sm text-green-700 flex items-center gap-2 font-semibold">
              <i className="fas fa-circle-check text-green-500"></i>
              Ти підтвердив, що знаєш над чим працювати
            </p>
          )}
          {tier === 'range95to99' && insight.whatHelpedText && (
            <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Що допомогло</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">{insight.whatHelpedText}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Ready for input ──
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Твій план росту</p>
      <p className="text-sm text-slate-600 font-medium">{ai.mainMessage}</p>

      {ai.weakPoints.length > 0 && (
        <ul className="space-y-2">
          {ai.weakPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <i className="fas fa-circle-arrow-right text-kameya-burgundy mt-0.5 flex-shrink-0"></i>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}

      {tier === 'below85' && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Яка твоя ціль до наступної перевірки?
          </label>
          <textarea
            value={goalText}
            onChange={e => setGoalText(e.target.value)}
            rows={3}
            placeholder="Напиши конкретну ціль..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-kameya-burgundy"
          />
          <button
            onClick={handleSubmitGoal}
            disabled={submitting || !goalText.trim()}
            className="w-full py-2 bg-kameya-burgundy text-white rounded-xl font-bold text-sm hover:bg-red-900 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Зберігаємо...' : 'Зафіксувати ціль'}
          </button>
        </div>
      )}

      {tier === 'range85to94' && (
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full py-2 bg-kameya-burgundy text-white rounded-xl font-bold text-sm hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Зберігаємо...' : 'Розумію, буду працювати над цим'}
        </button>
      )}

      {tier === 'range95to99' && ai.question && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {ai.question}
          </label>
          <textarea
            value={whatHelpedText}
            onChange={e => setWhatHelpedText(e.target.value)}
            rows={3}
            placeholder="Поділись своїм досвідом..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-kameya-burgundy"
          />
          <button
            onClick={handleSubmitWhatHelped}
            disabled={submitting || !whatHelpedText.trim()}
            className="w-full py-2 bg-kameya-burgundy text-white rounded-xl font-bold text-sm hover:bg-red-900 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Зберігаємо...' : 'Поділитись'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};
