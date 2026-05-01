// CardMeet — main app

const { useState, useEffect, useMemo } = React;

const TWEAKS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2c4cff",
  "paper": "#f7f6f2",
  "showSharedConBadge": true,
  "showNoShows": true,
  "density": "comfy",
  "showTurnBanner": true
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAKS_DEFAULTS);
  const [deals, setDeals] = useState(() => JSON.parse(JSON.stringify(window.DEALS_SEED)));
  const [activeTab, setActiveTab] = useState('negotiating');
  const [openDealId, setOpenDealId] = useState(null);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('all'); // all | shared-con | your-turn

  // Apply tweak vars
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', tweaks.accent);
    root.style.setProperty('--paper', tweaks.paper);
    // Lighter accent-soft from the accent
    const m = tweaks.accent.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      const r = parseInt(m[1].slice(0, 2), 16);
      const g = parseInt(m[1].slice(2, 4), 16);
      const b = parseInt(m[1].slice(4, 6), 16);
      root.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.12)`);
    }
  }, [tweaks.accent, tweaks.paper]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  // ── Filter pipeline ──
  const filtered = useMemo(() => {
    return deals.filter(d => {
      if (d.status !== activeTab) return false;
      if (filter === 'shared-con' && !d.sharedCon?.shared) return false;
      if (filter === 'your-turn' && d.turn !== 'you') return false;
      return true;
    });
  }, [deals, activeTab, filter]);

  const counts = useMemo(() => ({
    negotiating: deals.filter(d => d.status === 'negotiating').length,
    matched:     deals.filter(d => d.status === 'matched').length,
    scheduled:   deals.filter(d => d.status === 'scheduled').length,
  }), [deals]);

  const yourTurnCount = useMemo(
    () => deals.filter(d => d.turn === 'you').length,
    [deals]
  );

  const updateDeal = (id, fn) => setDeals(ds => ds.map(d => d.id === id ? fn(d) : d));

  // Action handlers
  const handleCounter = (id, amount) => {
    if (!amount || isNaN(amount)) return;
    updateDeal(id, d => ({
      ...d,
      thread: [...d.thread, { actor: 'you', amount, t: 'now' }],
      currentOffer: amount,
      turn: 'them',
      lastMove: `You countered ₪${amount.toLocaleString('en')}`,
      lastMoveAt: 'now',
    }));
    showToast(`Counter sent · ₪${amount.toLocaleString('en')}`);
    setOpenDealId(null);
  };

  const handleAccept = (id) => {
    updateDeal(id, d => ({
      ...d,
      status: 'matched',
      turn: 'them',
      agreedPrice: d.currentOffer,
      proposed: { day: 'Sat May 23', window: '14:00 – 14:30', spot: 'Trade hall, table M-12' },
    }));
    showToast('Match confirmed · proposing window');
    setOpenDealId(null);
    setActiveTab('matched');
  };

  const handleWithdraw = (id) => {
    setDeals(ds => ds.filter(d => d.id !== id));
    showToast('Withdrawn');
    setOpenDealId(null);
  };

  const handleConfirmTime = (id) => {
    updateDeal(id, d => ({
      ...d,
      status: 'scheduled',
      turn: 'none',
      meeting: {
        day: d.proposed.day,
        window: d.proposed.window,
        spot: d.proposed.spot,
        checkedIn: false,
        countdown: '21h',
      },
    }));
    showToast('Meetup scheduled');
    setOpenDealId(null);
    setActiveTab('scheduled');
  };

  const handleProposeTime = (id) => {
    updateDeal(id, d => ({
      ...d,
      turn: 'them',
      proposed: { ...d.proposed, window: '14:30 – 15:00' },
    }));
    showToast('New window proposed');
    setOpenDealId(null);
  };

  const handleCheckIn = (id) => {
    updateDeal(id, d => ({
      ...d,
      meeting: { ...d.meeting, checkedIn: true },
    }));
    showToast('Checked in · partner notified');
  };

  const openDeal = deals.find(d => d.id === openDealId);

  const isCompact = tweaks.density === 'compact';

  return (
    <>
      <div className="outside" />
      <div className="phone" style={isCompact ? { '--card-pad': '10px' } : {}}>
        {/* Status bar */}
        <div className="status-bar">
          <span>9:41</span>
          <span className="status-right">
            <span>•••• LTE</span>
            <span>100%</span>
          </span>
        </div>

        {/* Header */}
        <div className="app-header">
          <div className="app-title-row">
            <div>
              <div className="app-title">My Deals</div>
              <div className="app-sub">
                {yourTurnCount > 0
                  ? <><strong style={{ color: 'var(--warn)' }}>{yourTurnCount} need you.</strong> <span className="serif" style={{ fontStyle: 'italic' }}>The rest are with them.</span></>
                  : <span className="serif" style={{ fontStyle: 'italic' }}>All caught up — waiting on the other side.</span>
                }
              </div>
            </div>
            <div className="profile-dot">R</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'negotiating' ? 'active' : ''}`}
            onClick={() => setActiveTab('negotiating')}
          >
            <span className="tab-count">{counts.negotiating}</span>
            <span>Negotiating</span>
          </button>
          <button
            className={`tab ${activeTab === 'matched' ? 'active' : ''}`}
            onClick={() => setActiveTab('matched')}
          >
            <span className="tab-count">{counts.matched}</span>
            <span>Matched</span>
          </button>
          <button
            className={`tab ${activeTab === 'scheduled' ? 'active' : ''}`}
            onClick={() => setActiveTab('scheduled')}
          >
            <span className="tab-count">{counts.scheduled}</span>
            <span>Scheduled</span>
          </button>
        </div>

        {/* Filter row */}
        <div className="filter-row">
          <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`filter-chip ${filter === 'your-turn' ? 'active' : ''}`} onClick={() => setFilter('your-turn')}>⚡ Your turn</button>
          <button className={`filter-chip ${filter === 'shared-con' ? 'active' : ''}`} onClick={() => setFilter('shared-con')}>📅 Shared con</button>
        </div>

        {/* Scroll content */}
        <div className="scroll" data-screen-label={`${activeTab}`}>
          {/* Turn banner — global, top of list */}
          {tweaks.showTurnBanner && yourTurnCount > 0 && activeTab === 'negotiating' && filter !== 'your-turn' && (
            <div className="turn-banner warn">
              <span className="pulse" />
              <span className="turn-banner-label">Your turn ×{yourTurnCount}</span>
              <span className="turn-banner-text serif" style={{ fontStyle: 'italic' }}>
                — don't make them wait.
              </span>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="empty">
              <div className="empty-mark" />
              <div className="empty-title">
                {activeTab === 'negotiating' && (filter === 'your-turn'
                  ? <>Nothing on you. <em style={{ fontFamily: 'Fraunces' }}>Yet.</em></>
                  : 'No active negotiations.')}
                {activeTab === 'matched' && 'Nothing matched.'}
                {activeTab === 'scheduled' && 'No meetups scheduled.'}
              </div>
              <div className="empty-body">
                {activeTab === 'negotiating' && 'Browse the feed and make your first offer.'}
                {activeTab === 'matched' && 'Once both sides agree on a price, deals show up here to schedule.'}
                {activeTab === 'scheduled' && 'Confirmed windows will appear here, with a countdown.'}
              </div>
              {activeTab === 'negotiating' && <button className="btn btn-primary btn-pill">Browse feed</button>}
            </div>
          )}

          {filtered.map(d => {
            if (d.status === 'negotiating') return <NegoDealCard key={d.id} deal={d} onOpen={setOpenDealId} />;
            if (d.status === 'matched')     return <MatchedDealCard key={d.id} deal={d} onOpen={setOpenDealId} />;
            if (d.status === 'scheduled')   return <ScheduledDealCard key={d.id} deal={d} onOpen={setOpenDealId} onCheckIn={handleCheckIn} />;
            return null;
          })}

          {filtered.length > 0 && (
            <div style={{ padding: '20px 20px 32px', textAlign: 'center' }}>
              <div className="eyebrow">— End of {activeTab}</div>
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="toast">
            <span className="toast-mark">✓</span>
            <span>{toast}</span>
          </div>
        )}

        {/* Detail sheet */}
        {openDeal && (
          <DetailSheet
            deal={openDeal}
            onClose={() => setOpenDealId(null)}
            onCounter={handleCounter}
            onAccept={handleAccept}
            onWithdraw={handleWithdraw}
            onConfirmTime={handleConfirmTime}
            onProposeTime={handleProposeTime}
            onCheckIn={handleCheckIn}
          />
        )}
      </div>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Color" />
          <TweakColor label="Accent" value={tweaks.accent} onChange={v => setTweak('accent', v)} />
          <TweakColor label="Paper bg" value={tweaks.paper} onChange={v => setTweak('paper', v)} />
        <TweakSection label="Patterns" />
          <TweakToggle label="Show shared-con badge" value={tweaks.showSharedConBadge} onChange={v => setTweak('showSharedConBadge', v)} />
          <TweakToggle label="Show no-show count" value={tweaks.showNoShows} onChange={v => setTweak('showNoShows', v)} />
          <TweakToggle label="Show 'your turn' banner" value={tweaks.showTurnBanner} onChange={v => setTweak('showTurnBanner', v)} />
        <TweakSection label="Density" />
        <TweakRadio
          label="Card density"
          value={tweaks.density}
          onChange={v => setTweak('density', v)}
          options={[
            { value: 'comfy', label: 'Comfy' },
            { value: 'compact', label: 'Compact' },
          ]}
        />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
