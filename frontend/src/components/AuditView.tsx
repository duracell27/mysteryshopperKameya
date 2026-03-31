import React from 'react';
import { AuditResult } from '../types';
import { formatDate } from '../utils/dateFormatter';

interface AuditViewProps {
  audit: AuditResult;
  onStartAnalysis: () => void;
  isAnalyzing: boolean;
}

export const AuditView: React.FC<AuditViewProps> = ({ audit, onStartAnalysis, isAnalyzing }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Звіт перевірки</h2>
          <p className="text-slate-500">Дата: {formatDate(audit.date)}{audit.store ? ` · ${audit.store}` : ''}</p>
        </div>
        <button
          onClick={onStartAnalysis}
          disabled={isAnalyzing}
          className="flex items-center justify-center space-x-2 bg-kameya-burgundy text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
        >
          {isAnalyzing ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              <span>AI Аналізує...</span>
            </>
          ) : (
            <>
              <i className="fas fa-wand-magic-sparkles"></i>
              <span>Отримати AI Рекомендації</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {audit.sections.map((section, idx) => (
          <div key={idx} className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-700">{section.title}</h3>
              <span className={`text-sm font-semibold ${section.score < section.maxScore * 0.7 ? 'text-red-600' : 'text-green-600'}`}>
                {section.score} / {section.maxScore}
              </span>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm italic text-slate-600">"{section.feedback}"</p>
              <div className="divide-y divide-slate-100">
                {section.questions.map((q, qIdx) => (
                  <div key={qIdx} className="py-3 flex items-start space-x-3">
                    <i className={`fas ${q.isCorrect ? 'fa-check text-green-500' : 'fa-xmark text-red-500'} mt-0.5`}></i>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{q.question}</p>
                      <p className="text-xs text-slate-500">Відповідь: {q.answer}</p>
                      {q.comment && (
                        <p className="text-xs text-kameya-burgundy mt-1 font-medium italic">— {q.comment}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
