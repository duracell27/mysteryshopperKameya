import React, { useState } from 'react';
import { QuizQuestion } from '../types';

interface QuizViewProps {
  topic: string;
  questions: QuizQuestion[];
  onFinish: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ topic, questions, onFinish }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);

  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedIdx(idx);
  };

  const handleNext = () => {
    if (selectedIdx === questions[currentIdx].correctIndex) {
      setScore((s) => s + 1);
    }
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedIdx(null);
      setIsAnswered(false);
    } else {
      onFinish();
    }
  };

  const currentQuestion = questions[currentIdx];

  return (
    <div className="max-w-2xl mx-auto py-10">
      <header className="mb-8 text-center">
        <h2 className="text-2xl font-serif font-bold text-kameya-burgundy">Навчальний тест: {topic}</h2>
        <p className="text-slate-500 mt-2">Питання {currentIdx + 1} з {questions.length}</p>
        <p className="text-xs text-slate-400 mt-1">Бали: {score}</p>
      </header>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6">{currentQuestion.question}</h3>

        <div className="space-y-3">
          {currentQuestion.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              className={`w-full p-4 text-left rounded-xl border transition-all ${
                selectedIdx === idx
                  ? 'border-kameya-burgundy bg-red-50 text-kameya-burgundy font-semibold'
                  : 'border-slate-100 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold opacity-60">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span>{option}</span>
              </div>
            </button>
          ))}
        </div>

        <button
          disabled={selectedIdx === null}
          onClick={handleNext}
          className="w-full mt-8 bg-kameya-burgundy text-white py-4 rounded-xl font-bold hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          {currentIdx === questions.length - 1 ? 'Завершити тест' : 'Наступне питання'}
        </button>
      </div>
    </div>
  );
};
