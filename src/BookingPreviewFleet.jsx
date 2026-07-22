import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Car, CheckCircle2, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { supabase } from './supabaseClient';
import logoMobileUrl from './assets/logo-mobile.png';
import './booking-preview-fleet.css';

const TEST_VEHICLE_ID = '00000000-0000-4000-8000-000000000015';
const PUBLIC_ASSET_BASE = (import.meta.env.VITE_PUBLIC_FLEET_ASSET_BASE_URL || 'https://rentmect.com/assets').replace(/\/$/, '');
const FALLBACK_IMAGE = `${PUBLIC_ASSET_BASE}/Benz-CLS-AMG-550-224.webp`;
const TIME_OPTIONS = Array.from({ length: 25 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}).filter((time) => time !== '9:30 PM');

function dateInput(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
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
  if (uploaded.length) return uploaded;
  if (vehicle?.id === TEST_VEHICLE_ID) {
    return [FALLBACK_IMAGE, `${PUBLIC_ASSET_BASE}/fleet-2/224-1.webp`, `${PUBLIC_ASSET_BASE}/fleet-2/224-2.webp`];
  }
  const normalized = String(vehicle?.name || '')
    .replace(/Mercedes[- ]Benz/i, 'Mercedes-Benz')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized ? [`${PUBLIC_ASSET_BASE}/${normalized}.webp`] : [FALLBACK_IMAGE];
}

