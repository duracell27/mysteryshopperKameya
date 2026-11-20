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

interface FallingGift {
  left:     string;
  size:     string;
  imgIdx:   number;
  rotation: number;
  cycle:    number;
  delay:    string;
}

interface SleighPass {
  key:      number;
  fromY:    number;
  toY:      number;
  duration: number;
  delay:    number; // negative = already mid-flight on mount
}

function randomSleighPass(prevKey = 0, initialDelay = 0): SleighPass {
  const maxY = typeof window !== 'undefined' ? window.innerHeight * 0.5 : 300;
  return {
    key:      prevKey + 1,
    fromY:    15 + Math.random() * maxY,
    toY:      15 + Math.random() * maxY,
    duration: 6 + Math.random() * 9,
    delay:    initialDelay,
  };
}

function buildGifts(): FallingGift[] {
  return Array.from({ length: 10 }, () => {
    const cycle = 7 + Math.random() * 8; // 7–15s total cycle
    return {
      left:     `${5 + Math.random() * 85}%`,
      size:     `${24 + Math.floor(Math.random() * 22)}px`,
      imgIdx:   Math.floor(Math.random() * 3),
      rotation: (Math.random() > 0.5 ? 1 : -1) * (8 + Math.floor(Math.random() * 25)),
      cycle,
      delay:    `-${(Math.random() * cycle).toFixed(1)}s`,
    };
  });
}

function buildGiftKeyframes(gifts: FallingGift[]): string {
  return gifts.map((g, i) => {
    const rot = `${g.rotation}deg`;
    return `
      @keyframes giftfall${i} {
        0%   { opacity:0; transform:translateY(-60px) rotate(0deg); }
        8%   { opacity:1; transform:translateY(-60px) rotate(0deg); }
        70%  { opacity:1; transform:translateY(calc(100vh - 30px)) rotate(${rot}); }
        85%  { opacity:0; transform:translateY(calc(100vh - 30px)) rotate(${rot}); }
        100% { opacity:0; transform:translateY(-60px) rotate(0deg); }
      }
    `;
  }).join('\n');
}

const BASE_KEYFRAMES = `
  @keyframes snowfall {
    0%   { transform: translateY(-30px) translateX(0) rotate(0deg); opacity: 1; }
    50%  { transform: translateY(50vh) translateX(15px) rotate(180deg); opacity: 0.8; }
    100% { transform: translateY(100vh) translateX(-10px) rotate(360deg); opacity: 0.2; }
  }
  .snowflake-anim { animation: snowfall linear infinite; }
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
          className="h-40 w-auto drop-shadow-lg"
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
  const [entry, setEntry]         = useState<SantaEntry | null>(null);
  const [loading, setLoading]     = useState(true);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [sleigh, setSleigh]   = useState<SleighPass>(() => randomSleighPass(0));
  const [sleighR, setSleighR] = useState<SleighPass>(() => randomSleighPass(100, -(4 + Math.random() * 4)));

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

  const fallingGifts = useMemo(() => buildGifts(), []);
  const keyframeStyles = useMemo(
    () => BASE_KEYFRAMES + buildGiftKeyframes(fallingGifts) + `
      @keyframes sleigh${sleigh.key} {
        from { left: -260px; top: ${sleigh.fromY.toFixed(0)}px; }
        to   { left: calc(100% + 260px); top: ${sleigh.toY.toFixed(0)}px; }
      }
      @keyframes sleighR${sleighR.key} {
        from { left: calc(100% + 260px); top: ${sleighR.fromY.toFixed(0)}px; }
        to   { left: -260px; top: ${sleighR.toY.toFixed(0)}px; }
      }
    `,
    [fallingGifts, sleigh, sleighR],
  );

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
    <div className="relative bg-[#0a1628] min-h-screen">
      <style>{keyframeStyles}</style>

      {/* Decoration layer — behind content */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Santa sleigh — random path each pass */}
        <img
          key={sleigh.key}
          src="/secret-santa/santa-sleigh.png"
          alt=""
          className="select-none"
          style={{
            position:                'absolute',
            height:                  '70px',
            width:                   'auto',
            animationName:           `sleigh${sleigh.key}`,
            animationDuration:       `${sleigh.duration.toFixed(1)}s`,
            animationDelay:          `${sleigh.delay.toFixed(1)}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: 1,
            animationFillMode:       'both',
          }}
          onAnimationEnd={() => setSleigh(prev => randomSleighPass(prev.key, 0))}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />

        {/* Santa sleigh — right to left, flipped */}
        <img
          key={`r${sleighR.key}`}
          src="/secret-santa/santa-sleigh.png"
          alt=""
          className="select-none"
          style={{
            position:                'absolute',
            height:                  '70px',
            width:                   'auto',
            transform:               'scaleX(-1)',
            animationName:           `sleighR${sleighR.key}`,
            animationDuration:       `${sleighR.duration.toFixed(1)}s`,
            animationDelay:          `${sleighR.delay.toFixed(1)}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: 1,
            animationFillMode:       'both',
          }}
          onAnimationEnd={() => setSleighR(prev => randomSleighPass(prev.key, 0))}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />

        {/* Snowflakes */}
        {snowflakes.map((s, i) => (
          <img
            key={i}
            src={`/secret-santa/snowflake${s.imgIdx + 1}.png`}
            alt=""
            className="snowflake-anim absolute select-none opacity-70"
            style={{
              left: s.left, top: '-30px',
              width: s.size, height: 'auto',
              animationDuration: s.duration,
              animationDelay:    s.delay,
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ))}

        {/* Falling gifts */}
        {fallingGifts.map((g, i) => (
          <img
            key={i}
            src={`/secret-santa/gift${g.imgIdx + 1}.png`}
            alt=""
            className="select-none"
            style={{
              position: 'absolute', top: 0, left: g.left,
              width: g.size, height: 'auto',
              animationName:           `giftfall${i}`,
              animationDuration:       `${g.cycle.toFixed(1)}s`,
              animationDelay:          g.delay,
              animationTimingFunction: 'ease-in',
              animationIterationCount: 'infinite',
              animationFillMode:       'both',
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ))}

        {/* Christmas trees */}
        <img
          src="/secret-santa/tree.png" alt=""
          className="absolute bottom-0 left-4 select-none opacity-90"
          style={{ height: '220px', width: 'auto' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <img
          src="/secret-santa/tree2.png" alt=""
          className="absolute bottom-0 right-4 select-none opacity-90"
          style={{ height: '300px', width: 'auto' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {/* Content layer — above decorations */}
      <div className="relative z-20 flex items-center justify-center px-4 py-12 min-h-screen">
        <div className="w-full max-w-md">
          {loading                         && <LoadingState />}
          {!loading && errorType           && <ErrorState type={errorType} />}
          {!loading && !errorType && entry && <RecipientCard entry={entry} />}
        </div>
      </div>
    </div>
  );
};
