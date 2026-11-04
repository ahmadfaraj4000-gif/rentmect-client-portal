import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowRight, CheckCircle2, LogOut, ShieldCheck, RefreshCw, Car, ExternalLink } from 'lucide-react';
import { merchantBookingStatus, merchantEmail, merchantSignInOptions } from './merchantWorkflow.js';
import MerchantDateRange from './MerchantDateRange.jsx';
import MerchantDialog from './MerchantDialog.jsx';
import SignaturePad from './MerchantSignaturePad.jsx';
import {LICENSE_STATES,licenseRule,normalizeLicense,validateLicense} from './merchantLicense.js';
const VehiclePhotos=lazy(()=>import('./MerchantVehiclePhotos.jsx'));
import logo from './assets/logo-sidebar.png';
import './merchant.css';

// Do not replace a customer's or RentMeCT administrator's browser session.
const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { storageKey: 'rentmect-merchant-session', storage: window.localStorage, detectSessionInUrl: true },
});
const dollars = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const due = (value) => value ? new Date(value).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET' : '—';
const initialCustomer = { fullName: '', email: '', phone: '', dateOfBirth: '', address: '', licenseNumber: '', licenseState: 'CT', licenseExpiresOn: '' };
const initialCoverage = { provider: '', policyNumber: '', namedInsured: '', startsOn: '', endsOn: '', liability: false, collision: false, rentalCovered: false };

