export function bookingAvailabilityKey(trip) {
  return JSON.stringify([trip?.pickupDate, trip?.pickupTime, trip?.returnDate, trip?.returnTime]);
}

export async function fetchBookingAvailability(client, trip, read = request => request()) {
  if (!trip?.pickupDate || !trip?.pickupTime || !trip?.returnDate || !trip?.returnTime) {
    throw new Error('Choose pickup and return dates and times to check availability.');
  }
  const { data, error } = await read(() => client.rpc('get_admin_calendar_fleet_availability', {
    p_pickup_date: trip.pickupDate,
    p_pickup_time: trip.pickupTime,
    p_return_date: trip.returnDate,
    p_return_time: trip.returnTime,
  }), 'Availability');
  if (error) throw new Error(error.message || 'Availability could not be checked. Please retry.');
  if (!Array.isArray(data) || data.some(row => !row?.vehicle_id || typeof row.available !== 'boolean')) {
    throw new Error('Availability could not be confirmed. Please check again.');
  }
  return data;
}

export function bookingAvailabilityDecision(state, trip, vehicleId) {
  if (state?.key !== bookingAvailabilityKey(trip) || ['idle', 'loading'].includes(state?.status) || !state) {
    return { available: false, status: 'loading', reason: 'Checking availability for these dates…' };
  }
  if (state.status === 'error') {
    return { available: false, status: 'error', reason: state.error || 'Availability could not be checked. Please retry.' };
  }
  if (!vehicleId) return { available: false, status: 'ready', reason: 'Select an available vehicle.' };
  const row = state.rows?.find(item => item.vehicle_id === vehicleId);
  if (!row || typeof row.available !== 'boolean') {
    return { available: false, status: 'error', reason: 'Availability could not be confirmed for this vehicle. Please check again.' };
  }
  return { available: row.available, status: 'ready', reason: row.reason || (row.available ? 'Available' : 'Unavailable for these dates.') };
}
