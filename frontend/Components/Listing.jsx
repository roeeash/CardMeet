// CardMeet — Listing detail + Make-offer sheet

const { useState: useStateLst } = React;

function Listing({ listing, onBack, onSubmitOffer, onBuyNow }) {
  const [offerOpen, setOfferOpen] = useStateLst(false);
  const [offerAmount, setOfferAmount] = useStateLst(Math.round(listing.price * 0.85));
  const [offerNote, setOfferNote] = useStateLst('');
  const [focused, setFocused] = useStateLst(false);

  const submit = () => {
    if (!offerAmount || isNaN(offerAmount) || offerAmount <= 0) return;
    onSubmitOffer(listing, offerAmount, offerNote);
    setOfferOpen(false);
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} data-screen-label="04 Listing detail">
        <div className="sub-header">
          <button className="sub-header-back" onClick={onBack}>‹</button>
          <div style={{ flex: 1 }}>
            <div className="sub-header-title">{listing.cardName}</div>
            <div className="sub-header-sub">{listing.set} · {listing.cond}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--paper)' }}>
          {/* Photo */}
          <div style={{ padding: '20px 20px 0' }}>
            <div className={`detail-photo ${listing.game === 'Pokémon' ? 'mtg-3' : 'mtg-1'}`} style={{
              background: listing.game === 'Pokémon'
                ? 'linear-gradient(135deg, #c93c44, #e87680)'
                : 'linear-gradient(135deg, #2a2a3e, #4a3a6e)',
            }}>
              CARD &nbsp;PHOTO &nbsp;1 / {listing.photos}
            </div>
            <div className="detail-photo-thumbs">
              {Array.from({ length: listing.photos }).map((_, i) => (
                <div key={i} className={`detail-photo-thumb ${i === 0 ? 'active' : ''}`} style={{
                  background: i === 0 ? 'var(--ink)' : 'var(--paper-2)',
                }} />
              ))}
            </div>
          </div>

          <div style={{ padding: '0 20px' }}>
            <div className="detail-headline">{listing.cardName}</div>
            <div className="detail-set">{listing.set} · {listing.cond}</div>
            <div className="detail-price-big">₪{listing.price.toLocaleString()}</div>
            <div className="detail-price-meta">
              Listed {listing.listed}
              <span style={{ color: 'var(--line)' }}>·</span>
              <span className="pill pill-muted">{listing.game}</span>
            </div>
          </div>

          {listing.sharedCon && (
            <div style={{ padding: '16px 20px 0' }}>
              <div className="shared-banner">
                <div className="shared-banner-label">📅 Shared convention</div>
                <div className="shared-banner-body">
                  You're both attending <strong>{listing.sharedCon}</strong>. The deal completes face-to-face — no shipping, no escrow.
                </div>
              </div>
            </div>
          )}

          <div className="detail-section">
            <div className="detail-section-label">Seller</div>
            <div className="seller-card">
              <div className="seller-avatar">{listing.seller.name[0]}</div>
              <div className="seller-info">
                <div className="seller-name">{listing.seller.name}</div>
                <div className="seller-stats">
                  <span className="star">★</span> {listing.seller.rating} · {listing.seller.deals} deals · <span className="ok">{listing.seller.noShows} no-shows</span>
                </div>
              </div>
            </div>
          </div>

          {listing.note && (
            <div className="detail-section">
              <div className="detail-section-label">Seller's note</div>
              <div className="note-card">"{listing.note}"</div>
            </div>
          )}

          <div className="detail-section" style={{ paddingBottom: 24 }}>
            <div className="detail-section-label">Condition</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              <strong>{listing.cond === 'NM' ? 'Near Mint' : listing.cond === 'LP' ? 'Lightly Played' : 'Moderately Played'}</strong>
              <br/>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                {listing.cond === 'NM' ? 'Pack-fresh or close to it. Minimal handling marks if any.'
                  : listing.cond === 'LP' ? 'Light play wear. Edges and surface mostly clean.'
                  : 'Visible play wear, no creases or major damage.'}
              </span>
            </div>
          </div>
        </div>

        <div className="cta-bar">
          <button className="btn btn-secondary" onClick={() => setOfferOpen(true)}>Make offer</button>
          <button className="btn btn-primary" onClick={() => onBuyNow(listing)}>Buy at ₪{listing.price.toLocaleString()}</button>
        </div>
      </div>

      {offerOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setOfferOpen(false)} />
          <div className="sheet" data-screen-label="04b Make offer">
            <div className="sheet-grab" />
            <div className="sheet-body">
              <div className="sheet-header">
                <div>
                  <div className="sheet-title">Make an offer</div>
                  <div className="sheet-sub">Asking ₪{listing.price.toLocaleString()} · {listing.seller.name}</div>
                </div>
                <button className="sheet-close" onClick={() => setOfferOpen(false)}>✕</button>
              </div>

              <div className="offer-form">
                <div className={`offer-input-wrap ${focused ? 'focus' : ''}`}>
                  <span className="offer-input-currency">₪</span>
                  <input
                    type="number"
                    className="offer-input"
                    value={offerAmount}
                    autoFocus
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onChange={e => setOfferAmount(Number(e.target.value))}
                    style={{ width: `${String(offerAmount).length + 1}ch` }}
                  />
                </div>

                <div className="offer-asking">
                  {offerAmount < listing.price
                    ? <>That's <strong>{Math.round((1 - offerAmount/listing.price) * 100)}% under</strong> asking.</>
                    : offerAmount === listing.price
                    ? <span style={{ fontFamily: 'Fraunces', fontStyle: 'italic' }}>At asking — accepts the deal instantly.</span>
                    : <>Above asking. <span style={{ fontFamily: 'Fraunces', fontStyle: 'italic' }}>They'll probably take it.</span></>}
                </div>

                <div className="offer-quick">
                  {[0.85, 0.9, 0.95, 1].map(p => (
                    <button
                      key={p}
                      className="offer-quick-btn"
                      onClick={() => setOfferAmount(Math.round(listing.price * p))}
                    >
                      {p === 1 ? 'Full' : `${Math.round(p * 100)}%`}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="onb-label" style={{ marginBottom: 8 }}>Note (optional)</div>
                  <textarea
                    className="offer-note-input"
                    placeholder='e.g. "Slight whitening on back corner"'
                    value={offerNote}
                    onChange={e => setOfferNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="action-bar">
              <button className="btn btn-secondary" onClick={() => setOfferOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submit}>Send offer · ₪{Number(offerAmount).toLocaleString()}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

window.Listing = Listing;