async function invoke(name, body) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try { message = (await error.context?.json())?.error || message; } catch { /* keep transport message */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
async function rpc(name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

export default function MerchantPortal() {
  const slug = new URLSearchParams(window.location.search).get('merchant') || 'carcraft';
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [context, setContext] = useState(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [bookings, setBookings] = useState([]);
  const [view, setView] = useState('bookings');
  const [schedule, setSchedule] = useState({ pickupDate: '', pickupTime: '09:00', returnDate: '', returnTime: '09:00' });
  const [vehicles, setVehicles] = useState(null);
  const [vehicleId, setVehicleId] = useState('');
  const [customer, setCustomer] = useState(initialCustomer);
  const [coverage, setCoverage] = useState(initialCoverage);
  const [reference, setReference] = useState('');
  const [identityAttested, setIdentityAttested] = useState(false);
  const [ageConfirmation, setAgeConfirmation] = useState('');
  useEffect(() => { setAgeConfirmation(''); }, [customer.dateOfBirth, schedule.pickupDate]);
  const [termsAcknowledged, setTermsAcknowledged] = useState(false);
  const [createdId, setCreatedId] = useState('');
  const [paymentLink, setPaymentLink] = useState(null);
  const [availabilityState,setAvailabilityState]=useState('waiting');
  const [checkedAt,setCheckedAt]=useState(null);
  const [photoId,setPhotoId]=useState(null);
  const [agreement,setAgreement]=useState(null);
  const [signatureName,setSignatureName]=useState('');
  const [signatureImage,setSignatureImage]=useState('');
  const [signatureConsent,setSignatureConsent]=useState(false);
  const closePhotos=useCallback(()=>setPhotoId(null),[]);
  const closeAgreement=useCallback(()=>setAgreement(null),[]);
  const loadPhotos=useCallback((vehicleId)=>invoke('merchant-booking',{action:'vehicle_photos',slug,vehicleId}),[slug]);
  const requestId = useRef(crypto.randomUUID());
  const quoteGeneration = useRef(0);
  const actionLock = useRef(false);
  const selected = vehicles?.find((v) => v.id === vehicleId);

  async function run(action) {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error.message || 'Please try again.'); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function refresh() {
    const [nextContext, nextBookings] = await Promise.all([
      rpc('get_merchant_context', { p_slug: slug }), rpc('get_merchant_bookings', { p_slug: slug }),
    ]);
    setContext(nextContext); setBookings(nextBookings || []);
  }
  useEffect(() => {
    const { data: listener } = client.auth.onAuthStateChange((_event, value) => { setSession(value); setAuthLoading(false); });
    client.auth.getSession().then(({ data, error }) => { if (error) setMessage(error.message); setSession(data?.session || null); setAuthLoading(false); });
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    setContext(null); setBookings([]);
    if (!session?.user?.id) return;
    let active = true;
    const load = async () => {
      try {
        const [next, rows] = await Promise.all([rpc('get_merchant_context', { p_slug: slug }), rpc('get_merchant_bookings', { p_slug: slug })]);
        if (active) { setContext(next); setBookings(rows || []); }
      } catch (error) { if (active) { setContext(null); setBookings([]); setMessage(error.message); } }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    window.addEventListener('focus',load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus',load); };
  }, [session?.user?.id, slug]);

  const loadAvailability=useCallback(async()=>{
    const generation=++quoteGeneration.current;
    if(!navigator.onLine){setAvailabilityState('error');return;}
    setAvailabilityState('checking');
    try{
      const result=await invoke('merchant-booking',{action:'availability',slug,...schedule});
      if(generation!==quoteGeneration.current)return;
      setVehicles(result.vehicles||[]);setAvailabilityState('live');setCheckedAt(new Date());
      setVehicleId(id=>result.vehicles?.some(v=>v.id===id&&v.available)?id:'');
    }catch(error){if(generation===quoteGeneration.current){setAvailabilityState('error');setMessage(error.message);}}
  },[slug,schedule]);
  useEffect(()=>{
    if(!session?.user?.id||!context||view!=='new'||Object.values(schedule).some(v=>!v))return;
    let debounce;
    const refreshSoon=()=>{clearTimeout(debounce);debounce=setTimeout(loadAvailability,250);};
    const offline=()=>{quoteGeneration.current++;setAvailabilityState('error');};
    void loadAvailability();
    const channel=client.channel('merchant-fleet').on('broadcast',{event:'availability_changed'},refreshSoon).subscribe();
    const timer=setInterval(loadAvailability,15000);
    window.addEventListener('focus',refreshSoon);window.addEventListener('online',refreshSoon);window.addEventListener('offline',offline);
    return()=>{quoteGeneration.current++;clearTimeout(debounce);clearInterval(timer);void client.removeChannel(channel);window.removeEventListener('focus',refreshSoon);window.removeEventListener('online',refreshSoon);window.removeEventListener('offline',offline);};
  },[session?.user?.id,!!context,view,loadAvailability]);
  useEffect(()=>{if(paymentLink&&bookings.some(b=>b.id===paymentLink.id&&b.payment_status==='paid'))setPaymentLink(null);},[bookings,paymentLink]);
  async function reviewAgreement(id){
    const result=await invoke('merchant-booking',{action:'agreement_preview',slug,rentalId:id});
    setAgreement(result.agreement);setSignatureName('');setSignatureImage('');setSignatureConsent(false);
  }
  async function downloadReservation(id){
    const result=await invoke('merchant-booking',{action:'reservation',slug,rentalId:id});
    const {downloadReservationPdf}=await import('./merchantReservationPdf.js');
    await downloadReservationPdf(result.reservation);
  }
  function typedSignature(){
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=220;
    const ctx=canvas.getContext('2d');ctx.font='italic 42px Georgia';ctx.fillStyle='#172033';ctx.fillText(signatureName.trim(),24,125,670);setSignatureImage(canvas.toDataURL('image/png'));
  }
  function changeSchedule(key, value) {
    quoteGeneration.current += 1;
    setSchedule({ ...schedule, [key]: value }); setVehicles(null); setVehicleId(''); setAvailabilityState('waiting');
  }
  function newBooking() {
    setView('new'); setCreatedId(''); setPaymentLink(null); setMessage('');
    setCustomer({ ...initialCustomer }); setCoverage({ ...initialCoverage }); setReference('');
    setAgeConfirmation(''); setIdentityAttested(false); setTermsAcknowledged(false); setVehicles(null); setVehicleId('');
    requestId.current = crypto.randomUUID();
  }
  async function pay(id) {
    const result = await invoke('stripe-web-hook', { action: 'merchant_create_checkout', rentalId: id });
    const link = new URL(result.url);
    if (link.protocol !== 'https:' || link.hostname !== 'checkout.stripe.com') throw new Error('A secure Stripe payment link was not returned. Contact Rent Me CT.');
    setPaymentLink({ id, url: link.href });
  }
  async function create(event) {
    event.preventDefault();
    await run(async () => {
      if(availabilityState!=='live'||!selected?.available)throw new Error('Wait for current availability before reserving.');
      if(ageConfirmation!=='yes')throw new Error('Confirm that the customer is 25 years or older at pickup.');
      validateLicense(customer.licenseState,customer.licenseNumber);
      const { rental } = await invoke('merchant-booking', {
        action: 'create_booking', slug, ...schedule, vehicleId, customer, coverage,
        ageConfirmed: ageConfirmation === 'yes', identityAttested, termsAcknowledged, reference, requestId: requestId.current,
        expectedTotal: selected?.quote.total_due_today,
      });
      setCreatedId(rental.id); setView('bookings');
      setCustomer({ ...initialCustomer }); setCoverage({ ...initialCoverage });
      await refresh();
      await reviewAgreement(rental.id);
    });
  }

  return <div className="merchant-shell">
    <header className="merchant-header"><a href="https://rentmect.com" aria-label="Rent Me CT home"><img src={logo} alt="Rent Me CT" /></a><span>Partner reservations</span>
      {session && <button className="merchant-quiet" onClick={() => run(async () => { await client.auth.signOut({ scope: 'local' }); setPaymentLink(null); setCustomer({ ...initialCustomer }); setCoverage({ ...initialCoverage }); })}><LogOut size={16} /> Sign out</button>}
    </header>
    <main className="merchant-main">
      {authLoading ? <p role="status">Loading secure sign-in…</p> : !session ? <section className="merchant-login merchant-card">
        <div className="merchant-icon"><ShieldCheck size={25} /></div><p className="merchant-kicker">RENT ME CT · MERCHANT ACCESS</p><h1>One less thing<br />between them and the road.</h1>
        <p>Enter the email address approved for your merchant account. We’ll send you a secure sign-in link.</p>
        <form onSubmit={(event) => { event.preventDefault(); run(async () => {
          const normalized = merchantEmail(email);
          if (sent) {
            const { error } = await client.auth.verifyOtp({ email: normalized, token: code.trim(), type: 'email' });
            if (error) throw error;
          } else {
            const { error } = await client.auth.signInWithOtp({ email: normalized, options: merchantSignInOptions(window.location.href, slug) });
            if (error) throw error;
            setEmail(normalized); setSent(true);
            setMessage(`Check ${normalized} for your sign-in email. Open its link, or enter the one-time code below if your email includes one.`);
          }
        }); }}>
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={sent || busy} placeholder="you@company.com" /></label>
          {sent && <label>Email code (if included)<input autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required /></label>}
          <button className="merchant-primary" disabled={busy}>{busy ? 'Please wait…' : sent ? 'Verify email code' : 'Email me a sign-in link'}<ArrowRight size={18} /></button>
          {sent && <button className="merchant-quiet" type="button" disabled={busy} onClick={() => { setSent(false); setCode(''); }}>Change email / send another link</button>}
        </form><small>Merchant accounts are created only by direct arrangement with Rent Me CT’s owner. There is no self-signup.</small>
      </section> : context ? <>
        <div className="merchant-title"><div><p className="merchant-kicker">{context.name} × RENT ME CT</p><h1>Keep your customers moving.</h1><p>Reserve here. Your customer completes documents on their phone.</p></div>
          <button className="merchant-primary" disabled={busy || !context.bookings_enabled} onClick={newBooking}>New reservation <ArrowRight size={18} /></button></div>
        {!context.bookings_enabled && <div className="merchant-notice">New bookings are paused while Rent Me CT prepares your account. You can still review existing reservations.</div>}
        <nav className="merchant-tabs" aria-label="Merchant workspace"><button className={view === 'bookings' ? 'active' : ''} onClick={() => setView('bookings')}>Reservations <span>{bookings.length}</span></button><button className={view === 'new' ? 'active' : ''} disabled={!context.bookings_enabled} onClick={() => setView('new')}>Book a vehicle</button><button disabled={busy} onClick={() => run(refresh)}><RefreshCw size={15} /> Refresh</button></nav>
        {createdId && <div className="merchant-notice"><CheckCircle2 size={20} /><span>{bookings.some(b=>b.id===createdId&&b.payment_status==='paid')?'Reservation secured. Download the reservation PDF and give the customer their document upload link below.':'Reservation hold created. Sign the agreement and complete payment before the hold expires to secure the vehicle.'}</span></div>}
        {paymentLink && <section className="merchant-card merchant-payment"><h2>Collect payment securely</h2><p>Payment goes directly to Rent Me CT. Send this Stripe link to the customer or open it with them present.</p><div className="merchant-actions"><a className="merchant-primary" href={paymentLink.url} target="_blank" rel="noopener noreferrer">Open Stripe payment <ExternalLink size={16} /></a><button onClick={() => run(async () => { await navigator.clipboard.writeText(paymentLink.url); setMessage('Payment link copied.'); })}>Copy payment link</button></div><small>The signed agreement is saved with the rental. Payment secures the reservation; document approval, coverage review and phone verification remain required before pickup.</small></section>}
        {view === 'bookings' ? <section className="merchant-bookings">
          {!bookings.length && <div className="merchant-card merchant-empty"><Car size={36} /><h2>Your first reservation starts here.</h2><p>Choose dates, enter the customer’s details, and collect payment. We handle the document follow-up.</p></div>}
          {bookings.map((booking) => <article className="merchant-card" key={booking.id}><div className="merchant-row"><div><p className="merchant-kicker">{booking.merchant_reservation_number || booking.id.slice(0, 8).toUpperCase()} {booking.reference && `· ${booking.reference}`}</p><h2>{booking.customer_name}</h2><p>{booking.vehicle_name}</p></div><strong className="merchant-status">{merchantBookingStatus(booking)}</strong></div>
            <div className="merchant-facts"><div><small>Pickup · Eastern time</small><strong>{booking.pickup_date} · {booking.pickup_time}</strong></div><div><small>Return · Eastern time</small><strong>{booking.return_date} · {booking.return_time}</strong></div><div><small>Total including deposit</small><strong>{dollars(booking.total)}</strong></div></div>
            {booking.payment_status === 'paid' ? <><p>License: {booking.license_approved ? 'Approved' : 'Pending'} · Insurance: {booking.insurance_approved ? 'Approved' : 'Pending'} · Agreement: {booking.agreement_signed ? 'Signed' : 'Pending'}</p><small>Documents due: {due(booking.merchant_documents_due_at)} · Email: {booking.delivery_status || 'Not queued'}</small>
              {!['completed', 'cancelled', 'active', 'rented', 'overdue', 'return_initiated', 'ready_for_pickup'].includes(booking.status) && <div className="merchant-actions"><button disabled={busy} onClick={() => run(async () => { await rpc('merchant_resend_document_request', { p_rental_id: booking.id, p_slug: slug }); setMessage('Customer completion email queued.'); await refresh(); })}>Resend customer link</button><button disabled={busy} onClick={() => run(async () => { await navigator.clipboard.writeText(`${window.location.origin}/?adminRental=${booking.id}`); setMessage('Completion link copied. The customer must sign in with their booking email.'); })}>Copy completion link</button></div>}</>
              : <><small>Payment deadline: {due(booking.payment_due_at || booking.checkout_expires_at)}</small>{merchantBookingStatus(booking) === 'Awaiting payment' && <div className="merchant-actions"><button disabled={busy || !context.bookings_enabled} onClick={() => run(() => booking.agreement_signed ? pay(booking.id) : reviewAgreement(booking.id))}>{booking.agreement_signed ? 'Collect payment' : 'Review & sign agreement'}</button></div>}</>}
            <div className="merchant-actions"><button disabled={busy} onClick={()=>run(()=>downloadReservation(booking.id))}>Download reservation PDF</button><button disabled={busy} onClick={()=>run(async()=>{await navigator.clipboard.writeText(`${window.location.origin}/?adminRental=${booking.id}&merchantDocuments=1`);setMessage('Customer upload link copied. They must sign in with their booking email to upload their license and insurance declaration page.');})}>Copy document upload link</button>{booking.agreement_signed&&<button disabled={busy} onClick={()=>run(()=>reviewAgreement(booking.id))}>View signed agreement</button>}</div>
          </article>)}
        </section> : <form className="merchant-form" onSubmit={create}>
          <section className="merchant-card"><p className="merchant-kicker">01 · VEHICLE & DATES</p><h2>Find the right car.</h2><p>All times are Eastern. Availability includes Rent Me CT’s three-hour turnaround.</p><div className="merchant-fields">
            <MerchantDateRange schedule={schedule} onChange={dates=>{quoteGeneration.current++;setSchedule({...schedule,...dates});setVehicles(null);setVehicleId('');setAvailabilityState('waiting');}} />
            {Object.entries({pickupTime:'Pickup time',returnTime:'Drop-off time'}).map(([key,label])=><label key={key}>{label}<input type="time" value={schedule[key]} required onChange={e=>changeSchedule(key,e.target.value)}/></label>)}
          </div><div className="merchant-row"><p role="status">{availabilityState==='live'?`Availability updated ${checkedAt?.toLocaleTimeString()}. Updates automatically.`:availabilityState==='checking'?'Checking current availability…':availabilityState==='error'?'Availability could not be verified. Reconnect or refresh before reserving.':'Choose pickup and drop-off dates to see availability.'}</p><button type="button" disabled={busy||availabilityState==='checking'||Object.values(schedule).some(v=>!v)} onClick={()=>void loadAvailability()}>Refresh availability</button></div>
          {vehicles&&<div className="merchant-vehicles">{!vehicles.length&&<p>No vehicles are listed for this schedule.</p>}{vehicles.map(v=><article className={`merchant-vehicle ${vehicleId===v.id?'selected':''}`} key={v.id}><label><input type="radio" name="vehicle" checked={vehicleId===v.id} disabled={!v.available||availabilityState!=='live'} onChange={()=>setVehicleId(v.id)}/><span><strong>{v.name}</strong><small className={v.available?'merchant-available':'merchant-unavailable'}>{v.available?'Available for your dates':'Unavailable for your dates'}</small>{!v.available&&<small>{v.reason||'Choose another vehicle or schedule.'}</small>}<small>{v.quote.billable_days} rental days · {dollars(v.quote.security_deposit)} refundable deposit</small></span><strong>{dollars(v.quote.total_due_today)}</strong></label><button type="button" onClick={()=>setPhotoId(v.id)}>View car pictures</button></article>)}</div>}
          </section>
          <section className="merchant-card"><p className="merchant-kicker">02 · CUSTOMER & LICENSE</p><h2>Check the original license in person.</h2><p>For this pilot, customers must be 25 or older at pickup. No document upload is needed at your desk.</p><div className="merchant-fields">
            {Object.entries({fullName:'Full legal name',email:'Customer email',phone:'Customer mobile',dateOfBirth:'Date of birth',address:'Renter address',licenseExpiresOn:'License expiration'}).map(([key,label])=><label key={key}>{label}<input type={key==='dateOfBirth'||key==='licenseExpiresOn'?'date':key==='email'?'email':key==='phone'?'tel':'text'} autoComplete="off" value={customer[key]} required maxLength={key==='address'?300:254} onChange={e=>setCustomer({...customer,[key]:e.target.value})}/></label>)}
            <label>License issuing state<select value={customer.licenseState} onChange={e=>setCustomer({...customer,licenseState:e.target.value,licenseNumber:''})}>{LICENSE_STATES.map(state=><option key={state}>{state}</option>)}</select></label><label>Driver’s license number<input required autoComplete="off" value={customer.licenseNumber} maxLength={licenseRule(customer.licenseState).maxLength} pattern={licenseRule(customer.licenseState).pattern} title={licenseRule(customer.licenseState).hint} onPaste={event=>{event.preventDefault();const number=normalizeLicense(event.clipboardData.getData('text'));if(number.length>licenseRule(customer.licenseState).maxLength){setMessage('The pasted license number is too long for the selected state. Check the original license.');return;}setCustomer({...customer,licenseNumber:number});}} onChange={e=>setCustomer({...customer,licenseNumber:normalizeLicense(e.target.value)})}/><small>{licenseRule(customer.licenseState).hint}. This checks format; inspect the original license.</small></label>
          </div><label>Is the customer 25 years or older at pickup?<select required value={ageConfirmation} onChange={event=>setAgeConfirmation(event.target.value)}><option value="">Select an answer</option><option value="yes">Yes — 25 or older</option><option value="no">No — under 25</option></select><small>Confirm the birth date on the original driver’s license.</small></label>{ageConfirmation==='no'&&<p className="merchant-notice" role="alert">Customers under 25 cannot be booked through the merchant portal. Contact Rent Me CT for assistance.</p>}<label className="merchant-check"><input type="checkbox" checked={identityAttested} required onChange={(e) => setIdentityAttested(e.target.checked)} /><span>I inspected the original license, matched its photo to the person present, and checked the legal name, birth date, number and expiration.</span></label></section>
          <section className="merchant-card"><p className="merchant-kicker">03 · COVERAGE</p><h2>Record the customer’s insurance.</h2><div className="merchant-fields">
            {Object.entries({ provider: 'Insurance company', policyNumber: 'Policy number', namedInsured: 'Named insured', startsOn: 'Coverage effective date', endsOn: 'Coverage expiration' }).map(([key, label]) => <label key={key}>{label}<input type={key.endsWith('On') ? 'date' : 'text'} autoComplete="off" value={coverage[key]} required maxLength={120} onChange={(e) => setCoverage({ ...coverage, [key]: e.target.value })} /></label>)}
          </div>{Object.entries({ liability: 'Liability coverage confirmed', collision: 'Collision coverage confirmed', rentalCovered: 'Coverage applies to this rental and the full scheduled period' }).map(([key, label]) => <label className="merchant-check" key={key}><input type="checkbox" required checked={coverage[key]} onChange={(e) => setCoverage({ ...coverage, [key]: e.target.checked })} /><span>{label}</span></label>)}<small>If coverage is unknown or insufficient, contact Rent Me CT before taking payment.</small></section>
          <section className="merchant-card"><p className="merchant-kicker">04 · REVIEW & RESERVE</p><h2>{selected ? `${selected.name} · ${dollars(selected.quote.total_due_today)}` : 'Select an available vehicle above.'}</h2>{selected && <p>Rental {dollars(selected.quote.base_rental_total)} + tax {dollars(selected.quote.tax_amount)} + refundable deposit {dollars(selected.quote.security_deposit)}.</p>}
            <label>CarCraft reference (optional)<input value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} /></label>
            <p>After payment, we email the customer their secure completion link. They must upload their driver’s license and insurance declaration page within 24 hours or before pickup, whichever is earlier. The customer reviews and signs the rental agreement next, before payment. Rent Me CT must approve documents before releasing the car.</p>
            <label className="merchant-check"><input type="checkbox" required checked={termsAcknowledged} onChange={(e) => setTermsAcknowledged(e.target.checked)} /><span>I explained the total, refundable deposit, document deadline and <a href="https://rentmect.com/rental-policies.html" target="_blank" rel="noopener noreferrer">rental and cancellation terms</a> to the customer. The customer agreed to proceed.</span></label>
            <button className="merchant-primary" type="submit" disabled={busy || ageConfirmation!=='yes' || !selected?.available || availabilityState!=='live' || !context.bookings_enabled}>{busy ? 'Saving…' : 'Continue to rental agreement'}<ArrowRight size={18} /></button>
          </section>
        </form>}
      </> : <section className="merchant-card"><h1>Checking merchant access</h1><p>If your email has not been approved, contact Rent Me CT. An existing customer account does not grant merchant access.</p></section>}
      {message && <div className="merchant-message" role="alert">{message}</div>}
      {photoId&&<Suspense fallback={<div className="merchant-message" role="status">Loading photo viewer…</div>}><VehiclePhotos vehicleId={photoId} load={loadPhotos} onClose={closePhotos}/></Suspense>}
      {agreement&&<MerchantDialog title={agreement.signed?'Signed rental agreement':'Customer review & signature'} onClose={closeAgreement}><p>The customer must read and sign their own agreement. Hand them the keyboard or mouse to complete this step.</p><pre className="merchant-agreement-text">{agreement.signed?(agreement.saved_snapshot||'').replace(/Drawn Signature Image: [^\n]+/,'[Signature attached to rental]'):agreement.snapshot}</pre>{message&&<div className="merchant-notice" role="alert">{message}</div>}{!agreement.signed&&<form onSubmit={event=>{event.preventDefault();run(async()=>{
        if(!signatureImage||!signatureConsent)throw new Error('The customer must add their signature and consent.');
        await invoke('merchant-booking',{action:'sign_agreement',slug,rentalId:agreement.rental_id,signature:{name:signatureName,image:signatureImage,consent:signatureConsent,customerPresent:true,reviewHash:agreement.review_hash}});
        const id=agreement.rental_id;setAgreement(null);await refresh();await pay(id);
      });}}><label>Customer’s full legal name<input required maxLength={160} autoComplete="off" value={signatureName} onChange={e=>{setSignatureName(e.target.value);setSignatureImage('');}}/></label><button type="button" disabled={!signatureName.trim()||busy} onClick={typedSignature}>Use my typed signature</button><SignaturePad value={signatureImage} onChange={setSignatureImage} disabled={busy}/><label className="merchant-check"><input type="checkbox" required checked={signatureConsent} onChange={e=>setSignatureConsent(e.target.checked)}/><span>I am the named renter, present at the merchant. I have reviewed the rental details and full agreement, agree to its terms, and consent to signing electronically.</span></label><button className="merchant-primary" disabled={busy||!signatureConsent||!signatureImage}>Sign agreement & prepare Stripe payment</button></form>}</MerchantDialog>}
    </main><footer className="merchant-footer"><ShieldCheck size={16} /> Payments and rental approval are managed by Rent Me CT. <a href="https://rentmect.com/contact.html">Contact support</a></footer>
  </div>;
}
