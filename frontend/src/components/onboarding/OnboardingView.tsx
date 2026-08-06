import React from 'react';

interface OnboardingViewProps {
  track: '14' | '30' | '60';
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ track }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-2xl bg-kameya-burgundy/10 flex items-center justify-center mb-4">
      <i className="fas fa-user-clock text-2xl text-kameya-burgundy" />
    </div>
    <h2 className="text-xl font-bold text-slate-800 mb-2">Онбординг — {track} днів</h2>
    <p className="text-slate-400 text-sm">Розділ в розробці</p>
  </div>
);
