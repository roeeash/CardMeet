// CardMeet — atomic visual components

// Counterparty avatar — initials over paper
function Counterparty({ p, compact }) {
  const initials = p.name.split(' ').map(s => s[0]).join('').slice(0, 2);
  return (
    <div className="counterparty">
      <div className="counterparty-avatar">{initials}</div>
      <div className="counterparty-info">
        <div className="counterparty-name">
          {p.name}
          {!compact && (
            <span className="eyebrow" style={{ fontSize: 9, color: 'var(--muted)' }}>
              {p.role === 'buyer' ? 'BUYER' : 'SELLER'}
            </span>
          )}
        </div>
        <div className="counterparty-stats">
          <span className="star">★</span> {p.rating.toFixed(p.rating === 5 ? 1 : 1)} · {p.deals} deals · <span className={p.noShows === 0 ? 'zero-noshow' : ''}>{p.noShows} no-show{p.noShows === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}

// Shared con badge row — appears wherever a buyer/seller will both attend
function SharedCon({ con }) {
  if (!con) return null;
  if (con.shared) {
    return (
      <div className="con-row">
        <span className="con-shared">📅 BOTH @ {con.name.toUpperCase()}</span>
        <span>{con.date}</span>
      </div>
    );
  }
  return (
    <div className="con-row">
      <span style={{ color: 'var(--muted)' }}>📅 {con.name} · {con.date}</span>
    </div>
  );
}

// Negotiating card
function NegoDealCard({ deal, onOpen }) {
  return (
    <div className="deal-card" onClick={() => onOpen(deal.id)}>
      <div className="deal-card-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="deal-card-card">{deal.card.name}</div>
          <div className="deal-card-meta">{deal.card.set} · {deal.card.printing}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div className="deal-price">
            <span className="deal-price-strike">₪{deal.askPrice}</span>
            ₪{deal.currentOffer}
          </div>
          {deal.turn === 'you' && <span className="pill pill-warn">⚡ Your turn</span>}
          {deal.turn === 'them' && <span className="pill pill-muted">Their turn</span>}
        </div>
      </div>
      <SharedCon con={deal.sharedCon} />
      <Counterparty p={deal.counterparty} compact />
      <div className="nego-thread">
        {deal.thread.slice(-2).map((m, i) => (
          <div className="nego-row" key={i}>
            <span className="nego-actor">{m.actor === 'you' ? 'YOU' : 'THEM'}</span>
            <span className="nego-amount">₪{m.amount.toLocaleString('en')}</span>
            <span className="nego-time">{m.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Matched card — agreed on price, scheduling window
function MatchedDealCard({ deal, onOpen }) {
  return (
    <div className="deal-card" onClick={() => onOpen(deal.id)}>
      <div className="deal-card-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="deal-card-card">{deal.card.name}</div>
          <div className="deal-card-meta">{deal.card.set} · {deal.card.printing}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div className="deal-price">₪{deal.agreedPrice}</div>
          <span className="pill pill-good">✓ Matched</span>
        </div>
      </div>
      <SharedCon con={deal.sharedCon} />
      <Counterparty p={deal.counterparty} compact />
      <div className="window-display">
        <div className="window-time">{deal.proposed.window}</div>
        <div className="window-detail">
          <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{deal.proposed.day}</div>
          <div>{deal.proposed.spot}</div>
        </div>
        {deal.turn === 'you' && <span className="pill pill-warn" style={{ alignSelf: 'flex-start' }}>⚡ Confirm</span>}
        {deal.turn === 'them' && <span className="pill pill-muted" style={{ alignSelf: 'flex-start' }}>Pending</span>}
      </div>
    </div>
  );
}

// Scheduled card — committed window
function ScheduledDealCard({ deal, onOpen, onCheckIn }) {
  return (
    <div className="deal-card" onClick={() => onOpen(deal.id)}>
      <div className="deal-card-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="deal-card-card">{deal.card.name}</div>
          <div className="deal-card-meta">{deal.card.set} · {deal.card.printing}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div className="deal-price">₪{deal.agreedPrice}</div>
          {deal.meeting.checkedIn
            ? <span className="pill pill-good">✓ Checked in</span>
            : <span className="pill pill-muted">In {deal.meeting.countdown}</span>}
        </div>
      </div>
      <SharedCon con={deal.sharedCon} />
      <div className="window-display">
        <div className="window-time">{deal.meeting.window}</div>
        <div className="window-detail">
          <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{deal.meeting.day}</div>
          <div>{deal.meeting.spot}</div>
        </div>
      </div>
      <Counterparty p={deal.counterparty} compact />
      {!deal.meeting.checkedIn && (
        <button
          className="btn btn-secondary btn-block"
          onClick={(e) => { e.stopPropagation(); onCheckIn(deal.id); }}
        >
          Check in at meetup
        </button>
      )}
      {deal.meeting.checkedIn && (
        <div style={{
          background: 'var(--good-soft)', color: 'var(--good)',
          padding: '10px 12px', borderRadius: 8, fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 100, background: 'currentColor', animation: 'pulse 1.6s ease-in-out infinite' }} />
          You're here · waiting for {deal.counterparty.name.split(' ')[0]}
        </div>
      )}
    </div>
  );
}

window.NegoDealCard = NegoDealCard;
window.MatchedDealCard = MatchedDealCard;
window.ScheduledDealCard = ScheduledDealCard;
window.Counterparty = Counterparty;
window.SharedCon = SharedCon;
