import React, { useCallback, useEffect, useRef, useState } from 'react';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function BalanceStatement({ client, rentalId, rental, checkout, revision = 0, confirming = false }) {
  const [statement, setStatement] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const read = useCallback(async () => {
    const { data, error } = await client.rpc('rental_balance_statement', { p_rental_id: rentalId });
    if (error) throw error;
    if (!data || data.due == null || !Number.isFinite(Number(data.due)) || !Array.isArray(data.targets)) {
      throw Error('Your balance could not be loaded. Please refresh your balance.');
    }
    return data;
  }, [client, rentalId]);
  useEffect(() => {
    let active = true;
    setError('');
    read().then(data => { if (active) setStatement(data); }, e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [read, confirming, revision]);
  async function review(target) {
    if (inFlight.current || confirming) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      const fresh = await read();
      setStatement(fresh);
      if (target && fresh.statement === statement.statement && fresh.targets.some(t => t.id === target.id && t.amount === target.amount && t.type === target.type)) {
        await checkout(target, rentalId);
      } else if (target && fresh.due > 0) setError('Your balance changed. Review the updated statement before paying.');
    } catch (e) { setError(e.message || 'Unable to open payment. Please try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="panel customer-balance" aria-label="Rental balance statement">
    <h3>{rental?.vehicles?.name || 'Your rental balance'}</h3>
    {rental && <p>{rental.pickup_date} – {rental.return_date}</p>}
    {confirming && <p role="status">Checking your Stripe payment…</p>}
    {!statement && !error && !confirming && <p role="status">Loading your balance…</p>}
    {statement && <>
      <p><strong>{Number(statement.due) > 0 ? 'Balance due' : 'Paid in full'} · {currency.format(statement.due)}</strong></p>
      <details open={Number(statement.due) > 0}><summary>Itemized statement</summary>
        <pre style={{whiteSpace:'pre-wrap', overflowWrap:'anywhere', fontFamily:'inherit'}}>{statement.statement}</pre>
      </details>
      {statement.targets.filter(target => Number(target.amount) >= 0.50).map(target => <button className="primary-btn" type="button" key={target.id} disabled={busy || confirming} onClick={() => review(target)}>Pay {target.label} · {currency.format(target.amount)} with Stripe</button>)}
      {statement.targets.some(target => Number(target.amount) > 0 && Number(target.amount) < 0.50) && <p>For an item under $0.50, contact Rent Me CT to settle it.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
    <button className="secondary-btn" type="button" disabled={busy || confirming} onClick={() => review()}>Refresh balance</button>
  </section>;
}
