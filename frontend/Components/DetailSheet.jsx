// Detail sheet — bottom modal for deep deal interaction

function DetailSheet({ deal, onClose, onCounter, onAccept, onWithdraw, onConfirmTime, onProposeTime, onCheckIn }) {
  const [counterAmount, setCounterAmount] = React.useState(
    deal.status === 'negotiating' ? String(deal.currentOffer + 10) : ''
  );

  const isNego = deal.status === 'negotiating';
  const isMatched = deal.status === 'matched';
  const isScheduled = deal.status === 'scheduled';

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-grab" />
        <div className="sheet-body">
          <div className="sheet-header">
            <div style={{ flex: 1 }}>
              <div className="sheet-title">{deal.card.name}</div>
              <div className="sheet-sub">{deal.card.set} · {deal.card.printing}</div>
            </div>
            <button className="sheet-close" onClick={onClose}>✕</button>
          </div>

          {/* Turn banner inside sheet */}
          {deal.turn === 'you' && (
            <div className="turn-banner warn" style={{ margin: '0 0 14px' }}>
              <span className="pulse" />
              <span className="turn-banner-label">Your turn</span>
              <span className="turn-banner-text">{isNego ? 'Counter, accept, or withdraw.' : isMatched ? 'Confirm the proposed window.' : ''}</span>
            </div>
          )}
          {deal.turn === 'them' && (
            <div className="turn-banner muted" style={{ margin: '0 0 14px' }}>
              <span className="turn-banner-label">Waiting on {deal.counterparty.name.split(' ')[0]}</span>
            </div>
          )}

          {/* Counterparty + shared con */}
          <div className="sheet-section">
            <div className="sheet-section-label">Counterparty</div>
            <Counterparty p={deal.counterparty} />
            <div style={{ marginTop: 12 }}>
              <SharedCon con={deal.sharedCon} />
            </div>
          </div>

          {/* Negotiation thread */}
          {isNego && (
            <div className="sheet-section">
              <div className="sheet-section-label">Thread · Asking ₪{deal.askPrice}</div>
              <div className="thread">
                {deal.thread.map((m, i) => (
                  <div className={`thread-row ${m.actor === 'you' ? 'you' : ''}`} key={i}>
                    <span className="thread-actor">{m.actor === 'you' ? 'You' : deal.counterparty.name.split(' ')[0]}</span>
                    <span className="thread-amount">₪{m.amount.toLocaleString('en')}</span>
                    <span className="thread-time">{m.t}</span>
                  </div>
                ))}
              </div>
              {deal.turn === 'you' && (
                <>
                  <div className="counter-input-row">
                    <input
                      className="counter-input"
                      value={counterAmount}
                      onChange={(e) => setCounterAmount(e.target.value.replace(/[^\d]/g, ''))}
                      placeholder="₪"
                    />
                    <button className="btn btn-primary" onClick={() => onCounter(deal.id, Number(counterAmount))}>
                      Counter
                    </button>
                  </div>
                  <div className="action-row" style={{ marginTop: 10 }}>
                    <button className="btn btn-secondary" onClick={() => onAccept(deal.id)}>Accept ₪{deal.currentOffer}</button>
                    <button className="btn btn-bad" onClick={() => onWithdraw(deal.id)}>Withdraw</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Matched — meeting window */}
          {isMatched && (
            <div className="sheet-section">
              <div className="sheet-section-label">Proposed window</div>
              <div className="meeting-card">
                <div className="meeting-row">
                  <div className="meeting-row-icon">📅</div>
                  <div className="meeting-row-info">
                    <div className="meeting-row-label">When (commitment)</div>
                    <div className="meeting-row-value">{deal.proposed.window}</div>
                    <div className="meeting-row-detail">{deal.proposed.day}</div>
                  </div>
                </div>
                <div className="meeting-row">
                  <div className="meeting-row-icon">📍</div>
                  <div className="meeting-row-info">
                    <div className="meeting-row-label">Where</div>
                    <div className="meeting-row-value">{deal.sharedCon.name}</div>
                    <div className="meeting-row-detail">{deal.proposed.spot}</div>
                  </div>
                </div>
                <div className="meeting-row">
                  <div className="meeting-row-icon">₪</div>
                  <div className="meeting-row-info">
                    <div className="meeting-row-label">Agreed price</div>
                    <div className="meeting-row-value">₪{deal.agreedPrice}</div>
                  </div>
                </div>
              </div>
              {deal.turn === 'you' && (
                <div className="action-row" style={{ marginTop: 14 }}>
                  <button className="btn btn-primary" onClick={() => onConfirmTime(deal.id)}>Confirm window</button>
                  <button className="btn btn-secondary" onClick={() => onProposeTime(deal.id)}>Propose new</button>
                </div>
              )}
              {deal.turn === 'them' && (
                <div className="action-row" style={{ marginTop: 14 }}>
                  <button className="btn btn-bad" onClick={() => onWithdraw(deal.id)}>Withdraw</button>
                </div>
              )}
            </div>
          )}

          {/* Scheduled — committed */}
          {isScheduled && (
            <div className="sheet-section">
              <div className="sheet-section-label">Committed window</div>
              <div className="meeting-card">
                <div className="meeting-row">
                  <div className="meeting-row-icon">📅</div>
                  <div className="meeting-row-info">
                    <div className="meeting-row-label">When (commitment)</div>
                    <div className="meeting-row-value">{deal.meeting.window}</div>
                    <div className="meeting-row-detail">{deal.meeting.day} · in {deal.meeting.countdown}</div>
                  </div>
                </div>
                <div className="meeting-row">
                  <div className="meeting-row-icon">📍</div>
                  <div className="meeting-row-info">
                    <div className="meeting-row-label">Where</div>
                    <div className="meeting-row-value">{deal.sharedCon.name}</div>
                    <div className="meeting-row-detail">{deal.meeting.spot}</div>
                  </div>
                </div>
                <div className="meeting-row">
                  <div className="meeting-row-icon">₪</div>
                  <div className="meeting-row-info">
                    <div className="meeting-row-label">Agreed price · cash on meet</div>
                    <div className="meeting-row-value">₪{deal.agreedPrice}</div>
                  </div>
                </div>
              </div>
              <div className="action-row" style={{ marginTop: 14 }}>
                {!deal.meeting.checkedIn ? (
                  <button className="btn btn-primary btn-block" onClick={() => onCheckIn(deal.id)}>
                    Check in at meetup
                  </button>
                ) : (
                  <button className="btn btn-secondary btn-block" disabled style={{ opacity: 0.6 }}>
                    Checked in · waiting
                  </button>
                )}
              </div>
              <div style={{ marginTop: 10, textAlign: 'center' }}>
                <button className="btn btn-bad" style={{ background: 'transparent', border: 'none', color: 'var(--bad)', textDecoration: 'underline', padding: 4 }}
                  onClick={() => onWithdraw(deal.id)}>
                  Cancel meetup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

window.DetailSheet = DetailSheet;
