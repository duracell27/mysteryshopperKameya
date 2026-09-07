import React, { useState, useRef, useCallback } from 'react';
import { ShopView } from './ShopView';
import { useAuth } from '../../context/AuthContext';

const STEP = 10;
const HOLD_DELAY = 350;  // ms before auto-repeat starts
const HOLD_FAST  = 80;   // ms per tick during hold

interface AdminShopPreviewProps {
  onPointsUpdate: (pts: number) => void;
}

export const AdminShopPreview: React.FC<AdminShopPreviewProps> = ({ onPointsUpdate }) => {
  const { user } = useAuth();
  const [points, setPoints] = useState<number>(user?.points ?? 0);

  const holdTimer   = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHold = useCallback(() => {
    if (holdTimer.current)    { clearTimeout(holdTimer.current);   holdTimer.current   = null; }
    if (holdInterval.current) { clearInterval(holdInterval.current); holdInterval.current = null; }
  }, []);

  const startHold = useCallback((delta: number) => {
    const apply = () => setPoints(p => Math.max(0, p + delta));
    apply();
    holdTimer.current = setTimeout(() => {
      holdInterval.current = setInterval(apply, HOLD_FAST);
    }, HOLD_DELAY);
  }, []);

  const bindHold = (delta: number) => ({
    onMouseDown:  () => startHold(delta),
    onMouseUp:    stopHold,
    onMouseLeave: stopHold,
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); startHold(delta); },
    onTouchEnd:   stopHold,
  });

  return (
    <div className="space-y-4">
      {/* Points control bar */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-4">
        <i className="fas fa-flask text-amber-500" />
        <span className="text-sm font-medium text-amber-800">Тестовий баланс для перегляду</span>
        <div className="ml-auto flex items-center gap-3">
          <button
            {...bindHold(-STEP)}
            disabled={points <= 0}
            className="w-9 h-9 rounded-full bg-white border border-amber-300 text-amber-700 font-bold text-lg flex items-center justify-center hover:bg-amber-100 disabled:opacity-30 disabled:cursor-not-allowed select-none touch-none"
          >
            <i className="fas fa-minus text-sm" />
          </button>
          <span className="text-lg font-bold text-amber-900 w-24 text-center tabular-nums">
            {points} балів
          </span>
          <button
            {...bindHold(+STEP)}
            className="w-9 h-9 rounded-full bg-white border border-amber-300 text-amber-700 font-bold text-lg flex items-center justify-center hover:bg-amber-100 select-none touch-none"
          >
            <i className="fas fa-plus text-sm" />
          </button>
        </div>
        <button
          onClick={() => setPoints(user?.points ?? 0)}
          className="text-xs text-amber-600 hover:text-amber-800 underline whitespace-nowrap"
        >
          скинути
        </button>
      </div>

      <ShopView onPointsUpdate={onPointsUpdate} pointsOverride={points} />
    </div>
  );
};
