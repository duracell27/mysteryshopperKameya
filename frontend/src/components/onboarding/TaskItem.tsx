import React from 'react';
import { OnboardingTask } from '../../types';

const TYPE_LABELS: Record<OnboardingTask['type'], string> = {
  theory:      'Теорія',
  practice:    'Практика',
  meeting:     'Зустріч',
  observation: 'Спостереження',
  other:       'Інше',
};

const TYPE_COLORS: Record<OnboardingTask['type'], string> = {
  theory:      'bg-blue-100 text-blue-700',
  practice:    'bg-green-100 text-green-700',
  meeting:     'bg-purple-100 text-purple-700',
  observation: 'bg-amber-100 text-amber-700',
  other:       'bg-slate-100 text-slate-600',
};

interface TaskItemProps {
  task: OnboardingTask;
  disabled?: boolean;
  onToggle: (taskId: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, disabled, onToggle }) => (
  <div
    className={`flex items-start gap-3 p-4 rounded-xl border transition-all duration-150
      ${task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
  >
    <button
      onClick={() => !disabled && onToggle(task.id)}
      disabled={disabled}
      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
        ${task.completed
          ? 'bg-green-500 border-green-500'
          : disabled
          ? 'border-slate-200 bg-slate-100 cursor-not-allowed'
          : 'border-slate-300 hover:border-kameya-burgundy'}`}
    >
      {task.completed && <i className="fas fa-check text-white text-[10px]" />}
    </button>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[task.type]}`}>
          {TYPE_LABELS[task.type]}
        </span>
        <span className={`text-sm font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {task.title}
        </span>
      </div>
      {task.description && (
        <p className="text-xs text-slate-500 mt-1">{task.description}</p>
      )}
    </div>
  </div>
);
