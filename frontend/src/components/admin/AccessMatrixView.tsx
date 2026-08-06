import React, { useState } from 'react';
import { useAccess, AccessRule } from '../../context/AccessContext';
import { apiFetch } from '../../services/apiFetch';

const ROW_LABELS: { division: string; position: string; label: string }[] = [
  { division: 'stores',   position: 'Початківець консультант', label: 'Магазини / Початківець консультант' },
  { division: 'stores',   position: 'Консультант',             label: 'Магазини / Консультант' },
  { division: 'stores',   position: 'Керівник',                label: 'Магазини / Керівник' },
  { division: 'office',   position: 'Співробітник',            label: 'Офіс / Співробітник' },
  { division: 'office',   position: 'Керівник',                label: 'Офіс / Керівник' },
  { division: 'security', position: 'Охоронець',               label: 'Охорона / Охоронець' },
  { division: 'security', position: 'Керівник',                label: 'Охорона / Керівник' },
];

type ModuleField = 'mysteryShop' | 'onboarding' | 'learning';

const MODULE_COLS: { key: ModuleField; label: string }[] = [
  { key: 'mysteryShop', label: 'Таємний покупець' },
  { key: 'onboarding',  label: 'Онбординг' },
  { key: 'learning',    label: 'Навчання' },
];

export const AccessMatrixView: React.FC = () => {
  const { matrix, refreshMatrix } = useAccess();
  const [saving, setSaving] = useState<string | null>(null);

  if (!matrix) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-spinner fa-spin text-kameya-burgundy text-2xl" />
      </div>
    );
  }

  const getRule = (division: string, position: string): AccessRule | undefined =>
    matrix.find(r => r.division === division && r.position === position);

  const handleToggle = async (division: string, position: string, moduleKey: ModuleField, value: boolean) => {
    const key = `${division}-${position}-${moduleKey}`;
    setSaving(key);

    const updated: AccessRule[] = ROW_LABELS.map(row => {
      const existing = getRule(row.division, row.position);
      const modules  = existing?.modules ?? { mysteryShop: false, onboarding: false, learning: true };
      if (row.division === division && row.position === position) {
        return { division: row.division, position: row.position, modules: { ...modules, [moduleKey]: value } };
      }
      return { division: row.division, position: row.position, modules };
    });

    try {
      await apiFetch('/api/access-matrix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updated }),
      });
      await refreshMatrix();
    } catch {
      // revert is handled by refreshMatrix — UI returns to DB state
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Матриця доступів</h1>
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-4 font-semibold text-slate-600 w-64">Підрозділ / Посада</th>
              {MODULE_COLS.map(col => (
                <th key={col.key} className="px-6 py-4 font-semibold text-slate-600 text-center">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROW_LABELS.map((row, idx) => {
              const rule = getRule(row.division, row.position);
              return (
                <tr key={row.label} className={idx % 2 === 0 ? 'bg-slate-50/50' : ''}>
                  <td className="px-6 py-4 font-medium text-slate-700">{row.label}</td>
                  {MODULE_COLS.map(col => {
                    const isOn  = rule?.modules[col.key] ?? false;
                    const key   = `${row.division}-${row.position}-${col.key}`;
                    const isBusy = saving === key;
                    return (
                      <td key={col.key} className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggle(row.division, row.position, col.key, !isOn)}
                          disabled={isBusy}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            isOn ? 'bg-kameya-burgundy' : 'bg-slate-200'
                          } ${isBusy ? 'opacity-50' : ''}`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            isOn ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Зміни застосовуються одразу. Адміни мають доступ до всього незалежно від матриці.</p>
    </div>
  );
};
