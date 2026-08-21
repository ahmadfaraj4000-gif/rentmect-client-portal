import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Car, CheckCircle2, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { supabase } from './supabaseClient';
import { withRequestDeadline } from './requestDeadline';
import logoMobileUrl from './assets/logo-mobile.png';
import FLEET_GALLERY_IMAGES from './fleetGalleryImages';
import './booking-preview-fleet.css';

const TEST_VEHICLE_ID = '00000000-0000-4000-8000-000000000015';
const TEST_VEHICLE_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_BOOKING_FLOW_TEST === 'true';
const BOOKING_DEVICE_STORAGE_KEY = 'rentmect_booking_device';
const PUBLIC_ASSET_BASE = (import.meta.env.VITE_PUBLIC_FLEET_ASSET_BASE_URL || 'https://rentmect.com/assets').replace(/\/$/, '');
const FALLBACK_IMAGE = `${PUBLIC_ASSET_BASE}/Benz-CLS-AMG-550-224.webp`;
const TIME_OPTIONS = Array.from({ length: 30 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 && hour < 24 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
});

function dateInput(offsetDays = 0) {
  const eastern = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(eastern.year), Number(eastern.month) - 1, Number(eastern.day) + offsetDays, 12));
  return date.toISOString().slice(0, 10);
}

function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // Newline and comma-separated legacy values are handled below.
  }
  return String(value).split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function vehicleImages(vehicle) {
  const uploaded = list(vehicle?.image_urls);
  if (TEST_VEHICLE_ENABLED && vehicle?.id === TEST_VEHICLE_ID) {
    return [FALLBACK_IMAGE, ...FLEET_GALLERY_IMAGES['224']];
  }
  const normalized = String(vehicle?.name || '')
    .replace(/Mercedes[- ]Benz/i, 'Mercedes-Benz')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const fleet = String(vehicle?.name || '').match(/#([a-z0-9]+)/i)?.[1]?.toUpperCase() || '';
  const primary = uploaded[0] || (normalized ? `${PUBLIC_ASSET_BASE}/${normalized}.webp` : FALLBACK_IMAGE);
  const supporting = FLEET_GALLERY_IMAGES[fleet] || uploaded.slice(1);
  return [...new Set([primary, ...supporting].filter(Boolean))].slice(0, 5);
}

function money(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function bookingDeviceId() {
  try {
    const saved = localStorage.getItem(BOOKING_DEVICE_STORAGE_KEY) || '';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)) return saved;
  } catch {
    // Storage can be unavailable in strict private-browsing modes.
  }

  const created = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (character) => (
      Number(character) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(character) / 4)))
    ).toString(16));
  try {
    localStorage.setItem(BOOKING_DEVICE_STORAGE_KEY, created);
  } catch {
    // The generated id remains valid for this request.
  }
  return created;
}

function tripDateTime(dateValue, timeValue) {
  const dateMatch = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const match = String(timeValue || '').match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!dateMatch || !match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3] === 'PM') hour += 12;
  const targetWallClock = Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), hour, Number(match[2]), 0);
  let instant = targetWallClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const eastern = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(instant)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    const observedWallClock = Date.UTC(Number(eastern.year), Number(eastern.month) - 1, Number(eastern.day), Number(eastern.hour), Number(eastern.minute), Number(eastern.second));
    instant += targetWallClock - observedWallClock;
  }
  const value = new Date(instant);
  return Number.isFinite(value.getTime()) ? value : null;
}

function rentalMinutes(trip) {
  const start = tripDateTime(trip.pickupDate, trip.pickupTime);
  const end = tripDateTime(trip.returnDate, trip.returnTime);
  return start && end ? Math.max(0, Math.floor((end - start) / 60000)) : 0;
}

