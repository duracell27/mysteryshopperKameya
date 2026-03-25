import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(phone, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Невірний номер телефону або пароль');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <img src="/LogoBordo.png" alt="Kameya Academy" className="h-16 w-auto" />
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Вхід до кабінету</h2>
          <p className="text-sm text-slate-500 mb-8">
            Введіть ваші дані для доступу до особистого кабінету
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Номер телефону
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0508098182"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all"
                required
                autoComplete="tel"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 pl-1">
                Формат: 0508098182 або 380508098182
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all pr-12"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-600 font-medium flex items-center space-x-2">
                <i className="fas fa-triangle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-kameya-burgundy text-white py-4 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg shadow-kameya-burgundy/20 disabled:opacity-60 active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center space-x-2">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Входимо...</span>
                </span>
              ) : (
                'Увійти'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Проблеми зі входом? Зверніться до адміністратора.
        </p>
      </div>
    </div>
  );
};
