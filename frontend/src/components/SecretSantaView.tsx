import React, { useEffect, useMemo, useState } from 'react';
import { getMyEntry, SantaEntry } from '../services/secretSantaService';

type ErrorType = 'NOT_FOUND' | 'NO_RECIPIENT' | 'SERVER_ERROR';

interface Snowflake {
  left: string;
  duration: string;
  delay: string;
  size: string;
}

const keyframeStyles = `
  @keyframes snowfall {
    0%   { transform: translateY(-20px) translateX(0); opacity: 1; }
    100% { transform: translateY(100vh) translateX(20px); opacity: 0.3; }
  }
  @keyframes sleigh {
    0%   { left: -200px; top: 30px; }
    100% { left: calc(100% + 200px); top: 30px; }
  }
  .snowflake { animation: snowfall linear infinite; }
  .sleigh { animation: sleigh linear infinite; }
`;

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="text-white text-lg animate-pulse">Завантаження...</div>
  </div>
);

const ErrorState: React.FC<{ type: ErrorType }> = ({ type }) => {
  const messages: Record<ErrorType, string> = {
    NOT_FOUND: 'Ваша участь ще не підтверджена. Зверніться до адміністратора.',
    NO_RECIPIENT: 'Жеребкування ще не проведено. Скоро дізнаєтесь кому дарувати! 🎁',
    SERVER_ERROR: 'Не вдалося завантажити дані. Спробуйте пізніше.',
  };
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-5xl mb-4">🎅</div>
      <div className="text-white text-base leading-relaxed">{messages[type]}</div>
    </div>
  );
};

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value }) => (
  <div className="mb-4">
    <div className="text-xs text-[#8fa8c8] uppercase tracking-wider mb-1">
      {icon} {label}
    </div>
    <div className="text-white text-base leading-relaxed bg-[#112240] rounded-lg px-4 py-3">
      {value}
    </div>
  </div>
);

const RecipientCard: React.FC<{ entry: SantaEntry }> = ({ entry }) => {
  const recipient = entry.recipientId as SantaEntry;
  const hasAnyField =
    !!recipient.wantsToReceive ||
    !!recipient.doesntWantToReceive ||
    !!recipient.hobbies ||
    !!recipient.interestingFacts;

  return (
    <div>
      <div className="text-sm text-[#8fa8c8] uppercase tracking-widest">
        🎅 Ти даруєш подарунок...
      </div>
      <div className="text-3xl font-bold text-white mt-2 mb-6">{recipient.fullName}</div>

      {!hasAnyField && (
        <div className="text-[#8fa8c8] text-sm italic">Побажань поки що немає</div>
      )}

      {recipient.wantsToReceive && (
        <InfoRow icon="🎁" label="Що хоче" value={recipient.wantsToReceive} />
      )}
      {recipient.doesntWantToReceive && (
        <InfoRow icon="🚫" label="Що не хоче" value={recipient.doesntWantToReceive} />
      )}
      {recipient.hobbies && (
        <InfoRow icon="✨" label="Захоплення" value={recipient.hobbies} />
      )}
      {recipient.interestingFacts && (
        <InfoRow icon="💡" label="Цікаві факти" value={recipient.interestingFacts} />
      )}
    </div>
  );
};

export const SecretSantaView: React.FC = () => {
  const [entry, setEntry] = useState<SantaEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);

  useEffect(() => {
    getMyEntry()
      .then(e => {
        if (!e.recipientId) {
          setErrorType('NO_RECIPIENT');
        } else {
          setEntry(e);
        }
      })
      .catch(err => {
        setErrorType(err.message === 'NOT_FOUND' ? 'NOT_FOUND' : 'SERVER_ERROR');
      })
      .finally(() => setLoading(false));
  }, []);

  const snowflakes = useMemo<Snowflake[]>(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        left: `${Math.floor((i * 37 + 11) % 100)}%`,
        duration: `${6 + ((i * 13) % 9)}s`,
        delay: `${((i * 7) % 11)}s`,
        size: `${8 + ((i * 3) % 9)}px`,
      })),
    [],
  );

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4">
      <style>{keyframeStyles}</style>

      <div className="relative overflow-hidden max-w-lg w-full bg-[#0a1628] border border-[#1e3a5f] rounded-2xl shadow-2xl p-8">
        {/* Santa sleigh */}
        <div
          className="sleigh absolute text-4xl pointer-events-none select-none"
          style={{ animationDuration: '12s' }}
        >
          🎅🛷
        </div>

        {/* Snowflakes */}
        {snowflakes.map((s, i) => (
          <div
            key={i}
            className="snowflake absolute text-white opacity-70 pointer-events-none select-none"
            style={{
              left: s.left,
              animationDuration: s.duration,
              animationDelay: s.delay,
              fontSize: s.size,
            }}
          >
            ❄
          </div>
        ))}

        {/* Trees */}
        <div className="absolute bottom-4 left-4 text-4xl pointer-events-none select-none">🎄</div>
        <div className="absolute bottom-4 right-4 text-4xl pointer-events-none select-none">🎄</div>

        {/* Content */}
        <div className="relative z-10">
          {loading && <LoadingState />}
          {!loading && errorType && <ErrorState type={errorType} />}
          {!loading && !errorType && entry && <RecipientCard entry={entry} />}
        </div>
      </div>
    </div>
  );
};