function rentalDays(trip) {
  const minutes = rentalMinutes(trip);
  return minutes > 0 ? Math.ceil(minutes / 1440) : 0;
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function BookingPreviewFleet() {
  const url = new URL(window.location.href);
  const [trip, setTrip] = useState({
    pickupDate: url.searchParams.get('pickupDate') || dateInput(0),
    returnDate: url.searchParams.get('returnDate') || dateInput(1),
    pickupTime: url.searchParams.get('pickupTime') || '9:00 AM',
    returnTime: url.searchParams.get('returnTime') || '9:00 AM',
  });
  const [vehicles, setVehicles] = useState([]);
  const [availability, setAvailability] = useState(new Map());
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState({ minimum_rental_days: 1, minimum_rental_hours: 24, advance_notice_minutes: 0 });
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    setTrip((current) => {
      const minimumMinutes = Math.max(1, Number(policy.minimum_rental_days || 1)) * 1440;
      if (rentalMinutes(current) >= minimumMinutes) return current;
      return {
        ...current,
        returnDate: addDays(current.pickupDate, Number(policy.minimum_rental_days || 1)),
        returnTime: current.pickupTime,
      };
    });
  }, [policy.minimum_rental_days]);

  useEffect(() => {
    let active = true;
    async function loadVehicles() {
      let query = supabase.from('vehicles').select('*');
      query = TEST_VEHICLE_ENABLED
        ? query.or(`published.eq.true,id.eq.${TEST_VEHICLE_ID}`)
        : query.eq('published', true);
      const [policyResult, vehicleResult] = await Promise.all([
        withRequestDeadline(supabase.rpc('get_public_booking_policy'), 'Booking rules'),
        withRequestDeadline(query.order('daily_rate', { ascending: true }), 'Fleet'),
      ]);
      const { data: policyRows } = policyResult;
      if (active && policyRows?.[0]) setPolicy(policyRows[0]);
      const { data, error: loadError } = vehicleResult;
      if (!active) return;
      if (loadError) setError(previewError(loadError, 'The fleet could not load. Refresh the page to try again.'));
      else setVehicles(data || []);
      setLoading(false);
    }
    loadVehicles();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!trip.pickupDate || !trip.returnDate) {
      setAvailability(new Map());
      setChecking(false);
      return;
    }
    let active = true;
    setChecking(true);
    const timer = window.setTimeout(async () => {
      const { data: bookingQuote, error: quoteError } = await withRequestDeadline(supabase.rpc('get_booking_quote', {
        p_vehicle_id: null,
        p_pickup_date: trip.pickupDate,
        p_pickup_time: trip.pickupTime,
        p_return_date: trip.returnDate,
        p_return_time: trip.returnTime,
      }), 'Booking quote');
      if (!active) return;
      setQuote(bookingQuote || null);
      if (quoteError || !bookingQuote?.valid) {
        setError(previewError(quoteError, bookingQuote?.error || 'These pickup and return times are not allowed.'));
        setAvailability(new Map());
        setChecking(false);
        return;
      }
      const { data, error: availabilityError } = await withRequestDeadline(supabase.rpc('get_admin_calendar_fleet_availability', {
        p_pickup_date: trip.pickupDate,
        p_pickup_time: trip.pickupTime,
        p_return_date: trip.returnDate,
        p_return_time: trip.returnTime,
      }), 'Availability');
      if (!active) return;
      if (availabilityError) {
        setError(previewError(availabilityError, 'Live availability could not be verified. Please try again.'));
        setAvailability(new Map());
      } else {
        setError('');
        const nextAvailability = new Map((data || []).map((item) => [item.vehicle_id, item]));
        if (TEST_VEHICLE_ENABLED) {
          nextAvailability.set(TEST_VEHICLE_ID, {
            vehicle_id: TEST_VEHICLE_ID,
            available: true,
            reason: 'Internal test lane',
          });
        }
        setAvailability(nextAvailability);
      }
      setChecking(false);
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [trip]);

  const brands = useMemo(() => [...new Set(vehicles.map((vehicle) => vehicle.brand).filter(Boolean))].sort(), [vehicles]);
  const visibleVehicles = useMemo(() => vehicles.filter((vehicle) => {
    const result = availability.get(vehicle.id);
    const terms = `${vehicle.name || ''} ${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.vehicle_type || ''}`.toLowerCase();
    const filterMatch = filter === 'all' || String(vehicle.brand || '').toLowerCase() === filter || String(vehicle.vehicle_type || '').toLowerCase().includes(filter);
    return filterMatch && terms.includes(search.trim().toLowerCase()) && (!availableOnly || result?.available === true);
  }), [vehicles, availability, filter, search, availableOnly]);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedId);
  const selectedAvailability = selectedVehicle ? availability.get(selectedVehicle.id) : null;
  const days = quote?.valid ? Number(quote.billable_days || 0) : rentalDays(trip);

  function updateTrip(key, value) {
    setTrip((current) => {
      const next = { ...current, [key]: value };
      const minimumMinutes = Math.max(1, Number(policy.minimum_rental_days || 1)) * 1440;
      if ((key === 'pickupDate' || key === 'pickupTime') && rentalMinutes(next) < minimumMinutes) {
        next.returnDate = addDays(next.pickupDate, Number(policy.minimum_rental_days || 1));
        next.returnTime = next.pickupTime;
      }
      return next;
    });
  }

  async function startBooking() {
    if (!selectedVehicle || selectedAvailability?.available !== true) return;
    setStarting(true);
    setError('');
    const { data: finalQuote, error: finalQuoteError } = await withRequestDeadline(supabase.rpc('get_booking_quote', {
      p_vehicle_id: selectedVehicle.id,
      p_pickup_date: trip.pickupDate,
      p_pickup_time: trip.pickupTime,
      p_return_date: trip.returnDate,
      p_return_time: trip.returnTime,
    }), 'Booking quote');
    if (finalQuoteError || !finalQuote?.valid) {
      setError(previewError(finalQuoteError, finalQuote?.error || 'These pickup and return times are not allowed.'));
      setStarting(false);
      return;
    }
    const { data: protectedHold, error: bookingError } = await withRequestDeadline(supabase.functions.invoke('website-booking-hold', {
      headers: { 'X-RentMe-Device': bookingDeviceId() },
      body: {
        pickup_date: trip.pickupDate,
        return_date: trip.returnDate,
        pickup_time: trip.pickupTime,
        return_time: trip.returnTime,
        vehicle_id: selectedVehicle.id,
      },
    }), 'Checkout');
    const bookingId = protectedHold?.booking_id || '';
    if (bookingError || !bookingId) {
      setError(previewError(bookingError, 'The checkout session could not be created. Please retry.'));
      setStarting(false);
      return;
    }
    const bookingData = {
      ...trip,
      selectedVehicle: selectedVehicle.name,
      selectedVehicleId: selectedVehicle.id,
      expiresAt: protectedHold?.expires_at || new Date(Date.now() + 25 * 60000).toISOString(),
      status: 'pending',
      source: 'supabase_booking_preview',
    };
    localStorage.setItem('rentmect_pending_booking', JSON.stringify(bookingData));
    const nextUrl = new URL(window.location.href);
    nextUrl.search = '';
    nextUrl.searchParams.set('booking', bookingId);
    nextUrl.searchParams.set('preview', '1');
    window.location.assign(nextUrl.toString());
  }

  if (selectedVehicle) {
    const images = vehicleImages(selectedVehicle);
    const features = list(selectedVehicle.features);
    const available = selectedAvailability?.available === true;
    return <div className="supabase-preview-shell">
      <PreviewHeader onBack={() => setSelectedId('')} label="Back to all vehicles" />
      <main className="supabase-preview-detail">
        <section className="supabase-preview-gallery">
          <img className="featured" src={images[0]} alt={selectedVehicle.name} loading="eager" fetchPriority="high" decoding="async" onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} />
          <div>{images.slice(1, 5).map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${selectedVehicle.name} view ${index + 2}`} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.hidden = true; }} />)}</div>
          {TEST_VEHICLE_ENABLED && selectedVehicle.id === TEST_VEHICLE_ID && <span>Internal test vehicle</span>}
        </section>
        <div className="supabase-preview-detail-grid">
          <div className="supabase-preview-copy">
            <p className="eyebrow">Rent Me CT fleet</p>
            <h1>{selectedVehicle.name}</h1>
            <p className="vehicle-type">{[selectedVehicle.brand, selectedVehicle.model, selectedVehicle.vehicle_type].filter(Boolean).join(' • ')}</p>
            <section><h2>About this vehicle</h2><p>{selectedVehicle.description || 'A clean, reliable Rent Me CT vehicle maintained for your trip.'}</p></section>
            <section><h2>Features &amp; equipment</h2><div className="supabase-preview-features">{features.length ? features.map((feature) => <span key={feature}><CheckCircle2 size={17}/>{feature}</span>) : <p>Vehicle features are being updated.</p>}</div></section>
            <section className="supabase-preview-policies"><div><strong>250 miles/day</strong><span>Included mileage</span></div><div><strong>Farmington, CT</strong><span>Pickup location</span></div><div><strong>Verified checkout</strong><span>Identity and documents required</span></div></section>
          </div>
          <aside className="supabase-preview-booking-card">
            <div className="supabase-preview-price"><strong>{money(selectedVehicle.daily_rate)}</strong><span>/ day</span></div>
            <TripFields trip={trip} updateTrip={updateTrip} />
            <p className={`supabase-preview-policy ${quote?.valid ? 'valid' : 'invalid'}`}>{Number(policy.advance_notice_minutes || 0) === 0 ? 'Same-day pickup is available.' : `Pickup requires ${Number(policy.advance_notice_minutes)} minutes advance notice.`} Rentals require at least {Number(policy.minimum_rental_hours || 24)} hours.</p>
            <div className={`supabase-preview-availability ${available ? 'available' : 'unavailable'}`}><span>{checking ? 'Checking calendar…' : available ? 'Available for these dates' : selectedAvailability?.reason || 'Unavailable for these dates'}</span></div>
            <div className="supabase-preview-total"><span>{days || 0} rental days</span><strong>{money(Number(selectedVehicle.daily_rate || 0) * days)}</strong></div>
            <button type="button" onClick={startBooking} disabled={!quote?.valid || !available || checking || starting}>{starting ? 'Starting secure checkout…' : 'Book this vehicle'}<ChevronRight size={18}/></button>
            <small><ShieldCheck size={14}/> Availability is confirmed again before checkout starts.</small>
            {error && <p className="supabase-preview-error">{error}</p>}
          </aside>
        </div>
      </main>
    </div>;
  }

  return <div className="supabase-preview-shell">
    <PreviewHeader label="Rent Me CT Vehicles" />
    <main className="supabase-preview-fleet">
      <section className="supabase-preview-hero"><p className="eyebrow">Rent Me CT fleet</p><h1>Choose your rental</h1><p>Choose your dates, see available vehicles, and start your reservation.</p></section>
      <section className="supabase-preview-date-panel"><h2>Choose rental dates</h2><TripFields trip={trip} updateTrip={updateTrip} /><p className={`supabase-preview-policy ${quote?.valid ? 'valid' : 'invalid'}`}>{Number(policy.advance_notice_minutes || 0) === 0 ? 'Same-day pickup is available.' : `Pickup requires ${Number(policy.advance_notice_minutes)} minutes advance notice.`} Every rental must be at least {Number(policy.minimum_rental_hours || 24)} hours.{quote?.error ? ` ${quote.error}` : ''}</p></section>
      <section className="supabase-preview-filterbar">
        <div className="supabase-preview-search"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the fleet" /></div>
        <button type="button" className={availableOnly ? 'active' : ''} aria-pressed={availableOnly} onClick={() => setAvailableOnly((current) => !current)}>Available only</button>
      </section>
      <nav className="supabase-preview-filters" aria-label="Filter vehicles"><button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All vehicles</button>{brands.map((brand) => <button type="button" aria-pressed={filter === brand.toLowerCase()} key={brand} className={filter === brand.toLowerCase() ? 'active' : ''} onClick={() => setFilter(brand.toLowerCase())}>{brand}</button>)}{['suv', 'sedan', 'truck', 'van', 'luxury'].map((type) => <button type="button" aria-pressed={filter === type} key={type} className={filter === type ? 'active' : ''} onClick={() => setFilter(type)}>{type[0].toUpperCase() + type.slice(1)}</button>)}</nav>
      {error && <p className="supabase-preview-error fleet-error" role="alert">{error}</p>}
      {loading ? <div className="supabase-preview-loading" role="status">Loading live fleet…</div> : <section className="supabase-preview-grid" aria-busy={checking}>
        {visibleVehicles.map((vehicle) => {
          const result = availability.get(vehicle.id);
          const available = result?.available === true;
          return <article className="supabase-preview-vehicle-card" key={vehicle.id}>
            <div className="image"><img src={vehicleImages(vehicle)[0]} alt={vehicle.name} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}/>{TEST_VEHICLE_ENABLED && vehicle.id === TEST_VEHICLE_ID && <em>Test lane</em>}</div>
            <div className="body"><span className={`status ${available ? 'available' : 'unavailable'}`}>{checking ? 'Checking…' : available ? 'Available' : result?.reason || 'Unavailable'}</span><h2>{vehicle.name}</h2><p>{[vehicle.vehicle_type, vehicle.brand, vehicle.model].filter(Boolean).join(' • ')}</p><ul><li>250 miles per day included</li><li>{money(vehicle.security_deposit || 300)} refundable deposit</li><li>Three-hour turnaround protected</li></ul><div className="price"><strong>{money(vehicle.daily_rate)}</strong><span>/ day</span></div><button type="button" disabled={checking || !available} onClick={() => setSelectedId(vehicle.id)}>{checking ? 'Checking dates…' : available ? 'View & book' : 'Unavailable'}{available && !checking ? <ChevronRight size={17}/> : null}</button></div>
          </article>;
        })}
        {!visibleVehicles.length && <p className="supabase-preview-empty">No vehicles match these filters and dates.</p>}
      </section>}
    </main>
  </div>;
}

function previewError(error, fallback) {
  const message = String(error?.message || '').trim();
  if (/failed to fetch|network|load failed|connection|timeout/i.test(message)) return 'The connection was interrupted. Check your internet connection and try again.';
  return fallback;
}

function PreviewHeader({ onBack, label }) {
  return <header className="supabase-preview-header"><div>{onBack ? <button type="button" onClick={onBack}><ArrowLeft size={18}/>{label}</button> : <span>{label}</span>}<img src={logoMobileUrl} alt="Rent Me CT"/><span className="secure"><ShieldCheck size={16}/> Secure booking</span></div></header>;
}

function TripFields({ trip, updateTrip }) {
  return <div className="supabase-preview-trip-fields">
    <label><span>Pickup date</span><input type="date" min={dateInput(0)} value={trip.pickupDate} onChange={(event) => updateTrip('pickupDate', event.target.value)} /></label>
    <label><span>Return date</span><input type="date" min={trip.pickupDate || dateInput(1)} value={trip.returnDate} onChange={(event) => updateTrip('returnDate', event.target.value)} /></label>
    <label><span>Pickup time</span><select value={trip.pickupTime} onChange={(event) => updateTrip('pickupTime', event.target.value)}>{TIME_OPTIONS.map((time) => <option key={time}>{time}</option>)}</select></label>
    <label><span>Return time</span><select value={trip.returnTime} onChange={(event) => updateTrip('returnTime', event.target.value)}>{TIME_OPTIONS.map((time) => <option key={time}>{time}</option>)}</select></label>
  </div>;
}
