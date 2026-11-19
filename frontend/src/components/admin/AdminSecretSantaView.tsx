import React, { useEffect, useMemo, useState } from 'react';
import { getAllEntries, SantaEntry } from '../../services/secretSantaService';

interface Snowflake {
  left: string;
  duration: string;
  delay: string;
  size: string;
  imgIdx: number;
}

const keyframeStyles = `
  @keyframes snowfall {
    0%   { transform: translateY(-30px) translateX(0) rotate(0deg); opacity: 1; }
    50%  { transform: translateY(50vh) translateX(15px) rotate(180deg); opacity: 0.8; }
    100% { transform: translateY(100vh) translateX(-10px) rotate(360deg); opacity: 0.2; }
  }
  @keyframes sleigh {
    0%   { left: -260px; }
    100% { left: calc(100% + 260px); }
  }
  .snowflake-anim { animation: snowfall linear infinite; }
  .sleigh-anim    { animation: sleigh linear infinite; position: absolute; top: 16px; }
`;

export const AdminSecretSantaView: React.FC = () => {
  const [entries, setEntries] = useState<SantaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getAllEntries()
      .then(setEntries)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const snowflakes = useMemo<Snowflake[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        left:     `${Math.floor((i * 37 + 11) % 100)}%`,
        duration: `${6 + ((i * 13) % 9)}s`,
        delay:    `-${((i * 7) % 11)}s`,
        size:     `${14 + ((i * 3) % 12)}px`,
        imgIdx:   i % 2,
      })),
    [],
  );

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto">
      <style>{keyframeStyles}</style>

      {/* Header card */}
      <div className="relative overflow-hidden bg-[#0a1628] border border-[#1e3a5f] rounded-2xl shadow-2xl px-6 py-6 mb-6">

        {/* Sleigh */}
        <img
          src="/secret-santa/santa-sleigh.png"
          alt=""
          className="sleigh-anim pointer-events-none select-none"
          style={{ height: '55px', width: 'auto', animationDuration: '14s' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />

        {/* Snowflakes */}
        {snowflakes.map((s, i) => (
          <img
            key={i}
            src={`/secret-santa/snowflake${s.imgIdx + 1}.png`}
            alt=""
            className="snowflake-anim absolute pointer-events-none select-none opacity-50"
            style={{
              left: s.left, top: '-30px',
              width: s.size, height: 'auto',
              animationDuration: s.duration,
              animationDelay: s.delay,
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ))}

        {/* Trees */}
        <img
          src="/secret-santa/tree.png" alt=""
          className="absolute bottom-0 left-2 pointer-events-none select-none opacity-80"
          style={{ height: '70px', width: 'auto' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <img
          src="/secret-santa/tree2.png" alt=""
          className="absolute bottom-0 right-2 pointer-events-none select-none opacity-80"
          style={{ height: '70px', width: 'auto' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />

        <div className="relative z-10 mt-8 text-center">
          <div className="text-xs text-[#8fa8c8] uppercase tracking-widest mb-1">Адмін-панель</div>
          <h1 className="text-2xl font-bold text-white">🎅 Таємний Миколай</h1>
          {!loading && !error && (
            <div className="text-[#8fa8c8] text-sm mt-1">Учасників: {entries.length}</div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <i className="fas fa-spinner fa-spin text-kameya-burgundy text-2xl" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-red-600 text-sm">
          Помилка завантаження учасників.
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-4 text-left font-semibold text-slate-600">#</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-600">Учасник</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-600">Відділ</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-600">Дарує</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-600">Що хоче</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-600">Що не хоче</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const recipient = entry.recipientId as SantaEntry | null;
                return (
                  <tr key={entry._id} className={idx % 2 === 0 ? 'bg-kameya-burgundy/5' : ''}>
                    <td className="px-5 py-3 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-5 py-3 font-medium text-slate-700">{entry.fullName}</td>
                    <td className="px-5 py-3 text-slate-500">{entry.department ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-700">
                      {recipient?.fullName
                        ? <span className="inline-flex items-center gap-1"><span className="text-kameya-burgundy">→</span> {recipient.fullName}</span>
                        : <span className="text-slate-300 italic text-xs">не призначено</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-500 max-w-[180px] truncate" title={recipient?.wantsToReceive ?? ''}>
                      {recipient?.wantsToReceive ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-500 max-w-[180px] truncate" title={recipient?.doesntWantToReceive ?? ''}>
                      {recipient?.doesntWantToReceive ?? '—'}
                    </td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400 italic">
                    Учасників поки немає. Завантажте дані через seeder.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
