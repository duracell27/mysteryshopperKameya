import React, { useState, useEffect, useRef } from 'react';
import { UserListItem, AuditSection } from '../../types';
import { fetchUsers } from '../../services/usersService';
import { parseReport, confirmReport, previewAffirmation, ParsedReport } from '../../services/reportsService';
import { formatDate } from '../../utils/dateFormatter';
import { scoreTextClass } from '../../utils/scoreColor';

type Step = 'select' | 'parsing' | 'preview' | 'saving' | 'done';

const MONTHS_UK = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

const toDisplay = (phone: string) => {
  const p = phone.slice(2);
  return `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6, 8)} ${p.slice(8, 10)}`;
};

export const ReportsUploadView: React.FC = () => {
  const [employees, setEmployees] = useState<UserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<UserListItem | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [parsed, setParsed] = useState<ParsedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDetailedPreview, setShowDetailedPreview] = useState(false);
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [awardedPoints, setAwardedPoints] = useState<number | null>(null);
  const [affirmationPreview, setAffirmationPreview] = useState<string | null>(null);
  const [affirmationLoading, setAffirmationLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUsers()
      .then((all) => setEmployees(all.filter((u) => u.role === 'EMPLOYEE')))
      .catch(() => setError('Не вдалося завантажити список працівників'));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const fetchAffirmationPreview = async (userId: string) => {
    setAffirmationLoading(true);
    try {
      const text = await previewAffirmation(userId);
      setAffirmationPreview(text);
    } catch {
      setAffirmationPreview(null);
    } finally {
      setAffirmationLoading(false);
    }
  };

  const handleParse = async () => {
    if (!selectedUserId || !file) return;
    setError(null);
    setStep('parsing');
    try {
      const result = await parseReport(file);
      setParsed(result);
      setStep('preview');
      if (result.totalScore >= 100) fetchAffirmationPreview(selectedUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка аналізу');
      setStep('select');
    }
  };

  const handleConfirm = async () => {
    if (!parsed) return;
    setError(null);
    setStep('saving');
    try {
      const result = await confirmReport({
        userId: selectedUserId,
        auditId: parsed.auditId ?? '',
        location: parsed.location ?? '',
        date: parsed.date,
        totalScore: parsed.totalScore,
        sections: parsed.sections,
        fileName: parsed.fileName,
        quarter: selectedQuarter,
        year: selectedYear,
        month: selectedMonth,
        ...(affirmationPreview ? { affirmation: affirmationPreview } : {}),
      });
      setAwardedPoints(result.pointsAwarded);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка збереження');
      setStep('preview');
    }
  };

  const handleReset = () => {
    setStep('select');
    setFile(null);
    setParsed(null);
    setSelectedUserId('');
    setSelectedEmployee(null);
    setSearchQuery('');
    setShowDropdown(false);
    setError(null);
    setExpandedSection(null);
    setSelectedQuarter('Q1');
    setSelectedYear(currentYear);
    setSelectedMonth(new Date().getMonth() + 1);
    setAwardedPoints(null);
    setAffirmationPreview(null);
    setAffirmationLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredEmployees = employees.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      (u.store ?? '').toLowerCase().includes(q)
    );
  });

  const handleSelectEmployee = (employee: UserListItem) => {
    setSelectedUserId(employee._id);
    setSelectedEmployee(employee);
    setShowDropdown(false);
    setSearchQuery('');
  };

  // ── Step: done ──
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <i className="fas fa-circle-check text-4xl text-green-500"></i>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Звіт збережено!</h2>
        <p className="text-slate-500">
          Звіт <span className="font-semibold text-slate-700">{selectedQuarter} {selectedYear}</span> прив'язано до{' '}
          <span className="font-semibold text-slate-700">{selectedEmployee?.name}</span>
        </p>
        {awardedPoints !== null && (
          <div className={`px-6 py-3 rounded-xl text-sm font-semibold ${
            awardedPoints > 0
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-slate-50 text-slate-600 border border-slate-200'
          }`}>
            {awardedPoints > 0
              ? `+${awardedPoints} балів нараховано`
              : 'Бали не нараховано (результат < 80%)'}
          </div>
        )}
        <button
          onClick={handleReset}
          className="mt-4 px-6 py-3 bg-kameya-burgundy text-white rounded-xl font-semibold hover:bg-opacity-90 transition-colors"
        >
          Завантажити ще один звіт
        </button>
      </div>
    );
  }

  // ── Detailed preview ──
  if (showDetailedPreview && parsed) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDetailedPreview(false)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <i className="fas fa-arrow-left text-slate-500 text-sm"></i>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Детальний звіт</h1>
            <p className="text-xs text-slate-400">{formatDate(parsed.date)}{selectedEmployee?.store ? ` · ${selectedEmployee.store}` : ''}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {parsed.sections.map((section: AuditSection, idx: number) => (
            <div key={idx} className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                <h3 className="font-bold text-slate-700">{section.title}</h3>
                <span className={`text-sm font-semibold ${section.score < section.maxScore * 0.7 ? 'text-red-600' : 'text-green-600'}`}>
                  {section.score} / {section.maxScore}
                </span>
              </div>
              <div className="p-4 space-y-4">
                {section.feedback && <p className="text-sm italic text-slate-600">"{section.feedback}"</p>}
                <div className="divide-y divide-slate-100">
                  {section.questions.map((q, qIdx) => (
                    <div key={qIdx} className="py-3 flex items-start space-x-3">
                      <i className={`fas ${q.isCorrect ? 'fa-check text-green-500' : 'fa-xmark text-red-500'} mt-0.5`}></i>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{q.question}</p>
                        <p className="text-xs text-slate-500">Відповідь: {q.answer}</p>
                        {q.comment && (
                          <p className="text-xs text-kameya-burgundy mt-1 font-medium italic">— {q.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={step === 'saving'}
          className="w-full py-3 bg-kameya-burgundy text-white rounded-xl font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {step === 'saving' ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              Збереження...
            </>
          ) : (
            <>
              <i className="fas fa-circle-check"></i>
              Підтвердити та зберегти
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Завантаження звітів</h1>
        <p className="text-sm text-slate-500 mt-1">Завантажте PDF зі звітом таємного покупця та прив'яжіть його до працівника</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <i className="fas fa-circle-exclamation flex-shrink-0"></i>
          <span>{error}</span>
        </div>
      )}

      {/* ── Step 1: select employee + upload PDF ── */}
      {(step === 'select' || step === 'parsing') && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-kameya-burgundy text-white text-xs flex items-center justify-center font-bold">1</span>
            Виберіть працівника та PDF файл
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Працівник</label>
              <div className="relative" ref={dropdownRef}>
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-kameya-burgundy">
                  <i className="fas fa-magnifying-glass text-slate-400 text-sm"></i>
                  <input
                    type="text"
                    placeholder={selectedEmployee ? '' : 'Пошук за ім\'ям, телефоном, магазином...'}
                    value={showDropdown ? searchQuery : selectedEmployee ? `${selectedEmployee.name} (${toDisplay(selectedEmployee.phone)})` : ''}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    disabled={step === 'parsing'}
                    className="flex-1 outline-none text-sm bg-transparent disabled:opacity-50"
                  />
                  {selectedEmployee && (
                    <button
                      onClick={() => {
                        setSelectedUserId('');
                        setSelectedEmployee(null);
                        setSearchQuery('');
                      }}
                      className="text-slate-400 hover:text-slate-600 text-sm"
                    >
                      <i className="fas fa-xmark"></i>
                    </button>
                  )}
                </div>

                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                    {filteredEmployees.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-slate-500 text-center">
                        Не знайдено
                      </div>
                    ) : (
                      filteredEmployees.map((u) => (
                        <button
                          key={u._id}
                          onClick={() => handleSelectEmployee(u)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-sm border-b border-slate-50 last:border-0"
                        >
                          <p className="font-medium text-slate-800">{u.name}</p>
                          <p className="text-xs text-slate-500">
                            {toDisplay(u.phone)} · {u.store ?? '—'}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Рік</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  disabled={step === 'parsing'}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy disabled:opacity-50"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Квартал</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value as 'Q1' | 'Q2' | 'Q3' | 'Q4')}
                  disabled={step === 'parsing'}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy disabled:opacity-50"
                >
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Місяць</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  disabled={step === 'parsing'}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy disabled:opacity-50"
                >
                  {MONTHS_UK.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PDF файл</label>
              <div
                onClick={() => !step.includes('pars') && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  file ? 'border-kameya-burgundy bg-red-50' : 'border-slate-200 hover:border-slate-300'
                } ${step === 'parsing' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={step === 'parsing'}
                />
                {file ? (
                  <div className="space-y-1">
                    <i className="fas fa-file-pdf text-3xl text-kameya-burgundy"></i>
                    <p className="text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <i className="fas fa-cloud-arrow-up text-3xl text-slate-300"></i>
                    <p className="text-sm text-slate-500">Натисніть, щоб вибрати PDF файл</p>
                    <p className="text-xs text-slate-400">Максимум 15 MB</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleParse}
            disabled={!selectedUserId || !file || step === 'parsing'}
            className="w-full py-3 bg-kameya-burgundy text-white rounded-xl font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {step === 'parsing' ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Claude AI аналізує PDF...
              </>
            ) : (
              <>
                <i className="fas fa-brain"></i>
                Аналізувати з Claude AI
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Step 2: preview parsed result ── */}
      {(step === 'preview' || step === 'saving') && parsed && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-kameya-burgundy text-white text-xs flex items-center justify-center font-bold">2</span>
              Результат аналізу — перевірте та підтвердіть
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Дата</p>
                <p className="font-semibold text-slate-800 text-sm">{formatDate(parsed.date)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Магазин</p>
                <p className="font-semibold text-slate-800 text-sm">{selectedEmployee?.store || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Загальний результат</p>
                <p className="font-bold text-2xl text-slate-800">{Math.round(parsed.totalScore)}%</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Файл</p>
                <p className="font-semibold text-slate-800 text-sm truncate">{parsed.fileName}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700 mb-3">Розділи ({parsed.sections.length})</p>
              {parsed.sections.map((section: AuditSection, idx: number) => (
                <div key={idx} className="border border-slate-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === idx ? null : idx)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <i className={`fas fa-chevron-${expandedSection === idx ? 'up' : 'down'} text-xs text-slate-400`}></i>
                      <span className="text-sm font-medium text-slate-700">{section.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">
                        {section.score}/{section.maxScore}
                      </span>
                    </div>
                  </button>

                  {expandedSection === idx && (
                    <div className="px-4 pb-4 space-y-2">
                      {section.feedback && (
                        <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3 py-1">{section.feedback}</p>
                      )}
                      <div className="space-y-1">
                        {section.questions.map((q, qi) => {
                          const showScore = q.isImportant !== false;
                          const scoreVal = !isNaN(Number(q.answer)) && q.answer !== '' ? q.answer : '';
                          return (
                            <div key={qi} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                              <i className={`fas ${q.isCorrect ? 'fa-circle-check text-green-500' : 'fa-circle-xmark text-orange-400'} text-sm flex-shrink-0`}></i>
                              <p className="text-xs text-slate-700 flex-1">{q.question}</p>
                              {showScore ? (
                                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 min-w-[1.5rem] text-center rounded-full border ${
                                  q.isCorrect
                                    ? 'text-green-700 bg-green-50 border-green-200'
                                    : 'text-orange-700 bg-orange-50 border-orange-200'
                                }`}>
                                  {scoreVal || '0'}
                                </span>
                              ) : (
                                <span className="shrink-0 text-xs text-slate-400">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {parsed.totalScore >= 100 && (
            <div className="bg-kameya-burgundy/10 border border-kameya-burgundy/20 rounded-2xl px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-kameya-burgundy flex items-center gap-2">
                  <i className="fas fa-quote-left text-xs"></i>
                  Афірмація для працівника
                </p>
                <button
                  onClick={() => fetchAffirmationPreview(selectedUserId)}
                  disabled={affirmationLoading || step === 'saving'}
                  className="text-xs text-kameya-burgundy font-semibold flex items-center gap-1 hover:opacity-70 disabled:opacity-40 transition-opacity"
                >
                  <i className={`fas fa-arrows-rotate ${affirmationLoading ? 'fa-spin' : ''}`}></i>
                  Перегенерувати
                </button>
              </div>
              {affirmationLoading ? (
                <p className="text-sm text-slate-400 italic">Завантаження...</p>
              ) : (
                <p className="text-sm text-slate-700 italic">{affirmationPreview}</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={step === 'saving'}
              className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Назад
            </button>
            <button
              onClick={() => setShowDetailedPreview(true)}
              disabled={step === 'saving'}
              className="flex-1 py-3 border border-kameya-burgundy text-kameya-burgundy rounded-xl font-semibold hover:bg-red-50 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <i className="fas fa-eye"></i>
              Детальний звіт
            </button>
            <button
              onClick={handleConfirm}
              disabled={step === 'saving'}
              className="flex-1 py-3 bg-kameya-burgundy text-white rounded-xl font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {step === 'saving' ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Збереження...
                </>
              ) : (
                <>
                  <i className="fas fa-circle-check"></i>
                  Підтвердити та зберегти
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
