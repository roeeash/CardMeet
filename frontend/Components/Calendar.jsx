// CardMeet — Calendar screen

const { useState: useStateCal } = React;

function Calendar({ onOpenAddCon }) {
  const [cons, setCons] = useStateCal(() => JSON.parse(JSON.stringify(window.CONVENTIONS_SEED)));
  const goingCount = cons.filter(c => c.rsvp === 'going').length;

  const setRsvp = (id, val) => {
    setCons(prev => prev.map(c => c.id === id ? { ...c, rsvp: c.rsvp === val ? null : val } : c));
  };

  return (
    <div className="screen" data-screen-label="02 Calendar">
      <div className="app-header">
        <div className="app-title-row">
          <div>
            <div className="app-title">My conventions</div>
            <div className="app-sub">
              <strong style={{ color: 'var(--ink)' }}>{goingCount} going</strong>
              <span style={{ fontStyle: 'italic', fontFamily: 'Fraunces' }}> · {cons.length} in 75 km</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 0 8px', flex: 1, overflowY: 'auto' }}>
        <div className="section-head">
          <span className="eyebrow">— This month</span>
          <span className="more">Filter</span>
        </div>

        {cons.map(c => (
          <div key={c.id} className={`con-card ${c.featured ? 'featured' : ''}`}>
            <div>
              <div className="con-date">{c.dateRange ? `${c.dateRange} · ${c.date}` : c.date}</div>
              <div className="con-name">{c.name}</div>
              <div className="con-venue">
                <span>📍 {c.venue} · {c.city}</span>
                <span className="dot">·</span>
                <span>{c.distance} km</span>
              </div>
            </div>
            <div className="con-attendees">{c.attendees.toLocaleString()} attending · {c.games.join(', ')}</div>
            <div className="con-rsvp">
              <button
                className={`con-rsvp-btn ${c.rsvp === 'going' ? 'on-going' : ''}`}
                onClick={() => setRsvp(c.id, 'going')}
              >Going</button>
              <button
                className={`con-rsvp-btn ${c.rsvp === 'maybe' ? 'on-maybe' : ''}`}
                onClick={() => setRsvp(c.id, 'maybe')}
              >Maybe</button>
              <button
                className={`con-rsvp-btn ${c.rsvp === 'no' ? 'on-no' : ''}`}
                onClick={() => setRsvp(c.id, 'no')}
              >No</button>
            </div>
          </div>
        ))}

        <button className="add-con" onClick={onOpenAddCon}>+ Add a convention</button>

        <div style={{ padding: '12px 24px 24px', textAlign: 'center', fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic', fontFamily: 'Fraunces, serif' }}>
          Calendar updates daily from organizers and players.
        </div>
      </div>
    </div>
  );
}

window.Calendar = Calendar;
