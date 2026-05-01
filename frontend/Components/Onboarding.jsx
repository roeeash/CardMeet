// CardMeet — Onboarding (3-step)
// Lives outside main router; can be entered from Profile

const { useState: useStateOnb } = React;

function Onboarding({ onDone, onSkip }) {
  const [step, setStep] = useStateOnb(0);
  const [city, setCity] = useStateOnb('Tel Aviv, Israel');
  const [reach, setReach] = useStateOnb(75);
  const [games, setGames] = useStateOnb(['MTG', 'Pokémon']);

  const toggleGame = (g) => {
    setGames(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const next = () => {
    if (step < 2) setStep(step + 1);
    else onDone({ city, reach, games });
  };
  const back = () => {
    if (step === 0) onSkip();
    else setStep(step - 1);
  };

  // Slider drag
  const onSliderChange = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = x / rect.width;
    const val = Math.round(5 + pct * (500 - 5));
    setReach(val);
  };

  const reachPct = ((reach - 5) / (500 - 5)) * 100;

  return (
    <div className="onb-wrap" data-screen-label={`01 Onboarding · Step ${step + 1}`}>
      <div className="onb-progress">
        <div className={`onb-progress-step ${step >= 0 ? 'done' : ''}`} />
        <div className={`onb-progress-step ${step >= 1 ? 'done' : ''}`} />
        <div className={`onb-progress-step ${step >= 2 ? 'done' : ''}`} />
      </div>

      <div className="onb-step-num">Step {step + 1} of 3</div>

      {step === 0 && (
        <>
          <h1 className="onb-headline">Where do you<br/><em>play?</em></h1>
          <p className="onb-blurb">Your home base anchors the calendar — every convention within reach gets pulled in automatically.</p>

          <div className="onb-body">
            <div className="onb-label">Your location</div>
            <div className="onb-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📍</span>
              <input
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, fontFamily: 'inherit', background: 'transparent' }}
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 22 }}>
              <div className="onb-label">Detected from device</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', lineHeight: 1.6 }}>
                32.0853° N · 34.7818° E<br/>
                <span style={{ color: 'var(--good)' }}>● </span>GPS confirmed · 14 sec ago
              </div>
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="onb-headline">How far will<br/>you <em>travel?</em></h1>
          <p className="onb-blurb">A single number for now. Most players go further for a Grand Prix than for FNM — that's a v2 problem.</p>

          <div className="onb-body">
            <div className="onb-radius">
              <div className="num">{reach}</div>
              <div className="unit">kilometers</div>
            </div>
            <div className="onb-slider" onClick={onSliderChange}>
              <div className="onb-slider-track" />
              <div className="onb-slider-fill" style={{ width: `${reachPct}%` }} />
              <div className="onb-slider-thumb" style={{ left: `${reachPct}%` }} />
            </div>
            <div className="onb-slider-labels">
              <span>5 KM</span><span>500 KM</span>
            </div>
            <div style={{ marginTop: 24, padding: 14, background: 'var(--accent-soft)', borderRadius: 12, fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, marginBottom: 6 }}>Within {reach} km</div>
              <div><strong>{reach < 20 ? 3 : reach < 75 ? 5 : reach < 200 ? 8 : 12}</strong> conventions in your reach over the next 60 days.</div>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="onb-headline">What do you<br/><em>play?</em></h1>
          <p className="onb-blurb">Your selection filters every listing and convention from here on. You can always come back and change this.</p>

          <div className="onb-body">
            <div className="onb-label">Pick all that apply</div>
            <div className="game-grid">
              {['Magic: TG', 'Pokémon', 'Yu-Gi-Oh!', 'Lorcana', 'Flesh & Blood', 'One Piece', 'Mindbug'].map(g => {
                const key = g === 'Magic: TG' ? 'MTG' : g;
                const on = games.includes(key);
                return (
                  <button
                    key={g}
                    className={`game-chip ${on ? 'on' : ''}`}
                    onClick={() => toggleGame(key)}
                  >{g}</button>
                );
              })}
            </div>

            <div style={{ marginTop: 22, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', fontFamily: 'Fraunces, serif', lineHeight: 1.5 }}>
              {games.length === 0 ? 'Pick at least one to continue.' :
               games.length === 1 ? `Listings for ${games[0]} only.` :
               `Listings across ${games.length} formats. Filter by game later.`}
            </div>
          </div>
        </>
      )}

      <div className="onb-foot">
        <button className="btn btn-secondary" onClick={back}>{step === 0 ? 'Skip' : 'Back'}</button>
        <button
          className="btn btn-primary"
          disabled={step === 2 && games.length === 0}
          style={step === 2 && games.length === 0 ? { opacity: 0.4, pointerEvents: 'none' } : {}}
          onClick={next}
        >
          {step < 2 ? 'Continue' : 'Open CardMeet'}
        </button>
      </div>
    </div>
  );
}

window.Onboarding = Onboarding;
