import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { UserListItem, BadgeAward, BadgeId } from '../../types';
import { getUserBadges, assignBadge, deleteBadge } from '../../services/usersService';
import { BADGE_CATALOGUE, BADGE_CATEGORIES, YEARLY_BADGE_IDS } from '../../constants/badges';
import { formatDate } from '../../utils/dateFormatter';
import { BadgeTile } from '../BadgeTile';

interface BadgesModalProps {
  user: UserListItem;
  onClose: () => void;
}

export const BadgesModal: React.FC<BadgesModalProps> = ({ user, onClose }) => {
  const [awards, setAwards] = useState<BadgeAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<BadgeId | null>(null);
  const [assignDate, setAssignDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignYear, setAssignYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState('');

  useEffect(() => {
    getUserBadges(user._id)
      .then(setAwards)
      .catch(() => setAwards([]))
      .finally(() => setLoading(false));
  }, [user._id]);

  const handleAssign = async (badgeId: BadgeId) => {
    setError('');
    try {
      const payload: { badgeId: string; earnedAt: string; year?: number } = {
        badgeId,
        earnedAt: new Date(assignDate).toISOString(),
      };
      if (YEARLY_BADGE_IDS.has(badgeId) && assignYear) {
        payload.year = Number(assignYear);
      }
      const updated = await assignBadge(user._id, payload);
      setAwards(updated);
      setAssigning(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
    }
  };

  const handleDelete = async (awardId: string) => {
    setError('');
    try {
      await deleteBadge(user._id, awardId);
      setAwards(prev => prev.filter(a => a._id !== awardId));
    } catch {
      setError('Помилка видалення');
    }
  };

  const toDisplay = (phone: string) => {
    const p = phone.slice(2);
    return `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6, 8)} ${p.slice(8, 10)}`;
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Нагороди</h3>
            <p className="text-sm text-slate-500">{user.name || toDisplay(user.phone)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-xmark text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-slate-300" />
            </div>
          ) : (
            BADGE_CATEGORIES.map(category => {
              const defs = BADGE_CATALOGUE.filter(b => b.category === category);
              return (
                <div key={category}>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">{category}</p>
                  <div className="space-y-3">
                    {defs.map(def => {
                      const defAwards = awards.filter(a => a.badgeId === def.badgeId);
                      const isAssigning = assigning === def.badgeId;
                      return (
                        <div key={def.badgeId} className="bg-slate-50 rounded-2xl p-4">
                          <div className="flex items-center gap-3">
                            {/* Badge preview */}
                            <div className="w-24 flex-shrink-0">
                              <BadgeTile def={def} awards={defAwards} />
                            </div>

                            {/* Awards list + controls */}
                            <div className="flex-1 min-w-0">
                              {defAwards.length === 0 ? (
                                <p className="text-xs text-slate-400 mb-2">Не отримано</p>
                              ) : (
                                <div className="space-y-1 mb-2">
                                  {defAwards.map(award => (
                                    <div key={award._id} className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-slate-600">
                                        {formatDate(award.earnedAt)}
                                        {award.year && ` (${award.year})`}
                                        {award.manual && <span className="ml-1 text-slate-400">[вручну]</span>}
                                      </span>
                                      <button
                                        onClick={() => handleDelete(award._id)}
                                        className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                                        title="Видалити нагороду"
                                      >
                                        <i className="fas fa-xmark text-xs" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {isAssigning ? (
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <input
                                    type="date"
                                    value={assignDate}
                                    onChange={e => setAssignDate(e.target.value)}
                                    className="text-xs px-2 py-1 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-kameya-burgundy/30"
                                  />
                                  {YEARLY_BADGE_IDS.has(def.badgeId) && (
                                    <input
                                      type="number"
                                      value={assignYear}
                                      onChange={e => setAssignYear(e.target.value)}
                                      placeholder="Рік"
                                      className="text-xs px-2 py-1 border border-slate-200 rounded-lg bg-white w-20 focus:outline-none focus:ring-1 focus:ring-kameya-burgundy/30"
                                    />
                                  )}
                                  <button
                                    onClick={() => handleAssign(def.badgeId)}
                                    className="text-xs px-3 py-1 bg-kameya-burgundy text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                                  >
                                    Підтвердити
                                  </button>
                                  <button
                                    onClick={() => setAssigning(null)}
                                    className="text-xs px-3 py-1 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                                  >
                                    Скасувати
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setAssigning(def.badgeId);
                                    setAssignDate(new Date().toISOString().slice(0, 10));
                                    setAssignYear(String(new Date().getFullYear()));
                                    setError('');
                                  }}
                                  className="text-xs text-kameya-burgundy font-semibold hover:opacity-75 transition-opacity"
                                >
                                  + Призначити
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
