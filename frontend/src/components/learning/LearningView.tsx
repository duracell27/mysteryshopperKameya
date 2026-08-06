import React from 'react';

const SECTION_LABELS: Record<string, { label: string; icon: string }> = {
  general:    { label: 'Загальний розвиток',    icon: 'fa-seedling'   },
  start:      { label: 'Старт роботи',          icon: 'fa-play'       },
  consultant: { label: 'Продавець-консультант', icon: 'fa-tag'        },
  managers:   { label: 'Керівники',             icon: 'fa-crown'      },
  marketing:  { label: 'Маркетинг',             icon: 'fa-bullhorn'   },
};

interface LearningViewProps {
  section: keyof typeof SECTION_LABELS;
}

export const LearningView: React.FC<LearningViewProps> = ({ section }) => {
  const { label, icon } = SECTION_LABELS[section];
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-kameya-burgundy/10 flex items-center justify-center mb-4">
        <i className={`fas ${icon} text-2xl text-kameya-burgundy`} />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">{label}</h2>
      <p className="text-slate-400 text-sm">Розділ в розробці</p>
    </div>
  );
};
