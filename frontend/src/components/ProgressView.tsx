import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { PointsTransaction, BadgeAward } from '../types';
import { getMyRank, UserRank, getMyPointsHistory, getMyBadges } from '../services/reportsService';
import { useAuth } from '../context/AuthContext';
import { BADGE_CATALOGUE, BADGE_CATEGORIES } from '../constants/badges';
import { BadgeTile } from './BadgeTile';

export const ProgressView: React.FC = () => {
  const { user } = useAuth();
  const [rank, setRank] = useState<UserRank | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [badges, setBadges] = useState<BadgeAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    Promise.all([getMyRank(), getMyPointsHistory(), getMyBadges()])
      .then(([rankData, txData, badgeData]) => {
        setRank(rankData);
        setTransactions(txData);
        setBadges(badgeData);
      })
      .catch(() => console.error('Помилка завантаження даних'))
      .finally(() => setLoading(false));
  }, []);

  const totalPoints = loading ? 0 : transactions.reduce((sum, tx) => sum + tx.pointsAwarded, 0);
  const lastThree = transactions.slice(0, 3);

  const txLabel = (tx: PointsTransaction) => {
    if (tx.reason === 'streak')   return `🔥 Стрік ${tx.streakQuarters} кварт. ${tx.streakYear ?? tx.year}`;
    if (tx.reason === 'reflection' || (tx.reason == null && tx.scorePercent === 0))
      return `Рефлексія ${tx.quarter ?? ''} ${tx.year}`;
    return `${tx.quarter ?? ''} ${tx.year} — ${Math.floor(tx.scorePercent)}%`;
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Досягнення та Бали</h2>
        <p className="text-slate-500">Ваш шлях професійного зростання в Kameya Academy.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Points card */}
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 flex flex-col relative overflow-hidden group">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-kameya-burgundy/10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-500">
              <i className="fas fa-gem text-kameya-burgundy text-2xl" />
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Накопичено балів</p>
              <h3 className="text-5xl font-bold text-kameya-burgundy tracking-tighter">
                {loading ? '...' : totalPoints}
              </h3>
            </div>
          </div>

          {lastThree.length > 0 && (
            <div className="space-y-2 mt-2">
              {lastThree.map((tx) => (
                <div key={tx._id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 truncate">{txLabel(tx)}</span>
                  <span className={`font-semibold flex-shrink-0 ml-2 ${tx.pointsAwarded > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                    {tx.pointsAwarded > 0 ? `+${tx.pointsAwarded}` : '0'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {transactions.length > 0 && (
            <button
              onClick={() => setShowHistory(true)}
              className="mt-4 text-xs text-kameya-burgundy font-semibold hover:opacity-75 self-start"
            >
              Детальніше →
            </button>
          )}

          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-100/50 rounded-full blur-2xl" />
        </div>

        {/* Network rank card */}
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 flex flex-col justify-center relative overflow-hidden">
          {rank ? (
            <>
              <div className="absolute top-5 right-5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                <i className="fas fa-layer-group text-amber-500 text-xs" />
                <span className="text-amber-700 font-bold text-xs uppercase tracking-wide">{rank.tier}</span>
              </div>
              <div className="flex items-end gap-3 mb-2">
                <i className="fas fa-trophy text-amber-400 text-3xl mb-1" />
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-0.5">Місце в мережі</p>
                  <p className="text-5xl font-bold text-slate-800 tracking-tighter leading-none">#{rank.rank}</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mt-3">
                з <span className="font-semibold text-slate-600">{rank.totalUsers}</span> учасників · Продовжуйте зростати!
              </p>
            </>
          ) : (
            <p className="text-slate-400 text-sm">{loading ? 'Завантаження...' : 'Дані рейтингу відсутні'}</p>
          )}
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-50 rounded-full blur-2xl" />
        </div>
      </div>

      {/* Badges section */}
      <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
          <i className="fas fa-medal text-amber-500" />
          Ваші значки
        </h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <i className="fas fa-spinner fa-spin text-2xl text-slate-300" />
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-0 sm:grid sm:grid-cols-4 sm:gap-x-4 sm:gap-y-6">
            {BADGE_CATEGORIES.map(category => {
              const defs = BADGE_CATALOGUE.filter(b => b.category === category);
              const colSpans = ['', 'sm:col-span-1', 'sm:col-span-2', 'sm:col-span-3', 'sm:col-span-4'];
              const innerGrids = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-2 sm:grid-cols-3', 'grid-cols-2 sm:grid-cols-4'];
              return (
                <div key={category} className={`${colSpans[defs.length]} bg-slate-50 rounded-2xl p-3`}>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">{category}</p>
                  <div className={`grid ${innerGrids[defs.length]} gap-3`}>
                    {defs.map(def => (
                      <BadgeTile
                        key={def.badgeId}
                        def={def}
                        awards={badges.filter(a => a.badgeId === def.badgeId)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Points history modal */}
      {showHistory && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Історія балів</h3>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-xmark text-xl" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-2">
              {transactions.length === 0 ? (
                <p className="text-center text-slate-400 py-8">Транзакцій ще немає</p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx._id} className="flex items-center justify-between py-3 px-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{txLabel(tx)}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                      tx.pointsAwarded > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {tx.pointsAwarded > 0 ? `+${tx.pointsAwarded}` : '0'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
