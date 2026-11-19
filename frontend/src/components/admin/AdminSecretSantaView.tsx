import React, { useEffect, useState } from 'react';
import { getAllEntries, SantaEntry } from '../../services/secretSantaService';

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

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
        🎅 Таємний Миколай — учасники
      </h1>

      {loading && (
        <p className="text-center text-gray-500 dark:text-gray-400">Завантаження...</p>
      )}

      {error && (
        <p className="text-red-500 dark:text-red-400">Помилка завантаження учасників.</p>
      )}

      {!loading && !error && (
        <>
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Учасник
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Відділ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Отримує подарунок
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Що хоче
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Що не хоче
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr
                    key={entry._id}
                    className={
                      idx % 2 === 0
                        ? 'bg-white dark:bg-gray-800'
                        : 'bg-gray-50 dark:bg-gray-750'
                    }
                  >
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      {entry.fullName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      {entry.department ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      {(entry.recipientId as SantaEntry)?.fullName ?? '(не призначено)'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      {entry.recipientId
                        ? (entry.recipientId as SantaEntry).wantsToReceive ?? '—'
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      {entry.recipientId
                        ? (entry.recipientId as SantaEntry).doesntWantToReceive ?? '—'
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Всього учасників: {entries.length}
          </p>
        </>
      )}
    </div>
  );
};
