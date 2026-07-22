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

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Аудіозаписи
      </h4>

      {recordings.length === 0 && (
        <p className="text-sm text-gray-400 mb-3">Записів немає</p>
      )}

      <div className="space-y-2 mb-3">
        {recordings.map((rec) => (
          <div
            key={rec._id}
            className="flex flex-col gap-1 p-2 bg-gray-50 dark:bg-gray-800 rounded"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[60%]">
                {rec.label}
              </span>
              {deleteConfirmId === rec._id ? (
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => handleDelete(rec._id)}
                    disabled={loading}
                    className="text-red-600 hover:underline"
                  >
                    Підтвердити
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="text-gray-500 hover:underline"
                  >
                    Скасувати
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirmId(rec._id)}
                  disabled={loading}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Видалити
                </button>
              )}
            </div>
            <audio
              controls
              className="w-full h-8"
              src={getAudioStreamUrl(reportId, rec._id)}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,audio/mpeg"
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="text-sm px-3 py-1.5 border border-dashed border-gray-400 rounded hover:border-blue-500 hover:text-blue-600 transition-colors text-gray-600 dark:text-gray-300 disabled:opacity-50"
        >
          {loading ? 'Завантаження...' : '+ Обрати MP3 файл'}
        </button>

        <div className="flex gap-2">
          <input
            type="url"
            placeholder="Пряме посилання на MP3..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
            disabled={loading}
            className="flex-1 text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          />
          <button
            onClick={handleAddUrl}
            disabled={loading || !urlInput.trim()}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Додати
          </button>
        </div>
      </div>
    </div>
  );
};
