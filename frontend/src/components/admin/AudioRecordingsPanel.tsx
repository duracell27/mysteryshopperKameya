import React, { useRef, useState } from 'react';
import { AudioRecording } from '../../types';
import {
  uploadAudio,
  addAudioByUrl,
  deleteAudio,
  getAudioStreamUrl,
  buildAudioLabel,
} from '../../services/reportsService';

interface AudioRecordingsPanelProps {
  reportId: string;
  recordings: AudioRecording[];
  employeeName: string;
  month: number;
  year: number;
  onUpdate: (recordings: AudioRecording[]) => void;
}

export const AudioRecordingsPanel: React.FC<AudioRecordingsPanelProps> = ({
  reportId, recordings, employeeName, month, year, onUpdate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const label = buildAudioLabel(employeeName, month, year);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const updated = await uploadAudio(reportId, file, label);
      onUpdate(updated.audioRecordings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const updated = await addAudioByUrl(reportId, urlInput.trim(), label);
      onUpdate(updated.audioRecordings ?? []);
      setUrlInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (audioId: string) => {
    setError(null);
    setLoading(true);
    try {
      const updated = await deleteAudio(reportId, audioId);
      onUpdate(updated.audioRecordings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка видалення');
    } finally {
      setLoading(false);
      setDeleteConfirmId(null);
    }
  };

  const count = recordings.length;
  const countLabel = count === 1 ? '1 запис' : count < 5 ? `${count} записи` : `${count} записів`;

  return (
    <div className="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl p-4 shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <i className="fas fa-microphone text-kameya-burgundy text-sm" />
        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">
          Аудіозаписи
        </p>
        {count > 0 && (
          <span className="ml-auto text-xs text-slate-400">{countLabel}</span>
        )}
      </div>

      {/* Recordings list */}
      {count === 0 ? (
        <div className="flex items-center gap-2.5 text-sm text-slate-400 bg-slate-50 dark:bg-gray-700/50 rounded-xl px-4 py-3 mb-3">
          <i className="fas fa-music text-slate-300 dark:text-gray-500" />
          <span>Записів немає</span>
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {recordings.map((rec) => (
            <div
              key={rec._id}
              className="bg-slate-50 dark:bg-gray-700/50 border border-slate-100 dark:border-gray-600 rounded-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <i className="fas fa-file-audio text-kameya-burgundy text-xs flex-shrink-0" />
                  <span className="text-xs font-medium text-slate-700 dark:text-gray-300 truncate">
                    {rec.label}
                  </span>
                </div>

                {deleteConfirmId === rec._id ? (
                  <div className="flex items-center gap-2 text-xs flex-shrink-0 ml-3">
                    <button
                      onClick={() => handleDelete(rec._id)}
                      disabled={loading}
                      className="text-red-600 font-semibold hover:opacity-75 disabled:opacity-40 transition-opacity"
                    >
                      Видалити
                    </button>
                    <span className="text-slate-300 dark:text-gray-500">|</span>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      disabled={loading}
                      className="text-slate-500 hover:opacity-75 disabled:opacity-40 transition-opacity"
                    >
                      Скасувати
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(rec._id)}
                    disabled={loading}
                    title="Видалити запис"
                    className="flex-shrink-0 ml-3 w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                  >
                    <i className="fas fa-trash-alt text-xs" />
                  </button>
                )}
              </div>

              <div className="px-3 pb-2.5">
                <audio
                  controls
                  className="w-full h-8"
                  src={getAudioStreamUrl(reportId, rec._id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2 mb-3">
          <i className="fas fa-exclamation-circle flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload controls */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,audio/mpeg"
        className="hidden"
        onChange={handleFileChange}
        disabled={loading}
      />

      <div className="flex flex-col gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full px-3 py-2.5 border border-dashed border-slate-300 dark:border-gray-500 rounded-xl text-sm text-slate-500 dark:text-gray-400 hover:border-kameya-burgundy hover:text-kameya-burgundy transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin" />
              <span>Завантаження...</span>
            </>
          ) : (
            <>
              <i className="fas fa-upload" />
              <span>Завантажити MP3 файл</span>
            </>
          )}
        </button>

        <div className="flex gap-2">
          <input
            type="url"
            placeholder="Пряме посилання на MP3..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAddUrl(); }}
            disabled={loading}
            className="flex-1 text-sm px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy disabled:opacity-50 transition-colors"
          />
          <button
            onClick={handleAddUrl}
            disabled={loading || !urlInput.trim()}
            className="px-4 py-2 bg-kameya-burgundy text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Додати
          </button>
        </div>
      </div>
    </div>
  );
};