function money(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function rentalDays(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.ceil((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000));
}

export default function BookingPreviewFleet() {
  const url = new URL(window.location.href);
  const [trip, setTrip] = useState({
    pickupDate: url.searchParams.get('pickupDate') || dateInput(1),
    returnDate: url.searchParams.get('returnDate') || dateInput(3),
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

  useEffect(() => {
    let active = true;
    async function loadVehicles() {
      const { data, error: loadError } = await supabase
        .from('vehicles')
        .select('*')
        .or(`published.eq.true,id.eq.${TEST_VEHICLE_ID}`)
        .order('daily_rate', { ascending: true });
      if (!active) return;
      if (loadError) setError(loadError.message);
      else setVehicles(data || []);
      setLoading(false);
    }
    loadVehicles();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!trip.pickupDate || !trip.returnDate || trip.returnDate <= trip.pickupDate) {
      setAvailability(new Map());
      setChecking(false);
      return;
    }
    let active = true;
    setChecking(true);
    const timer = window.setTimeout(async () => {
      const { data, error: availabilityError } = await supabase.rpc('get_admin_calendar_fleet_availability', {
        p_pickup_date: trip.pickupDate,
        p_pickup_time: trip.pickupTime,
        p_return_date: trip.returnDate,
        p_return_time: trip.returnTime,
      });
      if (!active) return;
      if (availabilityError) {
        setError(availabilityError.message);
        setAvailability(new Map());
      } else {
        setError('');
        const nextAvailability = new Map((data || []).map((item) => [item.vehicle_id, item]));
        // The fixed internal test lane intentionally bypasses production inventory
        // so QA can run the full flow repeatedly without blocking a real vehicle.
        nextAvailability.set(TEST_VEHICLE_ID, {
          vehicle_id: TEST_VEHICLE_ID,
          available: true,
          reason: 'Internal test lane',
        });
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
  const days = rentalDays(trip.pickupDate, trip.returnDate);

  function updateTrip(key, value) {
    setTrip((current) => {
      const next = { ...current, [key]: value };
      if (key === 'pickupDate' && next.returnDate <= value) {
        const returnDate = new Date(`${value}T12:00:00`);
        returnDate.setDate(returnDate.getDate() + 1);
        next.returnDate = returnDate.toISOString().slice(0, 10);
      }
      return next;
    });
  }

  async function startBooking() {
    if (!selectedVehicle || selectedAvailability?.available !== true) return;
    setStarting(true);
    setError('');
    const { data: bookingId, error: bookingError } = await supabase.rpc('create_website_pending_booking', {
      p_pickup_date: trip.pickupDate,
      p_return_date: trip.returnDate,
      p_pickup_time: trip.pickupTime,
      p_return_time: trip.returnTime,
      p_vehicle_id: selectedVehicle.id,
      p_selected_vehicle_name: selectedVehicle.name,
    });
    if (bookingError || !bookingId) {
      setError(bookingError?.message || 'The checkout session could not be created.');
      setStarting(false);
      return;
    }
    const bookingData = {
      ...trip,
      selectedVehicle: selectedVehicle.name,
      selectedVehicleId: selectedVehicle.id,
      expiresAt: new Date(Date.now() + 25 * 60000).toISOString(),
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
          <img className="featured" src={images[0]} alt={selectedVehicle.name} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} />
          <div>{images.slice(1, 5).map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${selectedVehicle.name} view ${index + 2}`} onError={(event) => { event.currentTarget.hidden = true; }} />)}</div>
          {selectedVehicle.id === TEST_VEHICLE_ID && <span>Internal test vehicle</span>}
        </section>
        <div className="supabase-preview-detail-grid">
          <div className="supabase-preview-copy">
            <p className="eyebrow">Rent Me CT fleet</p>
            <h1>{selectedVehicle.name}</h1>
            <p className="vehicle-type">{[selectedVehicle.brand, selectedVehicle.model, selectedVehicle.vehicle_type].filter(Boolean).join(' • ')}</p>
            <section><h2>About this vehicle</h2><p>{selectedVehicle.description || 'A clean, reliable Rent Me CT vehicle maintained for your trip.'}</p></section>
            <section><h2>Features &amp; equipment</h2><div className="supabase-preview-features">{features.length ? features.map((feature) => <span key={feature}><CheckCircle2 size={17}/>{feature}</span>) : <p>Vehicle features are being updated.</p>}</div></section>
            <section className="supabase-preview-policies"><div><strong>200 miles/day</strong><span>Included mileage</span></div><div><strong>Farmington, CT</strong><span>Pickup location</span></div><div><strong>Verified checkout</strong><span>Identity and documents required</span></div></section>
          </div>
          <aside className="supabase-preview-booking-card">
            <div className="supabase-preview-price"><strong>{money(selectedVehicle.daily_rate)}</strong><span>/ day</span></div>
            <TripFields trip={trip} updateTrip={updateTrip} />
            <div className={`supabase-preview-availability ${available ? 'available' : 'unavailable'}`}><span>{checking ? 'Checking calendar…' : available ? 'Available for these dates' : selectedAvailability?.reason || 'Unavailable for these dates'}</span></div>
            <div className="supabase-preview-total"><span>{days || 0} rental days</span><strong>{money(Number(selectedVehicle.daily_rate || 0) * days)}</strong></div>
            <button type="button" onClick={startBooking} disabled={!available || checking || starting}>{starting ? 'Starting secure checkout…' : 'Book this vehicle'}<ChevronRight size={18}/></button>
            <small><ShieldCheck size={14}/> Supabase calendar verified. A final atomic availability check runs before a rental is created.</small>
            {error && <p className="supabase-preview-error">{error}</p>}
          </aside>
        </div>
      </main>
    </div>;
  }

  return <div className="supabase-preview-shell">
    <PreviewHeader label="Supabase Booking Preview" />
    <main className="supabase-preview-fleet">
      <section className="supabase-preview-hero"><p className="eyebrow">Rent Me CT fleet</p><h1>Choose your rental</h1><p>This private preview reads published vehicles and availability directly from the admin calendar.</p></section>
      <section className="supabase-preview-date-panel"><h2>Choose rental dates</h2><TripFields trip={trip} updateTrip={updateTrip} /></section>
      <section className="supabase-preview-filterbar">
        <div className="supabase-preview-search"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the fleet" /></div>
        <button type="button" className={availableOnly ? 'active' : ''} onClick={() => setAvailableOnly((current) => !current)}>Available only</button>
      </section>
      <nav className="supabase-preview-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All vehicles</button>{brands.map((brand) => <button key={brand} className={filter === brand.toLowerCase() ? 'active' : ''} onClick={() => setFilter(brand.toLowerCase())}>{brand}</button>)}{['suv', 'sedan', 'truck', 'van', 'luxury'].map((type) => <button key={type} className={filter === type ? 'active' : ''} onClick={() => setFilter(type)}>{type[0].toUpperCase() + type.slice(1)}</button>)}</nav>
      {error && <p className="supabase-preview-error fleet-error">{error}</p>}
      {loading ? <div className="supabase-preview-loading">Loading Supabase fleet…</div> : <section className="supabase-preview-grid">
        {visibleVehicles.map((vehicle) => {
          const result = availability.get(vehicle.id);
          const available = result?.available === true;
          return <article className="supabase-preview-vehicle-card" key={vehicle.id}>
            <div className="image"><img src={vehicleImages(vehicle)[0]} alt={vehicle.name} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}/>{vehicle.id === TEST_VEHICLE_ID && <em>Test lane</em>}</div>
            <div className="body"><span className={`status ${available ? 'available' : 'unavailable'}`}>{checking ? 'Checking…' : available ? 'Available' : result?.reason || 'Unavailable'}</span><h2>{vehicle.name}</h2><p>{[vehicle.vehicle_type, vehicle.brand, vehicle.model].filter(Boolean).join(' • ')}</p><ul><li>200 miles per day included</li><li>{money(vehicle.security_deposit || 300)} refundable deposit</li><li>Three-hour turnaround protected</li></ul><div className="price"><strong>{money(vehicle.daily_rate)}</strong><span>/ day</span></div><button type="button" onClick={() => setSelectedId(vehicle.id)}>View &amp; book<ChevronRight size={17}/></button></div>
          </article>;
        })}
        {!visibleVehicles.length && <p className="supabase-preview-empty">No vehicles match these filters and dates.</p>}
      </section>}
    </main>
  </div>;
}

function PreviewHeader({ onBack, label }) {
  return <header className="supabase-preview-header"><div>{onBack ? <button type="button" onClick={onBack}><ArrowLeft size={18}/>{label}</button> : <span>{label}</span>}<img src={logoMobileUrl} alt="Rent Me CT"/><span className="secure"><ShieldCheck size={16}/> Calendar-connected preview</span></div></header>;
}

function TripFields({ trip, updateTrip }) {
  return <div className="supabase-preview-trip-fields">
    <label><span>Pickup date</span><input type="date" min={dateInput(0)} value={trip.pickupDate} onChange={(event) => updateTrip('pickupDate', event.target.value)} /></label>
    <label><span>Return date</span><input type="date" min={trip.pickupDate || dateInput(1)} value={trip.returnDate} onChange={(event) => updateTrip('returnDate', event.target.value)} /></label>
    <label><span>Pickup time</span><select value={trip.pickupTime} onChange={(event) => updateTrip('pickupTime', event.target.value)}>{TIME_OPTIONS.map((time) => <option key={time}>{time}</option>)}</select></label>
    <label><span>Return time</span><select value={trip.returnTime} onChange={(event) => updateTrip('returnTime', event.target.value)}>{TIME_OPTIONS.map((time) => <option key={time}>{time}</option>)}</select></label>
  </div>;
}
