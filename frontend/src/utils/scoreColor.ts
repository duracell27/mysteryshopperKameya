export interface ScoreStyle {
  textClass: string;
  bgClass: string;
  borderClass: string;
  icon?: string;
}

export function getScoreStyle(totalScore: number): ScoreStyle {
  const s = Math.floor(totalScore);
  if (s === 100) return {
    textClass: 'text-green-700',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-400',
    icon: '🏆',
  };
  if (s >= 95) return {
    textClass: 'text-green-600',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
  };
  if (s >= 80) return {
    textClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50',
    borderClass: 'border-yellow-200',
  };
  return {
    textClass: 'text-red-600',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
  };
}

export function scoreTextClass(totalScore: number): string {
  return getScoreStyle(totalScore).textClass;
}

export function scoreBgBorderClass(totalScore: number): string {
  const s = getScoreStyle(totalScore);
  return `${s.bgClass} ${s.borderClass}`;
}

export function scoreBarBgClass(totalScore: number): string {
  const s = Math.floor(totalScore);
  if (s === 100) return 'bg-green-600';
  if (s >= 95) return 'bg-green-500';
  if (s >= 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function formatScore(totalScore: number): string {
  const s = getScoreStyle(totalScore);
  const pct = `${Math.floor(totalScore)}%`;
  return s.icon ? `${s.icon} ${pct}` : pct;
}
