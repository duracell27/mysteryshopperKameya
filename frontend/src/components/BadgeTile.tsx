import React, { useState, useRef, useEffect } from 'react';
import { BadgeAward } from '../types';
import { BadgeDef } from '../constants/badges';
import { formatDate } from '../utils/dateFormatter';

interface BadgeTileProps {
  def: BadgeDef;
  awards: BadgeAward[];
}

export const BadgeTile: React.FC<BadgeTileProps> = ({ def, awards }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const earned = awards.length > 0;

  const tooltipText = earned
    ? awards
        .map(a => {
          const date = formatDate(a.earnedAt);
          return a.year ? `${date} (${a.year})` : date;
        })
        .join('\n')
    : def.condition;

  const show = () => { if (hideTimer.current) clearTimeout(hideTimer.current); setShowTooltip(true); };
  const hide = () => setShowTooltip(false);

  const handleTouchStart = () => {
    touchTimer.current = setTimeout(show, 500);
  };
  const handleTouchEnd = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
    hideTimer.current = setTimeout(hide, 2000);
  };
  const handleTouchMove = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
  };

  useEffect(() => {
    return () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <div
      className="relative p-4 rounded-2xl bg-white flex flex-col items-center text-center hover:bg-slate-50 transition-all cursor-default select-none"
      onMouseEnter={show}
      onMouseLeave={hide}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {awards.length > 1 && (
        <span className="absolute top-2 right-2 bg-kameya-burgundy text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {awards.length}
        </span>
      )}

      <i className={`${def.icon} text-3xl mb-2 ${earned ? def.color : 'text-slate-300'}`} />

      <p className={`text-[10px] font-bold uppercase tracking-wide leading-tight ${earned ? 'text-slate-800' : 'text-slate-400'}`}>
        {def.name}
      </p>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-52 bg-slate-800 text-white text-xs rounded-xl px-3 py-2 text-center shadow-xl pointer-events-none whitespace-pre-line">
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
};
