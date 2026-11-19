import React, { useEffect, useMemo, useState } from 'react';
import { getMyEntry, SantaEntry } from '../services/secretSantaService';

type ErrorType = 'NOT_FOUND' | 'NO_RECIPIENT' | 'SERVER_ERROR';

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
  .sleigh-anim    { animation: sleigh linear infinite; position: absolute; top: 20px; }
`;

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="text-white text-lg animate-pulse">Завантаження...</div>
  </div>
);

const ErrorState: React.FC<{ type: ErrorType }> = ({ type }) => {
  const messages: Record<ErrorType, string> = {
    NOT_FOUND:   'Ваша участь ще не підтверджена. Зверніться до адміністратора.',
    NO_RECIPIENT:'Жеребкування ще не проведено. Скоро дізнаєтесь кому дарувати! 🎁',
    SERVER_ERROR:'Не вдалося завантажити дані. Спробуйте пізніше.',
  };
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <img
        src="/secret-santa/santa-gifts.png"
        alt="Миколай"
        className="w-28 h-auto mb-4 opacity-90 drop-shadow-lg"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
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
    !!recipient.wantsToReceive   ||
    !!recipient.doesntWantToReceive ||
    !!recipient.hobbies          ||
    !!recipient.interestingFacts;

  return (
    <div>
      {/* Santa illustration */}
      <div className="flex justify-center mb-4">
        <img
          src="/secret-santa/santa.png"
          alt="Миколай"
          className="h-24 w-auto drop-shadow-lg"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      <div className="text-sm text-[#8fa8c8] uppercase tracking-widest text-center">
        🎅 Ти даруєш подарунок...
      </div>
      <div className="text-3xl font-bold text-white mt-2 mb-6 text-center">{recipient.fullName}</div>

      {/* Gift decoration */}
      <div className="flex justify-center gap-3 mb-6">
        <img
          src="/secret-santa/gift1.png"
          alt=""
          className="h-10 w-auto opacity-80"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <img
          src="/secret-santa/gift2.png"
          alt=""
          className="h-10 w-auto opacity-80"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {!hasAnyField && (
        <div className="text-[#8fa8c8] text-sm italic text-center">Побажань поки що немає</div>
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
  const [entry, setEntry]       = useState<SantaEntry | null>(null);
  const [loading, setLoading]   = useState(true);
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
        left:     `${Math.floor((i * 37 + 11) % 100)}%`,
        duration: `${6 + ((i * 13) % 9)}s`,
        delay:    `-${((i * 7) % 11)}s`,
        size:     `${18 + ((i * 3) % 16)}px`,
        imgIdx:   i % 2,
      })),
    [],
  );

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4">
      <style>{keyframeStyles}</style>

      <div className="relative overflow-hidden max-w-lg w-full bg-[#0a1628] border border-[#1e3a5f] rounded-2xl shadow-2xl p-8">

        {/* Santa sleigh flying across */}
        <img
          src="/secret-santa/santa-sleigh.png"
          alt=""
          className="sleigh-anim pointer-events-none select-none"
          style={{ height: '70px', width: 'auto', animationDuration: '12s' }}
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = 'none';
            // fallback: show emoji span
            const span = document.createElement('span');
            span.className = 'sleigh-anim pointer-events-none select-none';
            span.style.fontSize = '2.5rem';
            span.style.animationDuration = '12s';
            span.textContent = '🎅🛷';
            el.parentElement?.appendChild(span);
          }}
        />

        {/* Snowflakes */}
        {snowflakes.map((s, i) => (
          <img
            key={i}
            src={`/secret-santa/snowflake${s.imgIdx + 1}.png`}
            alt=""
            className="snowflake-anim absolute pointer-events-none select-none opacity-70"
            style={{
              left:            s.left,
              top:             '-30px',
              width:           s.size,
              height:          'auto',
              animationDuration: s.duration,
              animationDelay:  s.delay,
            }}
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = 'none';
            }}
          />
        ))}

        {/* Christmas trees */}
        <img
          src="/secret-santa/tree.png"
          alt=""
          className="absolute bottom-2 left-2 pointer-events-none select-none opacity-90"
          style={{ height: '90px', width: 'auto' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <img
          src="/secret-santa/tree2.png"
          alt=""
          className="absolute bottom-2 right-2 pointer-events-none select-none opacity-90"
          style={{ height: '90px', width: 'auto' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />

        {/* Content */}
        <div className="relative z-10 mt-10">
          {loading                           && <LoadingState />}
          {!loading && errorType             && <ErrorState type={errorType} />}
          {!loading && !errorType && entry   && <RecipientCard entry={entry} />}
        </div>

      </div>
    </div>
  );
};
