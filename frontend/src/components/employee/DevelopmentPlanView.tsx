import React, { useState, useEffect } from 'react';
import { AuditResult } from '../../types';
import { getMyReports } from '../../services/reportsService';
import { ScoreInsightCard } from './ScoreInsightCard';
import { PerfectScoreWidget } from './PerfectScoreWidget';
import { LearningPlanSection } from './LearningPlanSection';

export const DevelopmentPlanView: React.FC = () => {
  const [lastAudit, setLastAudit] = useState<AuditResult | undefined>();
  const [allReports, setAllReports] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [learningPlanLoading, setLearningPlanLoading] = useState(false);

  useEffect(() => {
    getMyReports()
      .then(reports => {
        setAllReports(reports);
        if (reports.length > 0) setLastAudit(reports[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpdated = (updated: AuditResult) => {
    setLastAudit(updated);
    setAllReports(prev => prev.map(r =>
      (r._id ?? r.id) === (updated._id ?? updated.id) ? updated : r
    ));
  };

  const perfectCount = allReports.filter(r => r.totalScore === 100).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <i className="fas fa-spinner fa-spin text-3xl text-kameya-burgundy"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">План розвитку</h2>
        <p className="text-slate-500 mt-1">Твій план росту та завдання для навчання</p>
      </header>

      {lastAudit ? (
        lastAudit.totalScore === 100 ? (
          <PerfectScoreWidget
            report={lastAudit}
            perfectCount={perfectCount}
            onInsightUpdated={handleUpdated}
          />
        ) : (
          <ScoreInsightCard
            lastAudit={lastAudit}
            allReports={allReports}
            onInsightUpdated={handleUpdated}
            onLearningPlanLoading={setLearningPlanLoading}
          />
        )
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center min-h-[160px]">
          <i className="fas fa-clipboard text-5xl text-slate-200 mb-4"></i>
          <p className="text-slate-500 font-medium">Перевірок ще немає</p>
          <p className="text-xs text-slate-400 mt-2">Ваш план розвитку з'явиться після першої перевірки</p>
        </div>
      )}

      <LearningPlanSection
        lastAudit={lastAudit}
        loading={learningPlanLoading}
        onPlanUpdated={handleUpdated}
        onNavigateToTraining={() => {}}
      />
    </div>
  );
};
