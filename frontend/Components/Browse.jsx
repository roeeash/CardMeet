// CardMeet — Browse screen

const { useState: useStateBrw, useMemo: useMemoBrw } = React;

const IMG_VARIANTS = ['mtg-1', 'mtg-2', 'mtg-3', 'mtg-4', 'mtg-5', 'pkm-1', 'pkm-2'];

function Browse({ onOpenListing }) {
  const [filter, setFilter] = useStateBrw('shared');
  const [query, setQuery] = useStateBrw('');
  const all = window.LISTINGS_SEED;

  const filtered = useMemoBrw(() => {
    let list = all;
    if (filter === 'shared') list = list.filter(l => l.sharedCon);
    else if (filter === 'mtg') list = list.filter(l => l.game === 'MTG');
    else if (filter === 'pokemon') list = list.filter(l => l.game === 'Pokémon');
    else if (filter === 'under') list = list.filter(l => l.price < 200);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(l => l.cardName.toLowerCase().includes(q) || l.set.toLowerCase().includes(q));
    }
    return list;
  }, [filter, query]);

  const imgFor = (l, i) => {
    if (l.game === 'Pokémon') return i % 2 === 0 ? 'pkm-1' : 'pkm-2';
    return IMG_VARIANTS[i % 5];
  };

  return (
    <div className="screen" data-screen-label="03 Browse">
      <div className="app-header">
        <div className="app-title-row">
          <div>
            <div className="app-title">Browse</div>
            <div className="app-sub">
              <strong style={{ color: 'var(--ink)' }}>{filtered.length}</strong>
              <span style={{ fontStyle: 'italic', fontFamily: 'Fraunces' }}> listings — sorted by shared con first</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
        <div className="search-bar">
          <span>🔎</span>
          <input
            placeholder="Search a card, set, or seller…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="browse-filters">
          <button className={`filter-chip ${filter === 'shared' ? 'active' : ''}`} onClick={() => setFilter('shared')}>📅 Shared con</button>
          <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`filter-chip ${filter === 'mtg' ? 'active' : ''}`} onClick={() => setFilter('mtg')}>MTG</button>
          <button className={`filter-chip ${filter === 'pokemon' ? 'active' : ''}`} onClick={() => setFilter('pokemon')}>Pokémon</button>
          <button className={`filter-chip ${filter === 'under' ? 'active' : ''}`} onClick={() => setFilter('under')}>Under ₪200</button>
        </div>

        {filtered.length === 0 && (
          <div className="empty">
            <div className="empty-mark" />
            <div className="empty-title">No matches.</div>
            <div className="empty-body">Try a different filter or clear the search.</div>
          </div>
        )}

        <div style={{ paddingBottom: 24 }}>
          {filtered.map((l, i) => (
            <div key={l.id} className="listing-card" onClick={() => onOpenListing(l.id)}>
              <div className={`listing-img ${imgFor(l, i)}`}>{l.cardName.split(' ')[0].toUpperCase()}</div>
              <div className="listing-meta">
                <div className="listing-name">{l.cardName}</div>
                <div className="listing-set">{l.set} · {l.cond}</div>
                <div className="listing-price">₪{l.price.toLocaleString()}</div>
                {l.sharedCon
                  ? <div className="listing-tag">📅 Both @ {l.sharedCon.toUpperCase()}</div>
                  : <div className="listing-tag muted">— No shared con</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.Browse = Browse;
