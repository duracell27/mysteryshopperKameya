import React, { useState, useEffect } from 'react';
import { AuditResult } from '../../types';
import { getMyReports } from '../../services/reportsService';
import { LearningPlanSection } from './LearningPlanSection';

export const DevelopmentPlanView: React.FC = () => {
  const [lastAudit, setLastAudit] = useState<AuditResult | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyReports()
      .then(reports => {
        if (reports.length > 0) setLastAudit(reports[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpdated = (updated: AuditResult) => {
    setLastAudit(updated);
  };

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

      <LearningPlanSection
        lastAudit={lastAudit}
        loading={false}
        onPlanUpdated={handleUpdated}
        onNavigateToTraining={() => {}}
      />
    </div>
  );
};
