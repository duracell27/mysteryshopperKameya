import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { requestForgotCode, verifyForgotCode, confirmForgotPassword } from '../services/forgotPasswordService';

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 'success';

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 font-medium flex items-center gap-2">
    <i className="fas fa-triangle-exclamation flex-shrink-0" />
    <span>{message}</span>
  </div>
);

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ open, onClose }) => {
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setPhone('');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setIsLoading(false);
      setShowNew(false);
      setShowConfirm(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSendCode = async () => {
    if (!phone.trim()) {
      setError('Введіть номер телефону');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await requestForgotCode(phone.trim());
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка надсилання коду');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError('Введіть 6-значний код');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await verifyForgotCode(phone.trim(), code);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Невірний або застарілий код');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 8) {
      setError('Пароль має містити мінімум 8 символів');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Паролі не збігаються');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await confirmForgotPassword(phone.trim(), code, newPassword);
      setStep('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка зміни пароля');
    } finally {
      setIsLoading(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={step !== 'success' ? onClose : undefined} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 z-10">
        {step !== 'success' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <i className="fas fa-xmark" />
          </button>
        )}

        <h2 className="text-xl font-bold text-slate-800 mb-1">Відновлення пароля</h2>

        {step === 1 && (
          <div className="space-y-5 mt-4">
            <p className="text-sm text-slate-500">
              Введіть ваш номер телефону. Ми надішлемо 6-значний код підтвердження.
            </p>
            <div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0508098182"
                autoFocus
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 pl-1">
                Формат: 0508098182, +380508098182
              </p>
            </div>
            {error && <ErrorBanner message={error} />}
            <button
              onClick={handleSendCode}
              disabled={isLoading}
              className="w-full bg-kameya-burgundy text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-kameya-burgundy/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading
                ? <i className="fas fa-spinner fa-spin" />
                : <i className="fas fa-paper-plane" />}
              Надіслати код
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 mt-4">
            <p className="text-sm text-slate-500">
              Введіть 6-значний код із SMS від Камея.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="• • • • • •"
              autoFocus
              className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-center text-3xl tracking-[0.6em] placeholder:text-slate-300 placeholder:text-lg focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all"
            />
            {error && <ErrorBanner message={error} />}
            <button
              onClick={handleVerifyCode}
              disabled={code.length !== 6 || isLoading}
              className="w-full bg-kameya-burgundy text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-kameya-burgundy/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading && <i className="fas fa-spinner fa-spin" />}
              Далі
            </button>
            <button
              onClick={() => { setCode(''); setError(''); handleSendCode(); }}
              disabled={isLoading}
              className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors py-1 disabled:opacity-40"
            >
              Надіслати код повторно
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-slate-500">
              Придумайте новий пароль (мінімум 8 символів).
            </p>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Новий пароль"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                tabIndex={-1}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className={`fas ${showNew ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Підтвердження пароля"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
            {error && <ErrorBanner message={error} />}
            <button
              onClick={handleSavePassword}
              disabled={isLoading || !newPassword || !confirmPassword}
              className="w-full bg-kameya-burgundy text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-kameya-burgundy/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading && <i className="fas fa-spinner fa-spin" />}
              Зберегти
            </button>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-5 mt-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
              <i className="fas fa-check text-2xl text-green-500" />
            </div>
            <p className="text-sm text-slate-600 font-medium">
              Пароль успішно змінено.<br />Увійдіть з новим паролем.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-kameya-burgundy text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-kameya-burgundy/20"
            >
              До входу
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};
