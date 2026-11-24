import React, { useCallback, useEffect, useState } from 'react';

export default function BalanceStatement({ client, rentalId, checkout }) {
  const [statement, setStatement] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const read = useCallback(async () => {
    const { data, error } = await client.rpc('rental_balance_statement', { p_rental_id: rentalId });
    if (error) throw error;
    return data;
  }, [client, rentalId]);
  useEffect(() => {
    let active = true;
    read().then(data => { if (active) setStatement(data); }, e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [read]);
  async function review(target) {
    setBusy(true); setError('');
    try {
      const fresh = await read();
      setStatement(fresh);
      if (target && fresh.statement === statement.statement && fresh.targets.some(t => t.id === target.id && t.amount === target.amount && t.type === target.type)) {
        await checkout(target);
      } else if (target && fresh.due > 0) setError('Your balance changed. Review the updated statement before paying.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="panel" aria-label="Rental balance statement">
    <h3>Your rental balance</h3>
    {statement && <pre style={{whiteSpace:'pre-wrap', overflowWrap:'anywhere'}}>{statement.statement}</pre>}
    {statement?.targets.map(target => <button className="primary-btn" type="button" key={target.id} disabled={busy} onClick={() => review(target)}>Pay {target.label} · ${Number(target.amount).toFixed(2)}</button>)}
    <button className="secondary-btn" type="button" disabled={busy} onClick={() => review()}>Refresh balance</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}
