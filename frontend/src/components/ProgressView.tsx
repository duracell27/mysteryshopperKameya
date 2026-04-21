import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { PointsTransaction } from '../types';
import { getMyRank, UserRank, getMyPointsHistory } from '../services/reportsService';
import { useAuth } from '../context/AuthContext';

export const ProgressView: React.FC = () => {
  const { user } = useAuth();
  const [rank, setRank] = useState<UserRank | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    Promise.all([getMyRank(), getMyPointsHistory()])
      .then(([rankData, txData]) => {
        setRank(rankData);
        setTransactions(txData);
      })
      .catch(() => console.error('Помилка завантаження даних'))
      .finally(() => setLoading(false));
  }, []);

  const totalPoints = user?.points ?? 0;
  const lastThree = transactions.slice(0, 3);

  const txLabel = (tx: PointsTransaction) =>
    tx.scorePercent === 0
      ? `Рефлексія ${tx.quarter} ${tx.year}`
      : `${tx.quarter} ${tx.year} — ${Math.floor(tx.scorePercent)}%`;

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
              <i className="fas fa-gem text-kameya-burgundy text-2xl"></i>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Накопичено балів</p>
              <h3 className="text-5xl font-bold text-kameya-burgundy tracking-tighter">
                {loading ? '...' : totalPoints}
              </h3>
            </div>
          </div>

          {/* Last transactions */}
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

          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-100/50 rounded-full blur-2xl"></div>
        </div>

        {/* Badges card */}
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <i className="fas fa-medal text-amber-500"></i>
            Ваші значки
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {transactions.length > 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center border-2 border-kameya-burgundy hover:bg-white transition-all">
                <i className="fas fa-star text-3xl mb-2 text-amber-400"></i>
                <p className="text-[10px] font-bold text-slate-800 uppercase">Перша перевірка</p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center hover:bg-slate-100 transition-all">
                <i className="fas fa-star text-3xl mb-2 text-slate-300"></i>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Перша перевірка</p>
              </div>
            )}
            <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center hover:bg-slate-100 transition-all">
              <i className="fas fa-medal text-3xl mb-2 text-slate-300"></i>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Срібний Гід</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center hover:bg-slate-100 transition-all">
              <i className="fas fa-book text-3xl mb-2 text-slate-300"></i>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Студент Року</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center hover:bg-slate-100 transition-all">
              <i className="fas fa-crown text-3xl mb-2 text-slate-300"></i>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Експерт Сервісу</p>
            </div>
          </div>
        </div>
      </div>

      {rank && (
        <div className="bg-slate-800 p-8 rounded-3xl text-white shadow-xl">
          <div className="mb-4">
            <h4 className="text-xl font-bold italic text-amber-400">Ви в {rank.tier} мережі!</h4>
            <p className="text-slate-400 text-sm mt-1">
              Ваше місце: <span className="font-semibold text-white">#{rank.rank}</span> з {rank.totalUsers} · Продовжуйте розвиватися та підвищуйте свої результати
            </p>
          </div>
        </div>
      )}

      {/* Points history modal */}
      {showHistory && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Історія балів</h3>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-xmark text-xl"></i>
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
