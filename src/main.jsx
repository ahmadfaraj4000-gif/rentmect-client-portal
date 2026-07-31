import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileSignature,
  FileText,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  ShieldCheck,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from './supabaseClient';
import BookingPreviewFleet from './BookingPreviewFleet';
import BirthdayInput from './BirthdayInput';
import FLEET_GALLERY_IMAGES from './fleetGalleryImages';
import { AGREEMENT_TEXT, AGREEMENT_VERSION } from './rentalAgreement';
import logoUrl from './assets/logo-sidebar.png';
import logoMobileUrl from './assets/logo-mobile.png';
import './styles.css';
import './final-overrides.css';

const DEFAULT_VEHICLE_IMAGE_NAMES = [
  'Audi-A4-002', 'Audi-A4-158', 'Audi-A6-385', 'Audi-A6-473', 'Audi-A8L-YPS',
  'Audi-Q3-100', 'Audi-Q5-148', 'Audi-Q5-149', 'Audi-Q5-203', 'Audi-Q5-210',
  'Audi-Q5-225', 'Audi-Q5-234', 'Audi-Q5-474', 'Audi-Q5-997', 'Audi-S3-001',
  'BMW-328I-004', 'BMW-330I-157', 'BMW-330XI-166', 'Benz-C300-418',
  'Benz-CLS-AMG-550-224', 'Buick-Encore-649', 'Cadillac-ATS-780',
  'Dodge-Van-451', 'Dodge-Van-452', 'Ford-Escape-650', 'Ford-F350-4X4-191',
  'Kia-Soul-656', 'Mercedes-Benz-C300-677', 'Mercedes-C300-321',
];
const PUBLIC_FLEET_ASSET_BASE_URL = (
  import.meta.env.VITE_PUBLIC_FLEET_ASSET_BASE_URL || 'https://rentmect.com/assets'
).replace(/\/$/, '');

const RENTMECT_ADDRESS =
  import.meta.env.VITE_RENTMECT_ADDRESS || '12 Holmes Circle, Farmington, CT';
const TEST_VEHICLE_PREVIEW_IMAGES = [
  `${PUBLIC_FLEET_ASSET_BASE_URL}/Benz-CLS-AMG-550-224.webp`,
  `${PUBLIC_FLEET_ASSET_BASE_URL}/fleet-2/224-1.webp`,
  `${PUBLIC_FLEET_ASSET_BASE_URL}/fleet-2/224-2.webp`,
  `${PUBLIC_FLEET_ASSET_BASE_URL}/fleet-2/224-3.webp`,
  `${PUBLIC_FLEET_ASSET_BASE_URL}/fleet-2/224-4.webp`,
];
const VEHICLE_GALLERY_JPG_IMAGES = new Set([
  '001-2', '002-1', '002-2', '100-3', '148-1', '157-2',
  '191-1', '191-2', '210-1', '210-2', '225-2', '321-1',
  '451-2', '474-1', '649-2', '656-1', '656-2', '656-3',
]);
const VEHICLE_FEATURE_GROUPS = {
  suv: new Set(['100', '148', '149', '203', '210', '225', '234', '474', '997']),
  compactSuv: new Set(['649', '650']),
  hatchback: new Set(['656']),
  truck: new Set(['191']),
  van: new Set(['451', '452']),
};
const TEST_VEHICLE_FEATURES = [
  'Backup camera', 'Bluetooth', 'Apple CarPlay', 'AUX input',
  'USB charger', 'GPS', 'Keyless entry', 'Automatic transmission',
];

const CT_TAX_RATE = 0.0635;
const DEFAULT_UNDER_25_PRICING = {
  deposit_adjustment_enabled: true,
  deposit_adjustment_type: 'fixed',
  deposit_adjustment_value: 200,
  rental_markup_percentage: 10,
};
const BOOKING_FLOW_TEST_VEHICLE_ID = '00000000-0000-4000-8000-000000000015';
const BOOKING_FLOW_TEST_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_BOOKING_FLOW_TEST === 'true';
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MILEAGE_POLICY = '200 miles/day included; excess mileage $0.35/mile';
const CANCELLATION_TERMS = 'Contact Rent Me CT before pickup for cancellation or schedule changes.';
const SMS_CONSENT_VERSION = '2026-07-26';
const SMS_CONSENT_SOURCE = 'client_portal';
const SMS_CONSENT_TEXT = 'I agree to receive automated transactional SMS messages from Rent Me CT about bookings, payments, documents, pickup, returns, extensions, and customer support. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is not a condition of purchase.';
const SMS_TERMS_URL = 'https://rentmect.com/terms.html#sms-terms';
const SMS_PRIVACY_URL = 'https://rentmect.com/privacy-policy.html#sms-privacy';
const BLOCKING_RENTAL_STATUSES = ['pending', 'documents_needed', 'document_review', 'ready_for_pickup', 'approved', 'active', 'overdue', 'return_initiated', 'checkout_hold', 'calendar_block'];
const AVAILABILITY_RENTAL_STATUSES = [...BLOCKING_RENTAL_STATUSES, 'completed'];
const BLOCKING_VEHICLE_STATUSES = ['maintenance', 'unavailable', 'inactive'];
const TURNAROUND_BUFFER_MINUTES = 180;

function App() {
  const initialUrlParams = new URLSearchParams(window.location.search);
  const previewRoute = initialUrlParams.get('preview') || '';
  const adminBookingToken = initialUrlParams.get('adminBooking') || '';
  const guidedAdminRentalId = initialUrlParams.get('adminRental') || '';
  const guidedAdminCustomerPath = initialUrlParams.get('adminPath') === 'returning' ? 'returning' : 'new';
  const cars2BookingHandoff = initialUrlParams.get('source') === 'cars2';
  const [returningFromStripeIdentity] = useState(() => initialUrlParams.get('identity') === 'return');
  const bookingPreviewFleetMode = previewRoute === 'fleet';
  const bookingPreviewCheckoutMode = previewRoute === '1';
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailAuthBusy, setEmailAuthBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [reservationSaving, setReservationSaving] = useState(false);
  const [agreementSaving, setAgreementSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountInput, setDiscountInput] = useState(() =>
    String(new URLSearchParams(window.location.search).get('promo') || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 24)
  );
  const [identitySaving, setIdentitySaving] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [extensionSaving, setExtensionSaving] = useState(false);
  const [extensionPreview, setExtensionPreview] = useState(null);
  const [extensionMode, setExtensionMode] = useState('extend');
  const [tripChangeChoice, setTripChangeChoice] = useState('');
  const [portalDataReady, setPortalDataReady] = useState(false);
  const [portalHealth, setPortalHealth] = useState({ refreshing: false, errors: [], lastUpdated: null });
  const [documentUploadBusy, setDocumentUploadBusy] = useState({});
  const [supportSending, setSupportSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [checkoutNow, setCheckoutNow] = useState(() => Date.now());

  const [authForm, setAuthForm] = useState({
    fullName: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    billingSame: true,
  });

  const [profile, setProfile] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [fleetRentals, setFleetRentals] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [reports, setReports] = useState([]);
  const [extensionRequests, setExtensionRequests] = useState([]);
  const [emergencyExceptions, setEmergencyExceptions] = useState([]);
  const [rentalCharges, setRentalCharges] = useState([]);
  const [serviceFees, setServiceFees] = useState([]);
  const [under25Pricing, setUnder25Pricing] = useState(DEFAULT_UNDER_25_PRICING);
  const [supportText, setSupportText] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileClientNav, setIsMobileClientNav] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches);
  const [navCollapsed, setNavCollapsed] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [tripManagerOpen, setTripManagerOpen] = useState(false);

  const [reservationForm, setReservationForm] = useState({
    vehicleId: '',
    pickupDate: getTodayDateInputValue(),
    returnDate: getNextDateInputValue(getTodayDateInputValue()),
    pickupTime: '9:00 AM',
    returnTime: '9:00 AM',
  });
  const [extensionForm, setExtensionForm] = useState({
    returnDate: '',
    returnTime: '9:00 AM',
    note: '',
  });

  const [pendingVehicleName, setPendingVehicleName] = useState('');
  const [pendingVehicleId, setPendingVehicleId] = useState('');
  const [pendingBookingId, setPendingBookingId] = useState('');
  const [checkoutExpiresAt, setCheckoutExpiresAt] = useState('');
  const [checkoutIntent, setCheckoutIntent] = useState(Boolean(adminBookingToken || guidedAdminRentalId));
  const [checkoutWizardStarted, setCheckoutWizardStarted] = useState(false);
  const [previewPage, setPreviewPage] = useState(() => cars2BookingHandoff ? 'checkout' : 'details');
  const [previewCheckoutSection, setPreviewCheckoutSection] = useState('contact');
  const [previewPortalOpen, setPreviewPortalOpen] = useState(false);
  const [adminBookingHandoff, setAdminBookingHandoff] = useState(() =>
    guidedAdminRentalId ? { rental_id: guidedAdminRentalId, customer_path: guidedAdminCustomerPath } : null
  );
  const [adminBookingRentalId, setAdminBookingRentalId] = useState(guidedAdminRentalId);
  const [adminBookingClaimed, setAdminBookingClaimed] = useState(Boolean(guidedAdminRentalId));
  const [adminBookingError, setAdminBookingError] = useState('');
  const checkoutExpiryHandledRef = useRef('');
  const identityReturnHandledRef = useRef(false);
  const paymentReturnPendingRef = useRef(false);
  const paymentReturnHandledRef = useRef(false);

  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    full_name: '',
    date_of_birth: '',
    phone: '',
    intended_vehicle_use: '',
    email_marketing_opt_in: false,
    sms_transactional_opt_in: false,
  });
  const [confirmedBirthDate, setConfirmedBirthDate] = useState('');
  const [identityCorrectionTarget, setIdentityCorrectionTarget] = useState('');
  const birthDateConfirmed = Boolean(profileForm.date_of_birth && confirmedBirthDate === profileForm.date_of_birth);
  const profileComplete = Boolean(
    hasFirstAndLastName(profileForm.full_name) &&
    profileForm.phone.trim() &&
    profileForm.intended_vehicle_use.trim() &&
    isValidBirthDate(profileForm.date_of_birth) &&
    birthDateConfirmed
  );

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardReminder, setWizardReminder] = useState(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const contactStepCompleted = Boolean(profileComplete && phoneVerified);
  const [phoneCode, setPhoneCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signatureImageData, setSignatureImageData] = useState('');
  const [insuranceCoverage, setInsuranceCoverage] = useState({ collision: false, liability: false });

  function notify(text, type = 'info') {
    const safeText = customerSafeMessage(text);
    const resolvedType = type === 'info' && /could not|failed|error|invalid|expired|cannot|must|required|choose|enter|complete|verify|unavailable/i.test(safeText)
      ? 'error'
      : type;
    setNotice({ text: safeText, type: resolvedType });
    window.clearTimeout(notify.timeout);
    if (resolvedType !== 'error') {
      notify.timeout = window.setTimeout(() => setNotice(null), 5200);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const syncMobileNav = () => {
      setIsMobileClientNav(mediaQuery.matches);
      setNavCollapsed(mediaQuery.matches);
    };
    syncMobileNav();
    mediaQuery.addEventListener('change', syncMobileNav);
    return () => mediaQuery.removeEventListener('change', syncMobileNav);
  }, []);

  useEffect(() => {
    if (!isMobileClientNav || navCollapsed) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setNavCollapsed(true);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMobileClientNav, navCollapsed]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      let initialSession = data.session;
      if (adminBookingToken && initialSession) {
        await supabase.auth.signOut();
        initialSession = null;
      }
      setSession(initialSession);
      const metaBooking = initialSession?.user?.user_metadata?.pending_booking;

      if (metaBooking) {
        localStorage.setItem('rentmect_pending_booking', JSON.stringify(metaBooking));
      }

      if (adminBookingToken) {
        await loadAdminBookingHandoff(adminBookingToken);
      } else if (getBookingIdFromUrl()) {
        const bookingId = getBookingIdFromUrl();
        setPendingBookingId(bookingId);
        await loadPendingBookingFromDatabase(bookingId, initialSession);
      } else {
        loadSavedBookingFromWebsite();
      }

      const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
      });

      setLoading(false);

      return () => listener?.subscription?.unsubscribe?.();
    }

    init();

    return () => {
      mounted = false;
    };
  }, [adminBookingToken]);

  useEffect(() => {
    if (session?.user?.id) {
      setPortalDataReady(false);
      loadPortalData(session.user.id, { stripeReturnRetry: returningFromStripeIdentity });
    }
  }, [session, returningFromStripeIdentity]);

  useEffect(() => {
    if (!portalDataReady || !session?.access_token || identityReturnHandledRef.current) return;
    const url = new URL(window.location.href);
    const returningFromStripe = url.searchParams.get('identity') === 'return'
      || window.sessionStorage.getItem('rentmect_identity_return_pending') === '1';
    if (!returningFromStripe) return;

    identityReturnHandledRef.current = true;
    window.sessionStorage.removeItem('rentmect_identity_return_pending');
    url.searchParams.delete('identity');
    url.searchParams.delete('guided');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    setActiveTab('overview');
    setPreviewCheckoutSection('identity');
    if (!bookingPreviewCheckoutMode) {
      setWizardStep(2);
      setWizardOpen(true);
    }

    refreshIdentityVerification(false).then((data) => {
      if (!data) return;
      if (data.verified) {
        setPreviewCheckoutSection('documents');
        if (!bookingPreviewCheckoutMode) {
          setWizardStep(3);
          setWizardOpen(true);
        }
        notify('Identity verified successfully. Continue with your driver documents.', 'success');
        return;
      }
      if (data.status === 'processing') {
        notify('Stripe received your identity check and is still reviewing it. This page will show VERIFIED when it is approved.');
        return;
      }
      notify('Identity was not verified. Open the identity step to see the status and retry with Stripe.', 'error');
    });
  }, [portalDataReady, session?.access_token, bookingPreviewCheckoutMode]);

  useEffect(() => {
    if (!session?.user?.id) return undefined;
    let refreshTimer;
    let calendarPoll;
    const refreshFleetCalendar = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => {
        const { data, error } = await supabase.rpc('get_vehicle_booking_blocks');
        if (error) {
          setPortalHealth((current) => ({
            ...current,
            errors: [
              ...(current.errors || []).filter((item) => item.label !== 'Availability'),
              { label: 'Availability', message: userFacingPortalError(error, 'Live vehicle availability could not refresh.') },
            ],
          }));
          return;
        }
        if (data) setFleetRentals(data);
        setPortalHealth((current) => ({
          ...current,
          errors: (current.errors || []).filter((item) => item.label !== 'Availability'),
          lastUpdated: new Date().toISOString(),
        }));
      }, 150);
    };
    const refreshOnFocus = () => refreshFleetCalendar();
    const fleetChannel = supabase
      .channel('client-fleet-source-of-truth')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals' }, refreshFleetCalendar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_bookings' }, refreshFleetCalendar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_availability_blocks' }, refreshFleetCalendar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => loadPortalData(session.user.id, { silent: true }))
      .subscribe();
    calendarPoll = window.setInterval(refreshFleetCalendar, 15 * 1000);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearTimeout(refreshTimer);
      window.clearInterval(calendarPoll);
      window.removeEventListener('focus', refreshOnFocus);
      supabase.removeChannel(fleetChannel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !pendingBookingId) return;

    async function attachPendingBookingToUser() {
      const { error } = await supabase.rpc('claim_customer_pending_booking', {
        p_booking_id: pendingBookingId,
        p_customer_phone: profileForm.phone || null,
        p_vehicle_id: reservationForm.vehicleId || pendingVehicleId || null,
      });

      if (error) {
        notify(userFacingPortalError(error, 'We could not connect this booking to your account yet. Please tap Save & continue again.'));
      }
    }

    attachPendingBookingToUser();
  }, [session, pendingBookingId, pendingVehicleId, reservationForm.vehicleId, profileForm.phone]);

  useEffect(() => {
    if (profile?.full_name && !signatureName) {
      setSignatureName(profile.full_name);
    }
  }, [profile, signatureName]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !portalDataReady) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') === '1' || params.get('charge')) setActiveTab('payment');
  }, [session?.user?.id, portalDataReady]);

  useEffect(() => {
    if (!checkoutExpiresAt) return undefined;
    setCheckoutNow(Date.now());
    const timer = window.setInterval(() => setCheckoutNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [checkoutExpiresAt]);

  useEffect(() => {
    if (pendingVehicleId && vehicles.some((vehicle) => vehicle.id === pendingVehicleId) && reservationForm.vehicleId !== pendingVehicleId) {
      setReservationForm((prev) => ({
        ...prev,
        vehicleId: pendingVehicleId,
      }));
      return;
    }

    if (!pendingVehicleName || vehicles.length === 0 || reservationForm.vehicleId) return;

    const matchedVehicle = vehicles.find((vehicle) =>
      normalizeVehicleName(vehicle.name) === normalizeVehicleName(pendingVehicleName) &&
      isVehicleAvailableForDates(vehicle, reservationForm, fleetRentals)
    );

    if (matchedVehicle) {
      setReservationForm((prev) => ({
        ...prev,
        vehicleId: matchedVehicle.id,
      }));
    }
  }, [pendingVehicleId, pendingVehicleName, vehicles, reservationForm, fleetRentals]);

  const currentRental = useMemo(() => {
    const blockingRentals = rentals.filter((r) => BLOCKING_RENTAL_STATUSES.includes(r.status));
    if (adminBookingRentalId) {
      return blockingRentals.find((rental) => rental.id === adminBookingRentalId);
    }
    if (checkoutIntent && reservationForm.vehicleId) {
      return blockingRentals.find((rental) => (
        rental.vehicle_id === reservationForm.vehicleId &&
        rental.pickup_date === reservationForm.pickupDate &&
        rental.return_date === reservationForm.returnDate &&
        String(rental.pickup_time || '9:00 AM') === String(reservationForm.pickupTime || '9:00 AM') &&
        String(rental.return_time || '9:00 AM') === String(reservationForm.returnTime || '9:00 AM')
      ));
    }

    const priority = (status) => {
      if (['active', 'overdue', 'return_initiated'].includes(status)) return 0;
      if (['ready_for_pickup', 'approved'].includes(status)) return 1;
      return 2;
    };
    return [...blockingRentals].sort((a, b) => priority(a.status) - priority(b.status))[0];
  }, [rentals, adminBookingRentalId, checkoutIntent, reservationForm.vehicleId, reservationForm.pickupDate, reservationForm.returnDate, reservationForm.pickupTime, reservationForm.returnTime]);

  useEffect(() => {
    if (!currentRental?.id) return;

    if (currentRental.checkout_expires_at) {
      setCheckoutExpiresAt(currentRental.checkout_expires_at);
    }

    setReservationForm((prev) => ({
      ...prev,
      vehicleId: currentRental.vehicle_id || prev.vehicleId,
      pickupDate: currentRental.pickup_date || prev.pickupDate,
      returnDate: currentRental.return_date || prev.returnDate,
      pickupTime: currentRental.pickup_time || prev.pickupTime,
      returnTime: currentRental.return_time || prev.returnTime,
    }));
  }, [
    currentRental?.id,
    currentRental?.vehicle_id,
    currentRental?.pickup_date,
    currentRental?.return_date,
    currentRental?.pickup_time,
    currentRental?.return_time,
    currentRental?.checkout_expires_at,
  ]);

  const bookingFlowTestMode = BOOKING_FLOW_TEST_ENABLED && Boolean(
    pendingVehicleId === BOOKING_FLOW_TEST_VEHICLE_ID ||
    reservationForm.vehicleId === BOOKING_FLOW_TEST_VEHICLE_ID ||
    currentRental?.vehicle_id === BOOKING_FLOW_TEST_VEHICLE_ID
  );

  useEffect(() => {
    if (!session?.user?.id || !portalDataReady || !checkoutIntent || checkoutWizardStarted || bookingFlowTestMode || bookingPreviewCheckoutMode) return;
    if (pendingVehicleName && vehicles.length === 0) return;
    if (currentRental) {
      setCheckoutWizardStarted(true);
      return;
    }
    // If the originally selected website vehicle is no longer available, still open the wizard so the customer can choose another car.

    setActiveTab('overview');
    setWizardStep(contactStepCompleted ? 1 : 0);
    setWizardOpen(true);
    setCheckoutWizardStarted(true);
  }, [session, portalDataReady, checkoutIntent, checkoutWizardStarted, pendingVehicleName, vehicles.length, reservationForm.vehicleId, currentRental, contactStepCompleted, bookingFlowTestMode, bookingPreviewCheckoutMode]);

  const previousRentals = useMemo(() => {
    return rentals.filter((r) => ['completed', 'cancelled'].includes(r.status));
  }, [rentals]);

  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === reservationForm.vehicleId);
  }, [vehicles, reservationForm.vehicleId]);

  const displayedVehicle = currentRental?.vehicles || selectedVehicle;
  const checkoutVehicleChoices = bookingFlowTestMode
    ? vehicles.filter((vehicle) => vehicle.id === BOOKING_FLOW_TEST_VEHICLE_ID)
    : vehicles.filter((vehicle) => vehicle.id !== BOOKING_FLOW_TEST_VEHICLE_ID);
  const overviewPickupDate = currentRental?.pickup_date || reservationForm.pickupDate;
  const overviewPickupTime = currentRental?.pickup_time || reservationForm.pickupTime;
  const overviewReturnDate = currentRental?.return_date || reservationForm.returnDate;
  const overviewReturnTime = currentRental?.return_time || reservationForm.returnTime;

  const availableVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => isVehicleAvailableForDates(vehicle, reservationForm, fleetRentals, currentRental?.id));
  }, [vehicles, reservationForm, fleetRentals, currentRental?.id]);

  const estimate = useMemo(() => {
    if (!selectedVehicle || !reservationForm.pickupDate || !reservationForm.returnDate) {
      return null;
    }

    const days = getRentalDays(reservationForm.pickupDate, reservationForm.returnDate);
    if (days < 1) return { invalid: true, days };

    const baseRentalTotal = Number(selectedVehicle.daily_rate || 0) * days;
    const under25 = isCustomerUnder25(profileForm.date_of_birth);
    const markupPercentage = under25 ? Number(under25Pricing.rental_markup_percentage || 0) : 0;
    const markupAmount = baseRentalTotal * markupPercentage / 100;
    const rentalTotal = baseRentalTotal + markupAmount;
    const serviceFeeTotal = serviceFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
    const taxableServiceFeeTotal = serviceFees.filter((fee) => fee.taxable).reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
    const serviceFeeTaxAmount = taxableServiceFeeTotal * CT_TAX_RATE;
    const taxAmount = (rentalTotal + taxableServiceFeeTotal) * CT_TAX_RATE;
    const baseSecurityDeposit = Number(selectedVehicle.security_deposit || 0);
    const securityDeposit = under25
      ? calculateUnder25Deposit(baseSecurityDeposit, under25Pricing)
      : baseSecurityDeposit;

    return {
      days,
      under25,
      baseRentalTotal,
      markupPercentage,
      markupAmount,
      rentalTotal,
      serviceFeeTotal,
      serviceFeeTaxAmount,
      taxAmount,
      baseSecurityDeposit,
      securityDeposit,
      checkoutTotal: rentalTotal + serviceFeeTotal + taxAmount,
    };
  }, [selectedVehicle, reservationForm, profileForm.date_of_birth, under25Pricing, serviceFees]);

  const userEmail = session?.user?.email || '';
  const userName =
    profile?.full_name ||
    session?.user?.user_metadata?.full_name ||
    userEmail ||
    'Rent Me CT Customer';
  const clientGreetingName =
    profile?.full_name ||
    session?.user?.user_metadata?.full_name ||
    userEmail.split('@')[0] ||
    'there';
  const clientFirstName = clientGreetingName.trim().split(/\s+/)[0] || 'there';

  const currentRentalDocuments = useMemo(() => {
    if (!currentRental?.id) return [];
    return documents.filter((document) => document.rental_id === currentRental.id);
  }, [documents, currentRental?.id]);
  const reusableLicenseDocument = useMemo(() => latestDocument(documents, 'license'), [documents]);
  const currentInsuranceDocument = useMemo(() => latestDocument(currentRentalDocuments, 'insurance'), [currentRentalDocuments]);
  const currentRentalLicenseDocument = useMemo(() => latestDocument(currentRentalDocuments, 'license'), [currentRentalDocuments]);
  const documentsForActiveRental = useMemo(() => {
    const license = reusableLicenseDocument || currentRentalLicenseDocument;
    return [license, currentInsuranceDocument].filter(Boolean);
  }, [currentInsuranceDocument, currentRentalLicenseDocument, reusableLicenseDocument]);
  const currentRentalExtensions = useMemo(() => {
    if (!currentRental?.id) return [];
    return extensionRequests.filter((request) => request.rental_id === currentRental.id);
  }, [extensionRequests, currentRental?.id]);
  const currentEmergencyException = emergencyExceptions.find((item) =>
    item.rental_id === currentRental?.id && item.status === 'active'
  );
  const currentRentalReports = useMemo(() => {
    if (!currentRental?.id) return [];
    return reports.filter((report) => report.rental_id === currentRental.id);
  }, [reports, currentRental?.id]);
  const latestOpenReturnReport = useMemo(() => {
    const activeReport = currentRentalReports.find((report) =>
      !['resolved', 'closed', 'completed'].includes(String(report.status || 'open').toLowerCase())
    );
    if (activeReport) return activeReport;

    return reports.find((report) =>
      !['resolved', 'closed', 'completed'].includes(String(report.status || 'open').toLowerCase())
    );
  }, [currentRentalReports, reports]);
  const pendingExtension = currentRentalExtensions.find((request) => request.status === 'pending');
  const pendingSameVehicleExtension = pendingExtension?.request_kind !== 'switch_car_continuation' ? pendingExtension : null;
  const approvedUnpaidExtension = currentRentalExtensions.find((request) => request.status === 'approved_pending_payment');
  const openExtensionRequest = pendingExtension || approvedUnpaidExtension;
  const extensionInsuranceDocument = openExtensionRequest
    ? [...currentRentalDocuments]
        .filter((document) =>
          document.document_type === 'insurance' &&
          document.extension_request_id === openExtensionRequest.id
        )
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]
    : null;
  const extensionInsuranceUploaded = isUsableDocument(extensionInsuranceDocument);
  const extensionInsuranceRequired = Boolean(openExtensionRequest && !extensionInsuranceUploaded);
  const approvedSwitchExtension = currentRentalExtensions.find((request) =>
    request.status === 'approved_pending_payment' &&
    request.request_kind === 'switch_car_continuation'
  );
  const approvedSwitchVehicle = vehicles.find((vehicle) => vehicle.id === approvedSwitchExtension?.replacement_vehicle_id);
  const activatedExtension = currentRentalExtensions.find((request) => request.status === 'activated');
  const latestExtensionStatus = [...currentRentalExtensions]
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))[0];
  const paidSwitchContinuation = extensionRequests.find((request) =>
    request.status === 'activated' &&
    request.request_kind === 'switch_car_continuation' &&
    request.replacement_rental_id
  );
  const switchContinuationRental = rentals.find((rental) => rental.id === paidSwitchContinuation?.replacement_rental_id);

  const licenseRejected = reusableLicenseDocument?.status === 'rejected';
  const insuranceRejected = currentInsuranceDocument?.status === 'rejected';
  const licenseUploaded = isUsableDocument(reusableLicenseDocument);
  const insuranceUploaded = isUsableDocument(currentInsuranceDocument);
  const documentsRejected = licenseRejected || insuranceRejected;
  const missingRequiredDocuments = !licenseUploaded || !insuranceUploaded;
  const hasCompletedRental = previousRentals.some((rental) => rental.status === 'completed');
  const emailVerified = Boolean(session?.user?.email_confirmed_at);
  const agreementSigned = Boolean(currentRental?.agreement_signed);
  const paymentPaid = currentRental?.payment_status === 'paid';
  const currentRentalAdditionalCharges = rentalCharges.filter((charge) =>
    !charge.included_in_initial_payment && (
      charge.rental_id === currentRental?.id || !['paid', 'waived'].includes(charge.status)
    )
  );
  const checkoutDeadline = checkoutExpiresAt ? new Date(checkoutExpiresAt).getTime() : 0;
  const checkoutSecondsRemaining = checkoutDeadline
    ? Math.max(0, Math.ceil((checkoutDeadline - checkoutNow) / 1000))
    : null;
  const checkoutExpired = checkoutSecondsRemaining === 0 && !paymentPaid;
  const checkoutHoldActive = Boolean(
    checkoutIntent && checkoutDeadline && !paymentPaid
  );
  const identityStatus = profile?.identity_verification_status || 'unverified';
  const identityErrorCode = profile?.identity_verification_error_code || '';
  const identityVerified = identityStatus === 'verified';
  const returnCountdown = getReturnCountdown(currentRental?.return_date, currentRental?.return_time, now);
  const returnConfirmationSent = Boolean(
    currentRental?.status === 'return_initiated' ||
    messages.some((message) =>
      message.rental_id === currentRental?.id &&
      message.sender_role === 'client' &&
      String(message.message || '').includes('RETURN CONFIRMATION')
    )
  );
  const canManageTrip = ['active', 'overdue', 'return_initiated'].includes(currentRental?.status);
  const effectiveTripChangeChoice = tripChangeChoice || currentRental?.trip_change_intent || '';
  const showTripManager = Boolean(canManageTrip && (tripManagerOpen || returnConfirmationSent || pendingExtension || approvedUnpaidExtension));
  const showApprovedSwitchVehicle = Boolean(returnConfirmationSent && approvedSwitchExtension && approvedSwitchVehicle);
  const mobileStatusItems = [
    currentRental
      ? {
        key: 'rental',
        tone: currentRental.status === 'return_initiated' ? 'success' : 'info',
        title: currentRental.status === 'return_initiated' ? 'Return confirmation sent' : prettyStatus(currentRental.status),
        text: currentRental.status === 'return_initiated'
          ? 'Rent Me CT has been notified. We will inspect the vehicle and close this rental.'
          : `Current vehicle: ${currentRental.vehicles?.name || 'Selected vehicle'}. Return ${formatRentalDate(currentRental.return_date, currentRental.return_time)}.`,
      }
      : {
        key: 'setup',
        tone: hasCompletedRental ? 'success' : 'info',
        title: hasCompletedRental ? 'Ready for your next rental' : 'Finish your reservation',
        text: hasCompletedRental
          ? 'Your license and phone can stay on file. Choose new dates and upload insurance for the next rental.'
          : 'Complete the next guided step. We will keep each action clear as you go.',
      },
    latestExtensionStatus
      ? {
        key: 'extension',
        tone: latestExtensionStatus.status === 'activated'
          ? 'success'
          : latestExtensionStatus.status === 'rejected'
            ? 'danger'
            : latestExtensionStatus.status === 'approved_pending_payment'
              ? 'warning'
              : 'info',
        title: extensionStatusTitle(latestExtensionStatus),
        text: extensionStatusText(latestExtensionStatus),
      }
      : null,
    showApprovedSwitchVehicle
      ? {
        key: 'replacement',
        tone: 'warning',
        title: `${approvedSwitchVehicle.name} approved next`,
        text: 'Return confirmation is in. Payment is still required before this replacement activates.',
      }
      : null,
  ].filter(Boolean);
  const extensionWindow = getExtensionRequestWindow(currentRental, now);
  const vehicleStepCompleted = Boolean(currentRental?.vehicles || (!currentRental && selectedVehicle));
  const allGuidedStepsComplete = Boolean(contactStepCompleted && vehicleStepCompleted && identityVerified && licenseUploaded && insuranceUploaded && agreementSigned && paymentPaid);

  useEffect(() => {
    if (!adminBookingClaimed || !portalDataReady || !currentRental?.id) return;
    if (!contactStepCompleted) setPreviewCheckoutSection('contact');
    else if (!identityVerified) setPreviewCheckoutSection('identity');
    else if (!licenseUploaded || !insuranceUploaded) setPreviewCheckoutSection('documents');
    else if (!agreementSigned) setPreviewCheckoutSection('agreement');
    else setPreviewCheckoutSection('payment');
  }, [
    adminBookingClaimed,
    portalDataReady,
    currentRental?.id,
    contactStepCompleted,
    identityVerified,
    licenseUploaded,
    insuranceUploaded,
    agreementSigned,
  ]);

  useEffect(() => {
    if (!portalDataReady || !session?.user?.id || paymentReturnHandledRef.current) return undefined;
    const url = new URL(window.location.href);
    const paymentReturn = url.searchParams.get('payment');
    if (!paymentReturn) return undefined;

    paymentReturnHandledRef.current = true;
    url.searchParams.delete('payment');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setPreviewCheckoutSection('payment');
    setActiveTab('overview');

    if (paymentReturn === 'stripe_cancelled') {
      if (!bookingPreviewCheckoutMode) {
        setWizardStep(6);
        setWizardOpen(true);
      }
      notify('Stripe payment was not completed. Your progress is saved; press Pay With Stripe when you are ready.', 'error');
      return undefined;
    }

    if (paymentPaid) {
      notify('Payment confirmed successfully. Your booking is sealed.', 'success');
      return undefined;
    }

    paymentReturnPendingRef.current = true;
    if (!bookingPreviewCheckoutMode) {
      setWizardStep(6);
      setWizardOpen(true);
    }
    notify('Stripe returned successfully. Confirming your payment now…');

    const refreshOne = window.setTimeout(() => loadPortalData(session.user.id, { silent: true }), 1200);
    const refreshTwo = window.setTimeout(() => loadPortalData(session.user.id, { silent: true }), 3500);
    return () => {
      window.clearTimeout(refreshOne);
      window.clearTimeout(refreshTwo);
    };
  }, [portalDataReady, session?.user?.id, bookingPreviewCheckoutMode]);

  useEffect(() => {
    if (!paymentReturnPendingRef.current || !paymentPaid) return;
    paymentReturnPendingRef.current = false;
    setWizardOpen(false);
    notify('Payment confirmed successfully. Your booking is sealed.', 'success');
  }, [paymentPaid]);

  useEffect(() => {
    if (!checkoutExpired || !session?.user?.id) return;
    const bookingId = pendingBookingId || getBookingIdFromUrl();
    if (!bookingId && !currentRental?.id) return;
    const expiryKey = `${bookingId || 'direct'}:${currentRental?.id || 'pending'}`;
    if (checkoutExpiryHandledRef.current === expiryKey) return;
    checkoutExpiryHandledRef.current = expiryKey;

    supabase.rpc('expire_customer_checkout_hold', {
      p_booking_id: bookingId || null,
      p_rental_id: currentRental?.id || null,
    }).then(({ error }) => {
      if (error) {
        console.warn('Could not release expired checkout hold', error.message);
        return;
      }
      if (currentRental?.id) {
        setRentals((current) => current.map((rental) =>
          rental.id === currentRental.id ? { ...rental, status: 'cancelled' } : rental
        ));
        setFleetRentals((current) => current.filter((rental) => rental.id !== currentRental.id));
      }
      setCheckoutIntent(false);
      setCheckoutWizardStarted(false);
      setPendingBookingId('');
      setPendingVehicleId('');
      setPendingVehicleName('');
      setCheckoutExpiresAt(null);
      try {
        localStorage.removeItem('rentmect_pending_booking');
        localStorage.removeItem('rentMeCtBooking');
        localStorage.removeItem('pendingBooking');
        const url = new URL(window.location.href);
        url.searchParams.delete('booking');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      } catch {
        // The database release still succeeded even if local cleanup is blocked.
      }
      setWizardOpen(false);
      notify('Your 25-minute vehicle hold expired. Return to the fleet page to start a new booking.');
    });
  }, [checkoutExpired, session?.user?.id, pendingBookingId, currentRental?.id]);
function getBookingIdFromUrl() {
    return new URLSearchParams(window.location.search).get('booking') || '';
  }

  async function loadAdminBookingHandoff(token) {
    setAdminBookingError('');
    const { data, error } = await supabase.rpc('get_manual_booking_handoff', { p_token: token });
    if (error || !data?.rental_id || !data?.vehicle) {
      setAdminBookingError(error?.message || 'This booking link is invalid or expired. Ask Rent Me CT to resend it.');
      setCheckoutIntent(false);
      return;
    }

    setAdminBookingHandoff(data);
    setAdminBookingRentalId(data.rental_id);
    setCheckoutIntent(true);
    setPreviewPage('checkout');
    setReservationForm((current) => ({
      ...current,
      vehicleId: data.vehicle_id,
      pickupDate: data.pickup_date,
      returnDate: data.return_date,
      pickupTime: data.pickup_time || '9:00 AM',
      returnTime: data.return_time || '9:00 AM',
    }));
    setVehicles((current) => current.some((vehicle) => vehicle.id === data.vehicle.id)
      ? current
      : [data.vehicle, ...current]);
  }

  function applyBookingDataToPortal(bookingData) {
    const today = getTodayDateInputValue();
    const rawPickupDate = bookingData.pickupDate || bookingData.pickup_date || '';
    const pickupDate = !rawPickupDate || rawPickupDate < today ? today : rawPickupDate;
    const rawReturnDate = bookingData.returnDate || bookingData.return_date || '';
    const minReturnDate = getNextDateInputValue(pickupDate);
    const returnDate = !rawReturnDate || rawReturnDate < minReturnDate ? minReturnDate : rawReturnDate;

    const normalizedBooking = {
      pickupDate,
      returnDate,
      pickupTime: bookingData.pickupTime || bookingData.pickup_time || '9:00 AM',
      returnTime: bookingData.returnTime || bookingData.return_time || '9:00 AM',
      selectedVehicle:
        bookingData.selectedVehicle ||
        bookingData.selected_vehicle_name ||
        bookingData.vehicleName ||
        bookingData.vehicle_name ||
        '',
      selectedVehicleId:
        bookingData.selectedVehicleId ||
        bookingData.selected_vehicle_id ||
        bookingData.vehicleId ||
        bookingData.vehicle_id ||
        '',
      expiresAt: bookingData.expiresAt || bookingData.expires_at || '',
      status: bookingData.status || 'pending',
    };

    const hasBookingData =
      normalizedBooking.pickupDate ||
      normalizedBooking.returnDate ||
      normalizedBooking.selectedVehicle ||
      normalizedBooking.selectedVehicleId;

    if (!hasBookingData) return;

    setCheckoutIntent(true);
    if (normalizedBooking.expiresAt) setCheckoutExpiresAt(normalizedBooking.expiresAt);
    setReservationForm((prev) => ({
      ...prev,
      pickupDate: normalizedBooking.pickupDate || prev.pickupDate,
      returnDate: normalizedBooking.returnDate || prev.returnDate,
      pickupTime: normalizedBooking.pickupTime || prev.pickupTime,
      returnTime: normalizedBooking.returnTime || prev.returnTime,
    }));

    if (normalizedBooking.selectedVehicle) {
      setPendingVehicleName(normalizedBooking.selectedVehicle);
    }

    if (normalizedBooking.selectedVehicleId) {
      setPendingVehicleId(normalizedBooking.selectedVehicleId);
      setReservationForm((prev) => ({
        ...prev,
        vehicleId: normalizedBooking.selectedVehicleId,
      }));
    }

    localStorage.setItem('rentmect_pending_booking', JSON.stringify(normalizedBooking));
  }

  async function loadPendingBookingFromDatabase(bookingId, currentSession) {
    if (!bookingId) return;

    try {
      const { data, error } = await supabase.rpc('get_website_pending_booking', {
        p_booking_id: bookingId,
      });
      const pendingBooking = data?.[0];

      if (error) {
        notify(error.message || 'Could not load the saved booking.');
        loadSavedBookingFromWebsite();
        return;
      }

      if (!pendingBooking) return;

      const handoffExpiresAt = new URLSearchParams(window.location.search).get('holdExpires') || '';
      applyBookingDataToPortal({
        ...pendingBooking,
        expires_at: pendingBooking.expires_at || handoffExpiresAt,
      });

      if (pendingBooking.vehicle_id) {
        const { data: pendingVehicle } = await supabase
          .from('vehicles')
          .select('*')
          .eq('id', pendingBooking.vehicle_id)
          .maybeSingle();
        if (pendingVehicle) {
          setVehicles((current) => current.some((vehicle) => vehicle.id === pendingVehicle.id)
            ? current
            : [pendingVehicle, ...current]);
        }
      }

      if (currentSession?.user?.id) {
        await supabase.rpc('claim_customer_pending_booking', {
          p_booking_id: bookingId,
          p_vehicle_id: pendingBooking.vehicle_id || pendingVehicleId || reservationForm.vehicleId || null,
        });
      }
    } catch (error) {
      notify(error.message || 'Failed to load pending booking.');
      loadSavedBookingFromWebsite();
    }
  }

function loadSavedBookingFromWebsite() {
    try {
      const saved =
        localStorage.getItem('rentmect_pending_booking') ||
        localStorage.getItem('rentMeCtBooking') ||
        localStorage.getItem('pendingBooking');

      const params = new URLSearchParams(window.location.search);
      const parsed = saved ? JSON.parse(saved) : {};

      applyBookingDataToPortal({
        pickupDate: params.get('pickupDate') || parsed.pickupDate || parsed.pickup_date || '',
        returnDate: params.get('returnDate') || parsed.returnDate || parsed.return_date || '',
        pickupTime: params.get('pickupTime') || parsed.pickupTime || parsed.pickup_time || '9:00 AM',
        returnTime: params.get('returnTime') || parsed.returnTime || parsed.return_time || '9:00 AM',
        selectedVehicle:
          params.get('selectedVehicle') ||
          parsed.selectedVehicle ||
          parsed.vehicleName ||
          parsed.vehicle_name ||
          '',
        selectedVehicleId:
          params.get('selectedVehicleId') ||
          params.get('vehicleId') ||
          parsed.selectedVehicleId ||
          parsed.selected_vehicle_id ||
          parsed.vehicleId ||
          parsed.vehicle_id ||
          '',
      });
    } catch (error) {
      notify(error.message || 'Could not load saved booking.');
    }
  }

  async function loadPortalData(userId, { silent = false, stripeReturnRetry = false } = {}) {
    if (!silent) setLoading(true);
    setPortalHealth((current) => ({ ...current, refreshing: true }));
    let vehiclesQuery = supabase.from('vehicles').select('*');
    vehiclesQuery = BOOKING_FLOW_TEST_ENABLED
      ? vehiclesQuery.or(`published.eq.true,id.eq.${BOOKING_FLOW_TEST_VEHICLE_ID}`)
      : vehiclesQuery.eq('published', true);
    vehiclesQuery = vehiclesQuery.order('created_at', { ascending: false });

    const [
      profileResult,
      vehiclesResult,
      rentalsResult,
      documentsResult,
      messagesResult,
      reportsResult,
      extensionsResult,
      emergencyExceptionsResult,
      fleetRentalsResult,
      serviceFeesResult,
      under25PricingResult,
      rentalChargesResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      vehiclesQuery,
      supabase
        .from('rentals')
        .select('*, vehicles(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('rental_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('rental_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('vehicle_reports')
        .select('*, rentals(*, vehicles(*))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('rental_extension_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase.rpc('get_my_rental_emergency_exceptions'),
      supabase.rpc('get_vehicle_booking_blocks'),
      supabase
        .from('service_fees')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('under_25_pricing_settings')
        .select('*')
        .eq('id', true)
        .maybeSingle(),
      supabase
        .from('rental_charge_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    const dataErrors = [
      ['Profile', profileResult.error],
      ['Fleet', vehiclesResult.error],
      ['Rentals', rentalsResult.error],
      ['Documents', documentsResult.error],
      ['Messages', messagesResult.error],
      ['Reports', reportsResult.error],
      ['Extensions', extensionsResult.error],
      ['Rental exceptions', emergencyExceptionsResult.error],
      ['Availability', fleetRentalsResult.error],
      ['Fees', serviceFeesResult.error],
      ['Age-based pricing', under25PricingResult.error],
      ['Additional charges', rentalChargesResult.error],
    ].filter(([, error]) => Boolean(error)).map(([label, error]) => ({
      label,
      message: userFacingPortalError(error, `${label} could not refresh.`),
    }));
    const transientErrors = stripeReturnRetry
      ? dataErrors.filter((item) => isTransientPortalError(item.message))
      : [];
    const visibleDataErrors = stripeReturnRetry
      ? dataErrors.filter((item) => !isTransientPortalError(item.message))
      : dataErrors;

    if (profileResult.data) {
      const legalName = splitLegalName(profileResult.data.full_name);
      setProfile(profileResult.data);
      setProfileForm({
        first_name: legalName.firstName,
        last_name: legalName.lastName,
        full_name: profileResult.data.full_name || '',
        date_of_birth: profileResult.data.date_of_birth || '',
        phone: profileResult.data.phone || '',
        intended_vehicle_use: profileResult.data.intended_vehicle_use || '',
        email_marketing_opt_in: Boolean(profileResult.data.email_marketing_opt_in && !profileResult.data.email_marketing_unsubscribed_at),
        sms_transactional_opt_in: Boolean(profileResult.data.sms_transactional_opt_in && !profileResult.data.sms_transactional_opted_out_at),
      });
      setConfirmedBirthDate(profileResult.data.date_of_birth || '');
      setPhoneVerified(Boolean(profileResult.data.phone_verified));
    }

    if (vehiclesResult.data) setVehicles(vehiclesResult.data);
    if (rentalsResult.data) setRentals(rentalsResult.data);
    if (documentsResult.data) setDocuments(documentsResult.data);
    if (messagesResult.data) setMessages(messagesResult.data);
    if (reportsResult.data) setReports(reportsResult.data);
    if (extensionsResult.data) setExtensionRequests(extensionsResult.data);
    if (emergencyExceptionsResult.data) setEmergencyExceptions(emergencyExceptionsResult.data);
    if (fleetRentalsResult.data) setFleetRentals(fleetRentalsResult.data);
    if (serviceFeesResult.data) setServiceFees(serviceFeesResult.data);
    if (under25PricingResult.data) setUnder25Pricing(under25PricingResult.data);
    if (rentalChargesResult.data) setRentalCharges(rentalChargesResult.data);

    setPortalHealth({
      refreshing: false,
      errors: visibleDataErrors,
      lastUpdated: new Date().toISOString(),
    });
    setPortalDataReady(true);
    if (!silent) setLoading(false);
    if (transientErrors.length) {
      window.setTimeout(() => {
        loadPortalData(userId, { silent: true });
      }, 900);
    }
  }

  async function handleAuth(event) {
    event.preventDefault();
    setMessage('');
    const email = authForm.email.trim().toLowerCase();
    if (!email) {
      setMessage('Enter your email to continue.');
      return;
    }

    setEmailAuthBusy(true);
    const redirectUrl = new URL(window.location.href);
    redirectUrl.hash = '';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: !adminBookingToken,
        emailRedirectTo: redirectUrl.toString(),
        data: {
          pending_booking: JSON.parse(localStorage.getItem('rentmect_pending_booking') || '{}'),
          pending_booking_id: pendingBookingId || getBookingIdFromUrl() || '',
        },
      },
    });
    setEmailAuthBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setEmailOtpSent(true);
    setMessage(`Verification email sent to ${email}. Enter the one-time code from that email. If it is not in your inbox, open your SPAM folder now.`);
  }

  async function verifyEmailOtp(event) {
    event.preventDefault();
    const email = authForm.email.trim().toLowerCase();
    const token = emailOtp.trim();
    if (!email || !token) {
      setMessage('Enter the one-time code from your email.');
      return;
    }

    setEmailAuthBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });

    if (error) {
      setEmailAuthBusy(false);
      setMessage(error.message);
      return;
    }

    if (adminBookingToken) {
      const { data: claimed, error: claimError } = await supabase.rpc('claim_manual_booking_handoff', {
        p_token: adminBookingToken,
      });
      if (claimError || !claimed?.rental_id) {
        await supabase.auth.signOut();
        setSession(null);
        setAdminBookingClaimed(false);
        setEmailOtp('');
        setEmailOtpSent(false);
        setEmailAuthBusy(false);
        setMessage(claimError?.message || 'That email is not attached to this booking. Use the email that received the link.');
        return;
      }
      setAdminBookingHandoff(claimed);
      setAdminBookingRentalId(claimed.rental_id);
      setAdminBookingClaimed(true);
      setPreviewPage('checkout');
      const guidedUrl = new URL(window.location.href);
      guidedUrl.searchParams.delete('adminBooking');
      guidedUrl.searchParams.set('adminRental', claimed.rental_id);
      guidedUrl.searchParams.set('adminPath', claimed.customer_path === 'returning' ? 'returning' : 'new');
      window.history.replaceState({}, '', `${guidedUrl.pathname}${guidedUrl.search}${guidedUrl.hash}`);
    }
    setEmailAuthBusy(false);
    if (data?.session) setSession(data.session);
    setMessage('Email verified. Opening your booking checklist…');
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    if (adminBookingRentalId && !adminBookingToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete('adminRental');
      url.searchParams.delete('adminPath');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      setAdminBookingHandoff(null);
      setAdminBookingRentalId('');
      setAdminBookingClaimed(false);
      setCheckoutIntent(false);
    }
  }

  async function saveProfileDetails(showSuccess = true) {
    if (!session?.user?.id) return;

    if (!hasFirstAndLastName(profileForm.full_name) || !profileForm.intended_vehicle_use.trim()) {
      notify('Add your full legal first and last name exactly as shown on your government ID, plus the intended vehicle use.');
      return null;
    }

    if (!isValidBirthDate(profileForm.date_of_birth)) {
      notify('Enter a real date of birth. Renters must be at least 21.');
      return null;
    }
    if (!birthDateConfirmed) {
      notify('Confirm that the birthday exactly matches your government ID.');
      return null;
    }
    const { data, error } = await supabase.rpc('save_customer_profile_contact_details', {
      p_full_name: profileForm.full_name,
      p_phone: profileForm.phone,
      p_address: null,
      p_date_of_birth: profileForm.date_of_birth,
      p_intended_vehicle_use: profileForm.intended_vehicle_use.trim(),
    });

    if (error) {
      notify(userFacingPortalError(error, 'Your renter details could not be saved. Please try again.'));
      return null;
    }

    if (!data) {
      notify('Profile saved, but the updated profile was not returned.');
      return null;
    }

    const { data: preferenceData, error: preferenceError } = await supabase.rpc('set_email_marketing_preference', {
      p_opt_in: Boolean(profileForm.email_marketing_opt_in),
    });

    let savedProfile = preferenceError ? data : (preferenceData || data);
    if (preferenceError) {
      setProfileForm((current) => ({ ...current, email_marketing_opt_in: false }));
      notify(`Your contact details were saved, but the optional email preference was not: ${preferenceError.message}`);
    }

    const { data: smsPreferenceData, error: smsPreferenceError } = await supabase.rpc('set_sms_transactional_preference', {
      p_opt_in: Boolean(profileForm.sms_transactional_opt_in),
      p_source: SMS_CONSENT_SOURCE,
      p_consent_version: SMS_CONSENT_VERSION,
      p_consent_text: SMS_CONSENT_TEXT,
    });

    if (smsPreferenceData) savedProfile = smsPreferenceData;
    if (smsPreferenceError) {
      notify(`Your contact details were saved, but the SMS preference was not: ${smsPreferenceError.message}`);
    }

    setProfile(savedProfile);
    setConfirmedBirthDate(savedProfile.date_of_birth || profileForm.date_of_birth);
    setPhoneVerified(Boolean(savedProfile.phone_verified));
    if (showSuccess && !preferenceError && !smsPreferenceError) notify('Profile and communication preferences saved.');
    return savedProfile;
  }

  async function saveProfile(event) {
    if (event) event.preventDefault();
    return saveProfileDetails(true);
  }

  async function sendPhoneCode() {
  const missingContactFields = [
    !hasFirstAndLastName(profileForm.full_name) && 'full legal first and last name exactly as shown on your government ID',
    !isValidBirthDate(profileForm.date_of_birth) && 'valid date of birth',
    isValidBirthDate(profileForm.date_of_birth) && !birthDateConfirmed && 'birthday confirmation',
    !profileForm.intended_vehicle_use.trim() && 'intended vehicle use',
    !profileForm.phone.trim() && 'phone number',
  ].filter(Boolean);

  if (missingContactFields.length) {
    notify(`Complete these contact fields before requesting a code: ${missingContactFields.join(', ')}.`);
    return;
  }

  const savedProfile = await saveProfileDetails(false);
  if (!savedProfile) return;

  setSendingCode(true);
  try {
    const { data, error } = await supabase.functions.invoke('send-phone-code', {
      body: { phone: normalizeUSPhone(profileForm.phone) },
    });
    if (error) {
      notify(await functionInvokeErrorMessage(error, 'Failed to send verification code.'));
      return;
    }
    if (data?.sent === false || data?.error) {
      notify(data.error || 'Failed to send verification code.');
      return;
    }
    notify('Verification code sent.');
  } catch (error) {
    notify(error?.message || 'Failed to send verification code.');
  } finally {
    setSendingCode(false);
  }
}

async function verifyPhoneCode() {
  if (!session?.user?.id) return;

  if (!profileForm.phone.trim()) {
    notify('Add your phone number first.');
    return;
  }

  if (!phoneCode.trim()) {
    notify('Enter the verification code.');
    return;
  }

  setVerifyingCode(true);
  try {
    const { data, error } = await supabase.functions.invoke('check-phone-code', {
      body: {
        phone: normalizeUSPhone(profileForm.phone),
        code: phoneCode.trim(),
      },
    });
    if (error) {
      notify(await functionInvokeErrorMessage(error, 'Phone verification failed.'));
      return;
    }

    if (data?.verified === true || data?.status === 'approved') {
      setPhoneVerified(true);
      setPhoneCode('');

      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (profileError) {
        notify('Phone verified. Refresh the page if the verified badge does not appear.');
        return;
      }
      if (updatedProfile) setProfile(updatedProfile);
      notify('Phone verified.');
      return;
    }
    notify(data?.error || 'That code is invalid or expired. Request a new code and try again.');
  } catch (error) {
    notify(error?.message || 'Phone verification failed. Please try again.');
  } finally {
    setVerifyingCode(false);
  }
}

  async function continuePreviewContact() {
    const savedProfile = await saveProfileDetails(false);
    if (!savedProfile) return;
    if (!savedProfile.phone_verified) {
      notify('Verify your phone number to continue.');
      return;
    }
    if (identityCorrectionTarget) {
      setIdentityCorrectionTarget('');
      setPreviewCheckoutSection('identity');
      notify('Your corrected identity details are saved. Your email and phone remain verified.', 'success');
      return;
    }
    const rental = currentRental || (await createReservationIfNeeded());
    if (!rental?.id) return;
    setPreviewCheckoutSection('identity');
  }

  async function createReservationIfNeeded() {
    if (checkoutExpired) {
      notify('Your 25-minute vehicle hold expired. Return to the fleet page to start a new booking.');
      return null;
    }

    if (!session?.user?.id) return null;

    if (currentRental) return currentRental;

    if (!isValidBirthDate(profileForm.date_of_birth)) {
      notify('Add and save your date of birth before creating a reservation.');
      setActiveTab('profile');
      return null;
    }

    if (!selectedVehicle) {
      notify('Choose a vehicle first.');
      setWizardStep(1);
      return null;
    }

    if (!reservationForm.pickupDate || !reservationForm.returnDate || !reservationForm.pickupTime || !reservationForm.returnTime) {
      notify('Choose pickup date, return date, pickup time, and return time before continuing.');
      setWizardStep(1);
      return null;
    }

    const bookingId = pendingBookingId || getBookingIdFromUrl();
    if (!bookingId && !isVehicleAvailableForDates(selectedVehicle, reservationForm, fleetRentals, currentRental?.id)) {
      notify('This vehicle is not available for those dates. Please choose another vehicle or adjust your rental period.');
      setReservationForm((prev) => ({ ...prev, vehicleId: '' }));
      setWizardStep(1);
      return null;
    }

    if (!estimate || estimate.invalid) {
      notify('Return date must be after pickup date.');
      return null;
    }

    setReservationSaving(true);
    const reservationParams = {
      p_pickup_date: reservationForm.pickupDate,
      p_return_date: reservationForm.returnDate,
      p_pickup_time: reservationForm.pickupTime,
      p_return_time: reservationForm.returnTime,
    };
    const { data: lockedRental, error } = bookingFlowTestMode
      ? await supabase.rpc('create_booking_flow_test_rental', reservationParams)
      : bookingId
        ? await supabase.rpc('convert_website_hold_to_rental', {
          p_booking_id: bookingId,
          p_customer_phone: profileForm.phone || null,
        })
        : await supabase.rpc('create_rental_with_lock', {
          p_vehicle_id: selectedVehicle.id,
          ...reservationParams,
        });
    setReservationSaving(false);

    if (error) {
      notify(error.message);
      return null;
    }

    const { data: reloadedRental, error: reloadError } = await supabase
      .from('rentals')
      .select('*, vehicles(*)')
      .eq('id', lockedRental.id)
      .single();

    const data = reloadError
      ? { ...lockedRental, vehicles: selectedVehicle }
      : reloadedRental;

    const rentalData = data;
    if (rentalData.checkout_expires_at) setCheckoutExpiresAt(rentalData.checkout_expires_at);
    if (String(rentalData.status || '').toLowerCase() === 'cancelled') {
      notify('Your 25-minute vehicle hold expired. Return to the fleet page to start a new booking.');
      return null;
    }

    setRentals([rentalData, ...rentals]);
    setFleetRentals((prev) => [{
      id: rentalData.id,
      vehicle_id: rentalData.vehicle_id,
      pickup_date: rentalData.pickup_date,
      return_date: rentalData.return_date,
      pickup_time: rentalData.pickup_time,
      return_time: rentalData.return_time,
      status: rentalData.status,
    }, ...prev]);

    try {
      localStorage.removeItem('rentmect_pending_booking');
      localStorage.removeItem('rentMeCtBooking');
      localStorage.removeItem('pendingBooking');
    } catch {
      // ignore localStorage cleanup issue
    }

    return rentalData;
  }

  async function changeCheckoutDatesOrVehicle() {
    const bookingId = pendingBookingId || getBookingIdFromUrl();
    const abandonToken = new URLSearchParams(window.location.search).get('abandonToken') || '';
    if (bookingId || currentRental?.id) {
      setReservationSaving(true);
      const { error } = await supabase.rpc('abandon_website_checkout', {
        p_booking_id: bookingId || null,
        p_abandon_token: abandonToken || null,
        p_rental_id: currentRental?.id || null,
      });
      setReservationSaving(false);
      if (error) {
        notify(error.message || 'Your current checkout could not be released. Please retry.');
        return;
      }
    }

    try {
      localStorage.removeItem('rentmect_pending_booking');
      localStorage.removeItem('rentMeCtBooking');
      localStorage.removeItem('pendingBooking');
    } catch {
      // The server-side hold is already released.
    }
    navigateToFleet(reservationForm);
  }

  function startNewReservation() {
    setReservationForm({
      vehicleId: '',
      pickupDate: getTodayDateInputValue(),
      returnDate: getNextDateInputValue(getTodayDateInputValue()),
      pickupTime: '9:00 AM',
      returnTime: '9:00 AM',
    });
    setPendingVehicleName('');
    setPendingVehicleId('');
    setCheckoutIntent(false);
    setCheckoutWizardStarted(false);
    setAgreementChecked(false);
    setSignatureName(profileForm.full_name || '');
    setActiveTab('overview');
    setWizardStep(1);
    setWizardOpen(true);
    notify('Start a new reservation by choosing dates and a vehicle.');
  }

  async function uploadDocument(event, documentType, { createNew = false, extensionRequestId = null } = {}) {
    const file = event.target.files?.[0];
    if (!file || !session?.user?.id) return;
    const uploadBusyKey = extensionRequestId ? 'extensionInsurance' : documentType;
    const validationError = validateDocumentFile(file);
    if (validationError) {
      notify(validationError, 'error');
      event.target.value = '';
      return;
    }

    setDocumentUploadBusy((current) => ({ ...current, [uploadBusyKey]: true }));
    try {
      const rental = currentRental || (await createReservationIfNeeded());

      if (!rental?.id) {
        notify('Create a reservation before uploading documents.');
        return;
      }

    const existingDocument = createNew
      ? null
      : documentType === 'license'
        ? latestDocument(documents, 'license')
        : latestDocument(documents.filter((document) => document.rental_id === rental.id), 'insurance');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const existingPath = existingDocument?.file_path || existingDocument?.storage_path || existingDocument?.path;
    const path = existingPath || `${session.user.id}/${documentType}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('rental-documents')
      .upload(path, file, { upsert: Boolean(existingDocument) });

    if (uploadError) {
      notify(uploadError.message);
      return;
    }

    if (existingDocument?.id) {
      const { data, error } = await supabase.rpc('replace_customer_rental_document', {
        p_document_id: existingDocument.id,
        p_file_path: path,
      });

      if (error) {
        notify(error.message);
        return;
      }

      const nextDocuments = documents.map((item) => (item.id === data.id ? data : item));
      setDocuments(nextDocuments);
      await syncRentalDocumentReviewStatus(rental, nextDocuments);
      await maybeMarkReadyForPickup(rental, nextDocuments);
      notify(`${documentTypeLabel(documentType)} replaced.`);
      if (event.target) event.target.value = '';
      if (wizardOpen && documentType === 'license' && wizardStep === 3) {
        setWizardStep(4);
      } else if (wizardOpen && documentType === 'insurance' && wizardStep === 4) {
        setWizardStep(5);
      }
      return;
    }

    const { data, error } = await supabase
      .from('rental_documents')
      .insert({
        user_id: session.user.id,
        rental_id: rental.id,
        document_type: documentType,
        file_path: path,
        status: 'pending_review',
        extension_request_id: extensionRequestId || null,
      })
      .select()
      .single();

    if (error) {
      notify(error.message);
      return;
    }

    const nextDocuments = [data, ...documents];
    setDocuments(nextDocuments);
    await syncRentalDocumentReviewStatus(rental, nextDocuments);
    await maybeMarkReadyForPickup(rental, nextDocuments);
    notify(`${documentTypeLabel(documentType)} uploaded.`);

    if (wizardOpen && documentType === 'license' && wizardStep === 3) {
      setWizardStep(4);
    } else if (wizardOpen && documentType === 'insurance' && wizardStep === 4) {
      setWizardStep(5);
    }
      if (event.target) event.target.value = '';
    } finally {
      setDocumentUploadBusy((current) => ({ ...current, [uploadBusyKey]: false }));
    }
  }

  async function openDocument(document) {
    const directUrl = document.file_url || document.document_url || document.public_url || document.url;
    const path = document.file_path || document.storage_path || document.path;

    if (directUrl) {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!path) {
      notify('No document file path found for this upload.');
      return;
    }

    const { data, error } = await supabase.storage
      .from('rental-documents')
      .createSignedUrl(path, 60 * 5);

    if (error) {
      notify(error.message);
      return;
    }

    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function replaceDocument(event, document) {
    const file = event.target.files?.[0];
    if (!file || !session?.user?.id || !document?.id) return;
    const validationError = validateDocumentFile(file);
    if (validationError) {
      notify(validationError, 'error');
      event.target.value = '';
      return;
    }

    const busyKey = `replace:${document.id}`;
    setDocumentUploadBusy((current) => ({ ...current, [busyKey]: true }));
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const existingPath = document.file_path || document.storage_path || document.path;
      const path = existingPath || `${session.user.id}/${document.document_type}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('rental-documents')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      notify(uploadError.message);
      return;
    }

    const { data, error } = await supabase.rpc('replace_customer_rental_document', {
      p_document_id: document.id,
      p_file_path: path,
    });

    if (error) {
      notify(error.message);
      return;
    }

    if (!data) {
      notify('Document replaced in storage, but the database row was not returned. Run the rental_documents table RLS policies.');
      return;
    }

    const nextDocuments = documents.map((item) => (item.id === data.id ? data : item));
    setDocuments(nextDocuments);
    await syncRentalDocumentReviewStatus(currentRental, nextDocuments);
    await maybeMarkReadyForPickup(currentRental, nextDocuments);
      notify(`${documentTypeLabel(document.document_type)} replaced and sent for review.`);
      if (event.target) event.target.value = '';
    } finally {
      setDocumentUploadBusy((current) => ({ ...current, [busyKey]: false }));
    }
  }

  async function syncRentalDocumentReviewStatus(rental, nextDocuments) {
    if (!rental?.id || !['documents_needed', 'document_review'].includes(rental.status)) return;

    const rentalDocuments = nextDocuments.filter((document) => document.rental_id === rental.id);
    const hasLicense = isUsableDocument(latestDocument(nextDocuments, 'license'));
    const hasInsurance = isUsableDocument(latestDocument(rentalDocuments, 'insurance'));

    if (!hasLicense || !hasInsurance) return;

    const { data: updatedRental, error } = await supabase.rpc('sync_customer_rental_document_review_status', {
      p_rental_id: rental.id,
    });

    if (error) {
      notify(error.message);
      return;
    }

    const { data, error: reloadError } = await supabase
      .from('rentals')
      .select('*, vehicles(*)')
      .eq('id', updatedRental.id)
      .single();

    if (reloadError) {
      notify(reloadError.message);
      return;
    }

    setRentals((prev) => prev.map((item) => (item.id === data.id ? data : item)));
    setFleetRentals((prev) => prev.map((item) => (item.id === data.id ? { ...item, status: data.status } : item)));
    notify('Documents uploaded. Your rental is now in document review.', 'success');
  }

  async function maybeMarkReadyForPickup(rentalOverride = currentRental, nextDocuments = documents) {
    if (!rentalOverride?.id) return;
    if (rentalOverride.status === 'ready_for_pickup') return;
    if (!['documents_needed', 'document_review', 'approved'].includes(rentalOverride.status)) return;

    const rentalDocuments = nextDocuments.filter((document) => document.rental_id === rentalOverride.id);
    const ready =
      identityVerified &&
      isApprovedDocument(latestDocument(nextDocuments, 'license')) &&
      isApprovedDocument(latestDocument(rentalDocuments, 'insurance')) &&
      Boolean(rentalOverride.agreement_signed) &&
      rentalOverride.payment_status === 'paid';

    if (!ready) return;

    const { data: updatedRental, error } = await supabase.rpc('mark_customer_rental_ready_for_pickup_if_eligible', {
      p_rental_id: rentalOverride.id,
    });

    if (error) {
      notify(error.message);
      return;
    }

    const { data, error: reloadError } = await supabase
      .from('rentals')
      .select('*, vehicles(*)')
      .eq('id', updatedRental.id)
      .single();

    if (reloadError) {
      notify(reloadError.message);
      return;
    }

    setRentals((prev) => prev.map((item) => (item.id === data.id ? data : item)));
    setFleetRentals((prev) => prev.map((item) => (item.id === data.id ? { ...item, status: data.status } : item)));
    notify('All steps complete. Your rental is ready for pickup.', 'success');
  }

  async function signAgreement() {
    if (!session?.user?.id) return;

    const rental = currentRental || (await createReservationIfNeeded());

    if (!rental?.id) {
      notify('Create a reservation first.');
      return;
    }

    if (!agreementChecked) {
      notify('Check the agreement box first.');
      return;
    }

    if (!signatureName.trim()) {
      notify('Type your full legal name as your signature.');
      return;
    }

    if (!signatureImageData) {
      notify('Draw your signature in the signature box.');
      return;
    }

    setAgreementSaving(true);
    try {
      const snapshot = buildAgreementWithDetails({
        agreementText: AGREEMENT_TEXT,
        profile: profileForm,
        email: userEmail,
        vehicle: selectedVehicle || rental?.vehicles,
        reservation: {
          pickupDate: reservationForm.pickupDate || rental.pickup_date,
          returnDate: reservationForm.returnDate || rental.return_date,
          pickupTime: reservationForm.pickupTime || rental.pickup_time,
          returnTime: reservationForm.returnTime || rental.return_time,
        },
        rental,
        signatureName: signatureName.trim(),
        signatureImageData,
      });
      const agreementHash = await sha256(snapshot);

      const { data: signedRental, error } = await supabase.rpc('sign_rental_agreement', {
        p_rental_id: rental.id,
        p_signature_name: signatureName.trim(),
        p_agreement_version: AGREEMENT_VERSION,
        p_agreement_snapshot: snapshot,
        p_agreement_hash: agreementHash,
        p_user_agent: navigator.userAgent,
        p_signature_data: signatureImageData,
      });

      if (error) throw error;
      const signedRentalId = typeof signedRental === 'string' ? signedRental : signedRental?.id;
      if (!signedRentalId) throw new Error('The signed agreement was saved, but its rental reference was missing.');

      const { data: updatedRental, error: reloadError } = await supabase
        .from('rentals')
        .select('*, vehicles(*)')
        .eq('id', signedRentalId)
        .single();

      if (reloadError) throw reloadError;

      setRentals((prev) => prev.map((r) => (r.id === updatedRental.id ? updatedRental : r)));
      setAgreementModalOpen(false);
      setWizardReminder(null);
      setPreviewCheckoutSection('payment');
      if (wizardOpen) setWizardStep(6);
      setActiveTab('overview');
      notify('Agreement signed successfully. Payment is the final step.', 'success');
      await maybeMarkReadyForPickup(updatedRental);
    } catch (error) {
      console.error('Agreement signing failed', error);
      notify(error?.message || 'The agreement could not be signed. Your portal is still available; please try again.', 'error');
    } finally {
      setAgreementSaving(false);
    }
  }

  async function sendSupportMessage(event) {
    event.preventDefault();

    const text = supportText.trim();
    if (!text || !session?.user?.id || supportSending) return;

    setSupportSending(true);
    try {
      const { data, error } = await supabase
        .from('rental_messages')
        .insert({
          user_id: session.user.id,
          rental_id: currentRental?.id || null,
          sender_role: 'client',
          message: text,
          read_by_admin: false,
          read_by_client: true,
        })
        .select()
        .single();

      if (error) {
        notify(error.message);
        return;
      }

      setMessages((current) => [...current, data]);
      setSupportText('');
    } finally {
      setSupportSending(false);
    }
  }

  async function confirmReturn() {
    if (!session?.user?.id || !currentRental?.id) {
      notify('No active rental to return.');
      return;
    }

    const alreadySent = messages.some((message) =>
      message.rental_id === currentRental.id &&
      message.sender_role === 'client' &&
      String(message.message || '').includes('RETURN CONFIRMATION')
    );

    if (alreadySent) {
      notify('Return confirmation has already been sent to Rent Me CT.');
      return;
    }

    if (pendingSameVehicleExtension) {
      notify('Return confirmation is locked while Rent Me CT decides your extension request.');
      return;
    }

    if (!returnCountdown.canConfirm) {
      notify(`Return confirmation unlocks at ${formatRentalDate(currentRental.return_date, currentRental.return_time)}.`);
      return;
    }

    setReturnSaving(true);
    const { data: messageData, error } = await supabase
      .from('rental_messages')
      .insert({
        user_id: session.user.id,
        rental_id: currentRental.id,
        sender_role: 'client',
        message: `RETURN CONFIRMATION: Customer reports the vehicle was returned to ${RENTMECT_ADDRESS} on ${new Date().toLocaleString()}. Please inspect, verify mileage/fuel/condition, then mark the rental completed.`,
        read_by_admin: false,
        read_by_client: true,
      })
      .select()
      .single();

    if (error) {
      setReturnSaving(false);
      notify(error.message);
      return;
    }

    const { data: returnedRental, error: statusError } = await supabase.rpc('initiate_customer_rental_return', {
      p_rental_id: currentRental.id,
    });
    setReturnSaving(false);

    if (statusError) {
      notify(statusError.message);
      return;
    }

    const { data: updatedRental, error: reloadError } = await supabase
      .from('rentals')
      .select('*, vehicles(*)')
      .eq('id', returnedRental.id)
      .single();

    if (reloadError) {
      notify(reloadError.message);
      return;
    }

    setMessages([...messages, messageData]);
    setRentals((prev) => prev.map((item) => (item.id === updatedRental.id ? updatedRental : item)));
    setFleetRentals((prev) => prev.map((item) => (item.id === updatedRental.id ? { ...item, status: updatedRental.status } : item)));
    notify('Return initiated. Rent Me CT will inspect and close out your rental.', 'success');
  }

  async function chooseTripChange(choice) {
    if (!currentRental?.id || !['return', 'extend', 'exchange'].includes(choice)) return;
    setTripChangeChoice(choice);
    if (choice === 'extend') setExtensionMode('extend');
    if (choice === 'exchange') setExtensionMode('switch');

    const { data, error } = await supabase.rpc('set_customer_trip_change_intent', {
      p_rental_id: currentRental.id,
      p_intent: choice,
    });
    if (error) {
      notify(error.message);
      return;
    }
    if (data) {
      setRentals((current) => current.map((rental) =>
        rental.id === data.id ? { ...rental, trip_change_intent: data.trip_change_intent } : rental
      ));
    }
  }

  async function requestExtension(event) {
    event.preventDefault();
    if (!currentRental?.id) return;
    if (!extensionWindow.open) {
      notify(extensionWindow.message);
      return;
    }

    setExtensionSaving(true);
    const previewRpc = extensionMode === 'switch'
      ? 'preview_customer_vehicle_switch_continuation'
      : 'preview_customer_rental_extension';
    const { data: preview, error: previewError } = await supabase.rpc(previewRpc, {
      p_rental_id: currentRental.id,
      p_requested_return_date: extensionForm.returnDate,
      p_requested_return_time: extensionForm.returnTime,
    });

    if (previewError) {
      setExtensionSaving(false);
      notify(previewError.message);
      return;
    }

    setExtensionPreview(preview);

    if (extensionMode === 'switch') {
      setExtensionSaving(false);
      notify(preview?.recommended_vehicles?.length
        ? 'Choose an available replacement vehicle below to send the switch request.'
        : 'No replacement vehicle is available for that continuation window right now.');
      return;
    }

    if (!preview?.same_vehicle_available) {
      setExtensionSaving(false);
      notify('That vehicle is not available through the requested return time. Review the available alternatives below.');
      return;
    }

    const { data, error } = await supabase.rpc('request_customer_rental_extension', {
      p_rental_id: currentRental.id,
      p_requested_return_date: extensionForm.returnDate,
      p_requested_return_time: extensionForm.returnTime,
      p_customer_note: extensionForm.note,
    });
    setExtensionSaving(false);

    if (error) {
      notify(error.message);
      return;
    }

    setExtensionRequests((prev) => [data, ...prev.filter((request) => request.id !== data.id)]);
    setExtensionForm((prev) => ({ ...prev, note: '' }));
    setExtensionPreview(null);
    notify('Extension request sent for admin review.', 'success');
  }

  async function cancelExtensionRequest() {
    if (!pendingExtension?.id) return;

    setExtensionSaving(true);
    const { data, error } = await supabase.rpc('cancel_customer_rental_extension', {
      p_extension_request_id: pendingExtension.id,
    });
    setExtensionSaving(false);

    if (error) {
      notify(error.message);
      return;
    }

    setExtensionRequests((prev) => prev.map((request) => (request.id === data.id ? data : request)));
    setExtensionPreview(null);
    notify('Extension request cancelled.', 'success');
  }

  async function askForExtensionAlternative(vehicle) {
    if (!currentRental?.id) return;
    if (!extensionWindow.open) {
      notify(extensionWindow.message);
      return;
    }
    setExtensionSaving(true);
    const { data, error } = await supabase.rpc('request_customer_vehicle_switch_continuation', {
      p_rental_id: currentRental.id,
      p_replacement_vehicle_id: vehicle.id,
      p_requested_return_date: extensionForm.returnDate,
      p_requested_return_time: extensionForm.returnTime,
      p_customer_note: extensionForm.note,
    });
    setExtensionSaving(false);
    if (error) return notify(error.message);
    setExtensionRequests((prev) => [data, ...prev.filter((request) => request.id !== data.id)]);
    setExtensionPreview(null);
    notify(`Switch request sent for ${vehicle.name}. Your current rental return stays unchanged until a replacement is paid.`, 'success');
  }

  function openMaps() {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(RENTMECT_ADDRESS)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function beginWizard() {
    if (allGuidedStepsComplete) {
      notify('All guided steps are complete.');
      return;
    }
    setWizardStep(getNextGuidedStep());
    setWizardOpen(true);
  }

  function getNextGuidedStep() {
    if (!contactStepCompleted) return 0;
    if (!vehicleStepCompleted) return 1;
    if (!identityVerified) return 2;
    if (!licenseUploaded) return 3;
    if (!insuranceUploaded) return 4;
    if (!agreementSigned) return 5;
    if (!paymentPaid) return 6;
    return 0;
  }

  function openWizardAtStep(step) {
    setActiveTab('overview');
    setWizardStep(step);
    setWizardOpen(true);
  }

  async function callStripeIdentity(action, redirectToStripe = false, retryTransientReturn = true) {
    if (!session?.access_token || identitySaving) return null;
    setIdentitySaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-web-hook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action,
          returnUrl: `${window.location.origin}${window.location.pathname}?identity=return`,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.error) {
        notify(data?.error || `Stripe Identity could not be opened (${response.status}). Try again.`);
        return null;
      }
      setProfile((current) => current ? {
        ...current,
        identity_verification_status: data.status,
        identity_verification_error_code: data.errorCode ?? current.identity_verification_error_code ?? null,
      } : current);
      if (data.verified) {
        notify('Stripe Identity verification is complete.', 'success');
        await loadPortalData(session.user.id, { silent: true });
      } else if (data.status === 'processing') {
        notify('Stripe is still checking your identity. Wait a moment, then select Refresh status.');
      } else if (redirectToStripe && data.url) {
        window.location.assign(data.url);
      }
      return data;
    } catch (error) {
      if (returningFromStripeIdentity && retryTransientReturn && isTransientPortalError(error)) {
        window.setTimeout(() => {
          callStripeIdentity(action, false, false);
        }, 900);
        return null;
      }
      notify(userFacingPortalError(error, 'Stripe Identity could not refresh. Select Refresh status to try again.'), 'error');
      return null;
    } finally {
      setIdentitySaving(false);
    }
  }

  function startIdentityVerification() {
    return callStripeIdentity('create_identity_verification', true);
  }

  function refreshIdentityVerification(showNotice = false) {
    const result = callStripeIdentity('get_identity_verification', false);
    if (showNotice) result.then((data) => {
      if (!data) return;
      if (data.verified) notify('VERIFIED — Stripe successfully confirmed your identity.', 'success');
      else if (data.status === 'processing') notify('PROCESSING — Stripe received your submission and is still reviewing it.');
      else notify('NOT VERIFIED — Stripe needs you to retry the identity check.', 'error');
    });
    return result;
  }

  async function startStripeCheckout() {
    if (paymentSaving) return;

    setPaymentSaving(true);
    const targetExtension = approvedUnpaidExtension;
    let rental = currentRental;

    if (targetExtension && extensionInsuranceRequired) {
      setPaymentSaving(false);
      notify('Upload new proof of insurance for this extension before opening Stripe.', 'error');
      return;
    }

    if (!targetExtension && checkoutExpired) {
      setPaymentSaving(false);
      notify('Your 25-minute vehicle hold expired. Return to the fleet page to start a new booking.');
      return;
    }

    if (!targetExtension && (!contactStepCompleted || !identityVerified || !licenseUploaded || !insuranceUploaded || !agreementSigned)) {
      setPaymentSaving(false);
      notify('Complete phone verification, Stripe Identity, license, insurance, and the rental agreement before payment.');
      setWizardStep(getNextGuidedStep());
      setWizardOpen(true);
      return;
    }

    if (!targetExtension && !rental) {
      rental = await createReservationIfNeeded();
    }

    if (!targetExtension && !rental?.id) {
      setPaymentSaving(false);
      return;
    }

    if (!targetExtension && isBookingFlowTestVehicle(rental?.vehicles || selectedVehicle)) {
      const { data: completedTestRental, error: testPaymentError } = await supabase.rpc('complete_booking_flow_test_payment', {
        p_rental_id: rental.id,
      });
      setPaymentSaving(false);
      if (testPaymentError || !completedTestRental) {
        notify(testPaymentError?.message || 'The no-charge test payment could not be completed.');
        return;
      }
      setRentals((current) => current.map((item) => item.id === completedTestRental.id
        ? { ...item, ...completedTestRental, vehicles: item.vehicles }
        : item));
      notify('Test booking completed. No payment was collected.', 'success');
      return;
    }

    const bookingId = pendingBookingId || getBookingIdFromUrl();
    const returnUrl = new URL(window.location.href);
    returnUrl.hash = '';
    returnUrl.searchParams.delete('identity');
    returnUrl.searchParams.delete('guided');
    returnUrl.searchParams.delete('payment');
    returnUrl.searchParams.delete('charge');
    if (bookingId) returnUrl.searchParams.set('booking', bookingId);
    const successUrl = new URL(returnUrl);
    successUrl.searchParams.set('payment', 'stripe_success');
    const cancelUrl = new URL(returnUrl);
    cancelUrl.searchParams.set('payment', 'stripe_cancelled');

    const checkoutPayload = targetExtension
      ? {
          action: 'create_checkout',
          targetType: 'extension',
          extensionRequestId: targetExtension.id,
          successUrl: successUrl.toString(),
          cancelUrl: cancelUrl.toString(),
        }
      : {
          action: 'create_checkout',
          targetType: 'rental',
          rentalId: rental.id,
          successUrl: successUrl.toString(),
          cancelUrl: cancelUrl.toString(),
        };

    const checkoutResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-web-hook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(checkoutPayload),
    });
    const data = await checkoutResponse.json().catch(() => null);
    const error = checkoutResponse.ok ? null : new Error(data?.error || `Stripe checkout failed with ${checkoutResponse.status}.`);

    setPaymentSaving(false);

    if (error || data?.error) {
      console.error('Stripe checkout failed', {
        status: checkoutResponse.status,
        response: data,
        message: error?.message || data?.error,
      });
      notify(data?.error || error?.message || 'Stripe checkout could not be started.');
      return;
    }

    if (data?.noPaymentRequired) {
      await loadPortalData(session.user.id, { silent: true });
      notify('Your 100% discount covered the full checkout, including the waived security deposit. No Stripe payment was required.', 'success');
      return;
    }

    if (!data?.url) {
      notify('Stripe checkout did not return a payment link.');
      return;
    }

    window.location.assign(data.url);
  }

  async function payAdditionalRentalCharge(charge) {
    if (!charge?.id || paymentSaving) return;
    setPaymentSaving(true);
    const returnUrl = new URL(window.location.href);
    returnUrl.hash = '';
    returnUrl.searchParams.set('payment', 'stripe_success');
    returnUrl.searchParams.set('charge', charge.id);
    const cancelUrl = new URL(returnUrl);
    cancelUrl.searchParams.set('payment', 'stripe_cancelled');
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-web-hook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'create_checkout',
        targetType: 'charge',
        chargeId: charge.id,
        successUrl: returnUrl.toString(),
        cancelUrl: cancelUrl.toString(),
      }),
    });
    const data = await response.json().catch(() => null);
    setPaymentSaving(false);
    if (!response.ok || data?.error || !data?.url) {
      notify(data?.error || 'The additional-charge checkout could not be opened.');
      return;
    }
    window.location.assign(data.url);
  }

  async function applyCustomerDiscount() {
    const code = String(discountInput || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!currentRental?.id) return notify('Create the reservation before applying a discount code.');
    if (!code) return notify('Enter the discount code from the promotion.');
    setDiscountSaving(true);
    const { data, error } = await supabase.rpc('apply_customer_discount_to_rental', {
      p_rental_id: currentRental.id,
      p_code: code,
    });
    setDiscountSaving(false);
    if (error || !data) return notify(error?.message || 'That discount code could not be applied.');
    setRentals((current) => current.map((rental) =>
      rental.id === data.id ? { ...rental, ...data, vehicles: rental.vehicles } : rental
    ));
    setDiscountInput('');
    notify(`${data.discount_code} applied. You saved ${money(data.discount_amount)}.`, 'success');
  }

  async function nextWizardStep() {
    if (wizardStep === 0 && !contactStepCompleted) {
      notify('Save your renter details and verify your phone number before continuing.');
      return;
    }

    if (wizardStep === 0) {
      const savedProfile = await saveProfileDetails(false);
      if (!savedProfile?.phone_verified) {
        notify('Verify the saved phone number before continuing.');
        return;
      }
      if (identityCorrectionTarget) {
        setIdentityCorrectionTarget('');
        setWizardStep(2);
        notify('Your corrected identity details are saved. Your email and phone remain verified.', 'success');
        return;
      }
    }

    if (wizardStep === 0 && contactStepCompleted && selectedVehicle && !currentRental) {
      const rental = await createReservationIfNeeded();
      if (!rental) return;
      setWizardStep(2);
      return;
    }

    if (wizardStep === 0 && contactStepCompleted && selectedVehicle && currentRental) {
      setWizardStep(2);
      return;
    }

    if (wizardStep === 1 && selectedVehicle && !currentRental) {
      const rental = await createReservationIfNeeded();
      if (!rental) return;
    }

    if (wizardStep === 1 && !selectedVehicle && !currentRental) {
      notify('Choose an available vehicle before continuing.');
      return;
    }

    if (wizardStep === 2 && !identityVerified) {
      notify('Complete Stripe Identity verification before continuing.');
      return;
    }

    if (wizardStep === 3 && !licenseUploaded) {
      notify('Upload your driver license before continuing.');
      return;
    }

    if (wizardStep === 4 && !insuranceUploaded) {
      notify('Upload your insurance paperwork before continuing.');
      return;
    }

    if (wizardStep === 5 && !agreementSigned) {
      setWizardReminder({
        title: 'Sign the agreement before continuing',
        text: 'Scroll through the agreement, check the acknowledgment, type your legal name, draw your signature, and press “Sign agreement & continue to payment.”',
      });
      notify('Scroll down and sign the rental agreement before pressing Next.');
      return;
    }

    if (wizardStep === 6 && !paymentPaid) {
      notify('Complete Stripe payment to finish the booking checklist.');
      return;
    }

    if (wizardStep === wizardSteps.length - 1) {
      setWizardOpen(false);
      return;
    }

    setWizardStep((step) => step + 1);
  }

  function previousWizardStep() {
    setWizardReminder(null);
    setWizardStep((step) => Math.max(0, step - 1));
  }

  const wizardSteps = [
    {
      title: 'Renter Details & Phone Verification',
      icon: ShieldCheck,
      status: contactStepCompleted ? 'Completed' : 'Required',
      completed: contactStepCompleted,
    },
    {
      title: 'Choose Dates & Vehicle',
      icon: Car,
      status: vehicleStepCompleted ? 'Completed' : 'Required',
      completed: vehicleStepCompleted,
    },
    {
      title: 'Verify Government ID & Selfie',
      icon: ShieldCheck,
      status: identityVerified ? 'Verified' : identityStatus === 'processing' ? 'Processing' : 'Required',
      completed: identityVerified,
    },
    {
      title: 'Upload Driver License',
      icon: Upload,
      status: licenseUploaded ? 'Completed' : 'Required',
      completed: licenseUploaded,
    },
    {
      title: 'Upload Insurance Paperwork',
      icon: FileText,
      status: insuranceUploaded ? 'Completed' : 'Required',
      completed: insuranceUploaded,
    },
    {
      title: 'Review & Sign Rental Agreement',
      icon: FileSignature,
      status: agreementSigned ? 'Completed' : 'Required',
      completed: agreementSigned,
    },
    {
      title: 'Pay Deposit & Rental Payment',
      icon: CreditCard,
      status: paymentPaid ? 'Completed' : 'Final Step',
      completed: paymentPaid,
    },
  ];

  const agreementTextWithDetails = buildAgreementWithDetails({
    agreementText: AGREEMENT_TEXT,
    profile: profileForm,
    email: userEmail,
    vehicle: selectedVehicle || currentRental?.vehicles,
    reservation: reservationForm,
    rental: currentRental,
    signatureName,
    signatureImageData,
  });

  const tabs = paymentPaid
    ? [
        { key: 'overview', label: 'Overview', icon: CalendarDays },
        { key: 'records', label: 'Records', icon: FileText },
        { key: 'payment', label: 'Billing', icon: CreditCard },
        { key: 'history', label: 'Rental History', icon: Clock },
        { key: 'messages', label: 'Messages', icon: MessageCircle },
      ]
    : [
        { key: 'overview', label: 'Overview', icon: CalendarDays },
        { key: 'guided', label: 'Guided Steps', icon: CheckCircle2 },
        { key: 'messages', label: 'Messages', icon: MessageCircle },
      ];

  function selectClientTab(key) {
    setActiveTab(key);
    if (isMobileClientNav) setNavCollapsed(true);
  }

  if (bookingPreviewFleetMode) return <BookingPreviewFleet />;

  if (loading) return <LoadingScreen />;

  if (adminBookingToken && adminBookingError) {
    return (
      <div className="preview-guest-shell">
        <PreviewTopbar />
        <main className="preview-confirmation preview-handoff-error">
          <AlertTriangle size={50} />
          <p className="eyebrow">Secure booking link</p>
          <h1>We couldn’t open this booking.</h1>
          <p>{adminBookingError}</p>
        </main>
      </div>
    );
  }

  if (session && adminBookingToken && !adminBookingClaimed) return <LoadingScreen />;

  if (!session) {
    if (checkoutIntent && bookingPreviewCheckoutMode) {
      return (
        <PreviewGuestExperience
          page={previewPage}
          setPage={setPreviewPage}
          authForm={authForm}
          setAuthForm={setAuthForm}
          handleAuth={handleAuth}
          verifyEmailOtp={verifyEmailOtp}
          emailOtp={emailOtp}
          setEmailOtp={setEmailOtp}
          emailOtpSent={emailOtpSent}
          setEmailOtpSent={setEmailOtpSent}
          emailAuthBusy={emailAuthBusy}
          message={message}
          reservationForm={reservationForm}
          vehicle={selectedVehicle}
          estimate={estimate}
          checkoutSecondsRemaining={checkoutSecondsRemaining}
          checkoutExpired={checkoutExpired}
          directCheckout={cars2BookingHandoff}
          adminBookingHandoff={adminBookingHandoff}
          changeCheckoutDatesOrVehicle={changeCheckoutDatesOrVehicle}
        />
      );
    }
    return (
        <AuthScreen
          authForm={authForm}
          setAuthForm={setAuthForm}
          handleAuth={handleAuth}
          verifyEmailOtp={verifyEmailOtp}
          emailOtp={emailOtp}
          setEmailOtp={setEmailOtp}
          emailOtpSent={emailOtpSent}
          setEmailOtpSent={setEmailOtpSent}
          emailAuthBusy={emailAuthBusy}
          message={message}
          checkoutIntent={checkoutIntent}
          pendingVehicleName={pendingVehicleName}
          reservationForm={reservationForm}
          checkoutSecondsRemaining={checkoutSecondsRemaining}
          checkoutExpired={checkoutExpired}
        />
    );
  }

  if (bookingPreviewCheckoutMode && checkoutIntent && !previewPortalOpen) {
    return (
      <>
        {notice && (
          <div className="preview-notice-wrap">
            <Notice notice={notice} onDismiss={() => setNotice(null)} />
          </div>
        )}
        <PreviewCheckout
          activeSection={previewCheckoutSection}
          setActiveSection={setPreviewCheckoutSection}
          reservationForm={reservationForm}
          estimate={estimate}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          birthDateConfirmed={birthDateConfirmed}
          setConfirmedBirthDate={setConfirmedBirthDate}
          identityCorrectionTarget={identityCorrectionTarget}
          setIdentityCorrectionTarget={setIdentityCorrectionTarget}
          userEmail={userEmail}
          emailVerified={emailVerified}
          phoneCode={phoneCode}
          setPhoneCode={setPhoneCode}
          sendPhoneCode={sendPhoneCode}
          verifyPhoneCode={verifyPhoneCode}
          sendingCode={sendingCode}
          verifyingCode={verifyingCode}
          phoneVerified={phoneVerified}
          contactStepCompleted={contactStepCompleted}
          continueContact={continuePreviewContact}
          reservationSaving={reservationSaving}
          currentRental={currentRental}
          vehicle={selectedVehicle || currentRental?.vehicles}
          identityStatus={identityStatus}
          identityErrorCode={identityErrorCode}
          identityVerified={identityVerified}
          identitySaving={identitySaving}
          startIdentityVerification={startIdentityVerification}
          refreshIdentityVerification={refreshIdentityVerification}
          uploadDocument={uploadDocument}
          documentUploadBusy={documentUploadBusy}
          licenseUploaded={licenseUploaded}
          insuranceUploaded={insuranceUploaded}
          insuranceCoverage={insuranceCoverage}
          setInsuranceCoverage={setInsuranceCoverage}
          agreementSigned={agreementSigned}
          openAgreement={() => setAgreementModalOpen(true)}
          paymentPaid={paymentPaid}
          paymentSaving={paymentSaving}
          startStripeCheckout={startStripeCheckout}
          serviceFees={serviceFees}
          discountInput={discountInput}
          setDiscountInput={setDiscountInput}
          discountSaving={discountSaving}
          applyCustomerDiscount={applyCustomerDiscount}
          checkoutSecondsRemaining={checkoutSecondsRemaining}
          checkoutExpired={checkoutExpired}
          changeCheckoutDatesOrVehicle={changeCheckoutDatesOrVehicle}
          signOut={signOut}
          openPortal={() => setPreviewPortalOpen(true)}
          adminBookingHandoff={adminBookingHandoff}
        />
        {agreementModalOpen && (
          <FlowStepErrorBoundary label="rental agreement" onClose={() => setAgreementModalOpen(false)}>
            <AgreementModal
              agreementText={agreementTextWithDetails}
              agreementChecked={agreementChecked}
              agreementSigned={agreementSigned}
              setAgreementChecked={setAgreementChecked}
              signatureName={signatureName}
              setSignatureName={setSignatureName}
              signatureImageData={signatureImageData}
              setSignatureImageData={setSignatureImageData}
              signAgreement={signAgreement}
              agreementSaving={agreementSaving}
              currentRental={currentRental}
              onClose={() => setAgreementModalOpen(false)}
            />
          </FlowStepErrorBoundary>
        )}
      </>
    );
  }

  return (
    <div className={`portal-shell compact-shell ${navCollapsed ? 'nav-collapsed' : ''}`}>
      {isMobileClientNav && !navCollapsed && (
        <button
          type="button"
          className="mobile-drawer-scrim"
          aria-label="Close client navigation"
          onClick={() => setNavCollapsed(true)}
        />
      )}
      {isMobileClientNav && (
        <aside className={`mobile-drawer client-mobile-drawer ${navCollapsed ? '' : 'open'}`} aria-label="Client navigation">
          <div className="mobile-drawer-brand">
            <img src={logoUrl} alt="Rent Me CT" />
          </div>
          <button className="mobile-drawer-close" type="button" onClick={() => setNavCollapsed(true)} aria-label="Close client navigation">
            <X size={22} />
          </button>
          <nav className="mobile-drawer-nav" id="client-mobile-drawer-navigation">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" className={activeTab === key ? 'active' : ''} onClick={() => selectClientTab(key)} aria-current={activeTab === key ? 'page' : undefined}>
                <Icon size={20}/><span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="mobile-drawer-footer">
            <button type="button" onClick={signOut}><LogOut size={19}/><span>Log Out</span></button>
          </div>
        </aside>
      )}
      {!isMobileClientNav && (
        <aside className={`sidebar ${navCollapsed ? 'collapsed' : ''}`} aria-label="Client navigation">
          <div className="brand-block">
            <img className="brand-logo" src={logoUrl} alt="Rent Me CT" />
          </div>
          <button className="nav-toggle" type="button" onClick={() => setNavCollapsed(!navCollapsed)} aria-expanded={!navCollapsed} aria-controls="client-primary-navigation" aria-label={navCollapsed ? 'Expand client navigation' : 'Collapse client navigation'}>
            {navCollapsed ? <Menu size={17} /> : <X size={17} />}<span>{navCollapsed ? 'Expand' : 'Collapse'}</span>
          </button>
          <nav className="side-nav tab-nav" id="client-primary-navigation">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" className={activeTab === key ? 'active' : ''} onClick={() => selectClientTab(key)} aria-current={activeTab === key ? 'page' : undefined}>
                <Icon size={18}/><span>{label}</span>
              </button>
            ))}
          </nav>
          <button className="logout-btn" onClick={signOut}><LogOut size={17}/><span>Log Out</span></button>
        </aside>
      )}

      <main id="portal-main-content" className="portal-main compact-main">
        {notice && <Notice notice={notice} onDismiss={() => setNotice(null)} />}
        <header className="portal-header compact-header">
          {isMobileClientNav && navCollapsed && (
            <button
              type="button"
              className="mobile-drawer-trigger"
              aria-label="Open client navigation"
              aria-controls="client-mobile-drawer-navigation"
              aria-expanded="false"
              onClick={() => setNavCollapsed(false)}
            >
              <Menu size={22} />
            </button>
          )}
          <div className="client-header-copy">
            <p className="eyebrow">Welcome back</p>
            <h1>{clientFirstName}</h1>
            <span>{userEmail} • {emailVerified ? 'Email verified' : 'Email verification pending'}</span>
          </div>
          <div className="header-actions">
            <button className="return-btn" onClick={openMaps}>
              <MapPin size={18} /> Location
            </button>
            {!paymentPaid && <button className="primary-btn" onClick={beginWizard}>
              <CheckCircle2 size={18} /> {returningFromStripeIdentity ? 'RESUME CHECKOUT' : 'Continue Guided Steps'}
            </button>}
          </div>
        </header>

        <PortalDataHealth health={portalHealth} onRetry={() => loadPortalData(session.user.id, { silent: true })} />

        {checkoutHoldActive && (
          <CheckoutHoldTimer
            secondsRemaining={checkoutSecondsRemaining}
            expired={checkoutExpired}
          />
        )}

        <MobileFlowStatus items={mobileStatusItems} />
        <ReturnReviewNotice report={latestOpenReturnReport} />

        {activeTab === 'overview' && (
          <>
            {!allGuidedStepsComplete && (
              <section className="panel guided-resume-card" aria-label="Resume required rental steps">
                <div>
                  <p className="eyebrow">Your next required step</p>
                  <h3>{wizardSteps[getNextGuidedStep()]?.title || 'Continue your rental'}</h3>
                  <p className="muted">Your progress is saved. Resume here—there is no need to open the menu.</p>
                </div>
                <button className="primary-btn big-action" type="button" onClick={beginWizard}>
                  <CheckCircle2 size={20} /> {returningFromStripeIdentity ? 'RESUME CHECKOUT' : 'Resume Guided Steps'}
                </button>
              </section>
            )}
            {currentEmergencyException && <section className={`customer-exception-notice ${new Date(currentEmergencyException.expires_at).getTime() <= Date.now() ? 'expired' : ''}`}>
              <AlertTriangle size={21}/>
              <div><strong>Rental released with temporary exceptions</strong><span>{(currentEmergencyException.exception_scopes || []).map(prettyStatus).join(', ')} remain incomplete. Complete them as soon as possible. Exception expires {new Date(currentEmergencyException.expires_at).toLocaleString()}.</span></div>
            </section>}
            <section className="hero-panel compact-hero" id="reservation">
              <div>
                <p className="eyebrow">Reservation Setup</p>
                {displayedVehicle && !isBookingFlowTestVehicle(displayedVehicle) && (
                  <div className="selected-vehicle-media">
                    <img src={getVehicleImage(displayedVehicle)} alt={`${displayedVehicle.name} rental vehicle`} loading="lazy" />
                  </div>
                )}
                <h2>{displayedVehicle?.name || 'Finish Your Rental'}</h2>
                <p>
                  Complete your phone verification, vehicle, documents, agreement, and payment through the guided flow.
                </p>

                <div className="reservation-summary compact-summary">
                  <SummaryItem label="Pickup" value={formatRentalDate(overviewPickupDate, overviewPickupTime)} />
                  <SummaryItem label="Return" value={formatRentalDate(overviewReturnDate, overviewReturnTime)} />
                  <SummaryItem label="Vehicle" value={currentRental?.vehicles?.name || selectedVehicle?.name || 'Not selected yet'} />
                  <SummaryItem label="Status" value={prettyStatus(currentRental?.status || 'pending setup')} />
                </div>
              </div>
              <div className="hero-cta-stack">
                {!currentRental && (
                  <button className="primary-btn" onClick={hasCompletedRental ? startNewReservation : createReservationIfNeeded} disabled={reservationSaving}>
                    {reservationSaving ? 'Creating Reservation...' : hasCompletedRental ? 'Create New Reservation' : 'Create Reservation'}
                  </button>
                )}
              </div>
            </section>

            {currentRental && (
              <section className="panel return-panel">
                <p className="eyebrow">Return Status</p>
                <h3>{returnCountdown.label}</h3>
                <div className="reservation-summary compact-summary">
                  <SummaryItem label="Due" value={formatRentalDate(currentRental.return_date, currentRental.return_time)} />
                  <SummaryItem label="Time Left" value={returnCountdown.value} />
                  <SummaryItem label="Return Location" value={RENTMECT_ADDRESS} />
                </div>
                {canManageTrip && <button className="secondary-btn manage-trip-btn" type="button" onClick={() => setTripManagerOpen((open) => !open)}>
                  <Car size={18}/> {showTripManager ? 'Hide Trip Options' : 'Manage This Trip'}
                </button>}
                {showTripManager && <>
                {canManageTrip && (
                  <div className="trip-change-chooser" aria-label="What would you like to do with this rental?">
                    <div>
                      <strong>What happens next?</strong>
                      <span>Choose one path. You can change it until a return or paid continuation is finalized.</span>
                    </div>
                    <div className="trip-change-options">
                      <button type="button" className={effectiveTripChangeChoice === 'return' ? 'active' : ''} onClick={() => chooseTripChange('return')}>
                        <CheckCircle2 size={18}/> Return this car
                      </button>
                      <button type="button" className={effectiveTripChangeChoice === 'extend' ? 'active' : ''} onClick={() => chooseTripChange('extend')}>
                        <Clock size={18}/> Extend this car
                      </button>
                      <button type="button" className={effectiveTripChangeChoice === 'exchange' ? 'active' : ''} onClick={() => chooseTripChange('exchange')}>
                        <Car size={18}/> Exchange cars
                      </button>
                    </div>
                  </div>
                )}
                <div className="return-workflow-grid">
                  {(!canManageTrip || effectiveTripChangeChoice === 'return' || returnConfirmationSent) && <div className="return-action-block">
                    <p className="muted">
                      Send return confirmation after dropoff. Rent Me CT inspects mileage, fuel, and condition before closing the rental and deposit.
                    </p>
                    {returnConfirmationSent && (
                      <div className="return-confirmation-box">
                        <CheckCircle2 size={20} />
                        <div>
                          <strong>Return confirmation sent</strong>
                          <span>Rent Me CT has been notified. We will inspect the vehicle and close out your rental.</span>
                        </div>
                      </div>
                    )}
                    {showApprovedSwitchVehicle && (
                      <div className="next-vehicle-card">
                        <span className="next-vehicle-image">
                          <img src={getVehicleImage(approvedSwitchVehicle)} alt={`${approvedSwitchVehicle.name} replacement rental vehicle`} loading="lazy" />
                        </span>
                        <div>
                          <strong>{approvedSwitchVehicle.name}</strong>
                          <span>Approved replacement vehicle</span>
                          <small>
                            Starts after this return. Payment is required before the replacement rental activates.
                          </small>
                        </div>
                      </div>
                    )}
                    <button className="primary-btn" onClick={confirmReturn} disabled={returnSaving || returnConfirmationSent || Boolean(pendingSameVehicleExtension) || !returnCountdown.canConfirm}>
                      <CheckCircle2 size={18} /> {returnSaving ? 'Sending Return Confirmation...' : returnConfirmationSent ? 'Return Confirmation Sent' : pendingSameVehicleExtension ? 'Extension Decision Pending' : returnCountdown.canConfirm ? 'Confirm Vehicle Returned' : 'Return Confirmation Locked'}
                    </button>
                    {approvedUnpaidExtension && (
                      <p className="extension-payment-note">
                        {approvedUnpaidExtension.request_kind === 'switch_car_continuation'
                          ? `Switch approved through ${formatRentalDate(approvedUnpaidExtension.requested_return_date, approvedUnpaidExtension.requested_return_time)}. Payment is required before the replacement vehicle activates.`
                          : `Extension approved through ${formatRentalDate(approvedUnpaidExtension.requested_return_date, approvedUnpaidExtension.requested_return_time)}. Payment is required before the longer return window activates.`}
                      </p>
                    )}
                    {activatedExtension && (
                      <p className="extension-payment-note paid">
                        Extension payment recorded. This rental now returns {formatRentalDate(currentRental.return_date, currentRental.return_time)}.
                      </p>
                    )}
                  </div>}
                  {(!canManageTrip || ['extend', 'exchange'].includes(effectiveTripChangeChoice) || pendingExtension || approvedUnpaidExtension) && <form className="portal-form extension-form" onSubmit={requestExtension}>
                    <div className="extension-heading">
                      <strong>Need more time?</strong>
                      <span>{extensionWindow.open
                        ? extensionMode === 'switch'
                          ? 'Choose a replacement that can start when this rental is due back.'
                          : 'Check this vehicle before asking for admin approval.'
                        : extensionWindow.message}</span>
                    </div>
                  {latestExtensionStatus && (
                    <div className={`mobile-extension-status ${latestExtensionStatus.status}`}>
                      <strong>{extensionStatusTitle(latestExtensionStatus)}</strong>
                      <span>{extensionStatusText(latestExtensionStatus)}</span>
                    </div>
                  )}
                  {(extensionWindow.open || pendingExtension || approvedUnpaidExtension) && <>
                  <div className="extension-mode" role="group" aria-label="Continuation type">
                    <button
                      type="button"
                      className={extensionMode === 'extend' ? 'active' : ''}
                      onClick={() => {
                        setExtensionMode('extend');
                        setExtensionPreview(null);
                      }}
                    >
                      Keep This Car
                    </button>
                    <button
                      type="button"
                      className={extensionMode === 'switch' ? 'active' : ''}
                      onClick={() => {
                        setExtensionMode('switch');
                        setExtensionPreview(null);
                      }}
                    >
                      Switch Vehicle
                    </button>
                  </div>
                  {pendingExtension && <div className="extension-pending-actions">
                    <p className="auth-message">
                      Pending {pendingExtension.request_kind === 'switch_car_continuation' ? 'switch' : 'extension'} request:
                      {' '}{formatRentalDate(pendingExtension.requested_return_date, pendingExtension.requested_return_time)}
                    </p>
                    <button className="secondary-btn" type="button" onClick={cancelExtensionRequest} disabled={extensionSaving}>Cancel Extension Request</button>
                  </div>}
                  {approvedUnpaidExtension && <p className="auth-message">Approved extension is waiting for payment before the new return date becomes active.{approvedUnpaidExtension.payment_due_at ? ` Pay by ${new Date(approvedUnpaidExtension.payment_due_at).toLocaleString()} or the hold is released automatically.` : ''}</p>}
                  {openExtensionRequest && <div className={`extension-insurance-step ${extensionInsuranceDocument?.status || 'missing'}`}>
                    <div>
                      <strong>New insurance required</strong>
                      <span>
                        {extensionInsuranceDocument?.status === 'approved'
                          ? 'Approved for this extension.'
                          : extensionInsuranceDocument?.status === 'pending_review'
                            ? 'Uploaded and waiting for Rent Me CT approval.'
                            : extensionInsuranceDocument?.status === 'rejected'
                              ? 'The extension insurance was rejected. Upload a replacement.'
                              : 'Upload proof that covers the requested continuation dates.'}
                      </span>
                    </div>
                    {(!extensionInsuranceDocument || extensionInsuranceDocument.status === 'rejected') && <label className="secondary-btn">
                      <Upload size={16}/> {documentUploadBusy.extensionInsurance ? 'Uploading…' : 'Upload New Insurance'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                        disabled={Boolean(documentUploadBusy.extensionInsurance)}
                        onChange={(event) => uploadDocument(event, 'insurance', {
                          createNew: true,
                          extensionRequestId: openExtensionRequest.id,
                        })}
                        style={{ display: 'none' }}
                      />
                    </label>}
                  </div>}
                  <input
                    type="date"
                    min={currentRental.return_date}
                    value={extensionForm.returnDate}
                    onChange={(event) => {
                      setExtensionPreview(null);
                      setExtensionForm({ ...extensionForm, returnDate: event.target.value });
                    }}
                    required
                  />
                  <select value={extensionForm.returnTime} onChange={(event) => {
                    setExtensionPreview(null);
                    setExtensionForm({ ...extensionForm, returnTime: event.target.value });
                  }}>
                    {timeOptions().map((time) => <option key={time}>{time}</option>)}
                  </select>
                  <input
                    placeholder="Optional note for Rent Me CT"
                    value={extensionForm.note}
                    onChange={(event) => setExtensionForm({ ...extensionForm, note: event.target.value })}
                  />
                  <button className="secondary-btn" disabled={extensionSaving || Boolean(pendingExtension) || Boolean(approvedUnpaidExtension)}>
                    {extensionSaving
                      ? 'Checking...'
                      : pendingExtension
                        ? 'Request Pending'
                        : approvedUnpaidExtension
                          ? 'Payment Required'
                          : extensionMode === 'switch'
                            ? 'Find Switch Vehicles'
                            : 'Request Extension'}
                  </button>
                  {extensionPreview && (extensionMode === 'switch' || !extensionPreview.same_vehicle_available) && (
                    <div className="extension-alternatives">
                      <p className="auth-message">
                        {extensionMode === 'switch'
                          ? `A switch starts at this rental's original return time: ${formatRentalDate(extensionPreview.switch_start_date, extensionPreview.switch_start_time)}.`
                          : `${extensionPreview.current_vehicle?.name || 'This vehicle'} is already blocked for that longer return window.`}
                        {extensionPreview.recommended_vehicles?.length ? ' Available replacement vehicles:' : ' No alternate vehicle is available for that window right now.'}
                      </p>
                      {extensionPreview.recommended_vehicles?.length > 0 && (
                        <div className="extension-alternative-list">
                          {extensionPreview.recommended_vehicles.map((vehicle) => (
                            <button className="extension-alternative" type="button" key={vehicle.id} onClick={() => askForExtensionAlternative(vehicle)}>
                              <strong>{vehicle.name}</strong>
                              <span>
                                {vehicle.similarity_rank === 0
                                  ? 'Same model'
                                  : vehicle.similarity_rank === 1
                                    ? 'Similar type'
                                    : vehicle.similarity_rank === 2
                                      ? 'Same brand'
                                      : 'Available option'}
                              </span>
                              <small>{money(vehicle.daily_rate)}/day • {money(vehicle.continuation_deposit ?? vehicle.security_deposit)} required deposit; your current hold carries over and only the difference changes • Request switch</small>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  </>}
                  </form>}
                </div>
                </>}
              </section>
            )}

            {switchContinuationRental && switchContinuationRental.id !== currentRental?.id && (
              <section className="panel continuation-panel">
                <p className="eyebrow">Paid Continuation</p>
                <h3>Replacement Rental Unlocked</h3>
                <div className="reservation-summary compact-summary">
                  <SummaryItem label="Vehicle" value={switchContinuationRental.vehicles?.name || 'Replacement vehicle'} />
                  <SummaryItem label="Pickup" value={formatRentalDate(switchContinuationRental.pickup_date, switchContinuationRental.pickup_time)} />
                  <SummaryItem label="Return" value={formatRentalDate(switchContinuationRental.return_date, switchContinuationRental.return_time)} />
                  <SummaryItem label="Status" value={prettyStatus(switchContinuationRental.status)} />
                </div>
                <p className="muted">Your current rental still needs its normal return confirmation. The replacement rental keeps its own agreement and insurance review flow.</p>
              </section>
            )}

            {paymentPaid && <section className="panel" id="profile">
              <p className="eyebrow">Profile</p>
              <h3>Customer Information</h3>
              <form className="portal-form" onSubmit={saveProfile}>
                <LegalNameFields
                  profileForm={profileForm}
                  setProfileForm={setProfileForm}
                  identityVerified={identityVerified}
                />
                {identityVerified && <small className="identity-name-lock-note">Identity verified. Your legal name and birthday are locked so returning rentals can reuse the approved Stripe Identity check.</small>}
                <BirthdayInput
                  idPrefix="profile-birthday"
                  value={profileForm.date_of_birth}
                  onChange={(dateOfBirth) => setProfileForm((current) => ({ ...current, date_of_birth: dateOfBirth }))}
                  confirmed={birthDateConfirmed}
                  onConfirmedChange={(isConfirmed) => setConfirmedBirthDate(isConfirmed ? profileForm.date_of_birth : '')}
                  disabled={identityVerified}
                />
                {profileForm.date_of_birth && isValidBirthDate(profileForm.date_of_birth) && <small>{isCustomerUnder25(profileForm.date_of_birth) ? 'Under 25: the configured deposit adjustment and rental markup apply.' : 'Age 25 or older: the selected vehicle deposit applies.'}</small>}
                <label><span>Phone number</span><input
                  type="tel"
                  autoComplete="tel"
                  placeholder="Example: 8605551234"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value, sms_transactional_opt_in: false })}
                /></label>
                <label>
                  <span>What will you use the vehicle for?</span>
                  <textarea
                    placeholder="Example: commuting to work, a family trip, or local personal errands"
                    maxLength="500"
                    value={profileForm.intended_vehicle_use}
                    onChange={(e) => setProfileForm({ ...profileForm, intended_vehicle_use: e.target.value })}
                    required
                  />
                  <small>{profileForm.intended_vehicle_use.length}/500 characters</small>
                </label>
                <EmailMarketingPreference profileForm={profileForm} setProfileForm={setProfileForm} />
                <SmsTransactionalPreference profileForm={profileForm} setProfileForm={setProfileForm} />
                <SmsVerificationDisclosure />
               <div className="phone-verify-box">
                <div className="button-row">
                  <button className="primary-btn" type="submit">Save Profile</button>

                  <button className="secondary-btn" type="button" onClick={sendPhoneCode} disabled={sendingCode || phoneVerified}>
                    {phoneVerified ? 'Phone Verified' : sendingCode ? 'Sending...' : 'Send Code'}
                  </button>
                </div>

                {!phoneVerified && (
                  <div className="phone-code-row">
                    <input
                      placeholder="Enter verification code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    />

                    <button className="primary-btn" type="button" onClick={verifyPhoneCode} disabled={verifyingCode}>
                      {verifyingCode ? 'Verifying...' : 'Verify Phone'}
                    </button>
                  </div>
                     )}
                  </div>
              </form>
            </section>}
          </>
        )}

        {activeTab === 'guided' && (
          <section className="panel centered-panel">
            <p className="eyebrow">Guided Rental Flow</p>
            <h3>One Step at a Time</h3>
            <p className="muted">{allGuidedStepsComplete ? 'Every required rental step is complete.' : `Your progress is saved. Your next step is ${wizardSteps[getNextGuidedStep()]?.title || 'the rental checklist'}.`}</p>
            <button className="primary-btn big-action" onClick={beginWizard}>
              <CheckCircle2 size={20} /> {allGuidedStepsComplete ? 'Guided Steps Complete' : returningFromStripeIdentity ? 'RESUME CHECKOUT' : 'Resume Guided Steps'}
            </button>
          </section>
        )}

        {activeTab === 'records' && (
          <>
            {(missingRequiredDocuments || documentsRejected) && (
              <section className="content-grid two compact-cards">
                {!licenseUploaded && (
                  <UploadCard
                    title={licenseRejected ? 'Replace Driver License' : 'Upload Driver License'}
                    text={licenseRejected ? 'The saved driver license was rejected. Upload a replacement to keep it on file.' : 'Upload a clear image or PDF once. Returning rentals can reuse this driver license.'}
                    icon={Upload}
                    onUpload={(e) => uploadDocument(e, 'license')}
                    busy={Boolean(documentUploadBusy.license)}
                  />
                )}
                {!insuranceUploaded && (
                  <div className="insurance-upload-card">
                    <InsuranceOptionsPanel insuranceCoverage={insuranceCoverage} setInsuranceCoverage={setInsuranceCoverage} />
                    <UploadCard
                      title={insuranceRejected ? 'Replace Insurance' : 'Upload Insurance'}
                      text={insuranceRejected ? 'This rental insurance upload was rejected. Upload a replacement for review.' : 'Upload proof of active auto insurance for this rental.'}
                      icon={FileText}
                      onUpload={(e) => uploadDocument(e, 'insurance')}
                      busy={Boolean(documentUploadBusy.insurance)}
                    />
                  </div>
                )}
              </section>
            )}
            {licenseUploaded && !currentRentalLicenseDocument && (
              <p className="document-on-file-note">Driver license on file. This rental only needs a fresh insurance upload.</p>
            )}
            <UploadedDocuments documents={documentsForActiveRental} currentRental={currentRental} openDocument={openDocument} replaceDocument={replaceDocument} busy={documentUploadBusy} />
          </>
        )}

        {activeTab === 'records' && (
          <section className="panel centered-panel agreement-card-clean">
            <p className="eyebrow">Agreement</p>
            <h3>Rental Agreement</h3>
            <p className="muted">
              The agreement no longer sits across the whole portal. Open it, read it inside the pop-up, sign, and close.
            </p>
            <div className="agreement-status-box">
              <FileSignature size={24} />
              <div>
                <strong>{agreementSigned ? 'Agreement Signed' : 'Agreement Not Signed Yet'}</strong>
                <span>{agreementSigned ? 'You are all set for this step.' : 'Review and sign before pickup.'}</span>
              </div>
            </div>
            <button className="primary-btn big-action" onClick={() => setAgreementModalOpen(true)}>
              <FileSignature size={18} /> Review & Sign Agreement
            </button>
            {currentRental?.agreement_snapshot && (
              <button className="secondary-btn big-action" type="button" onClick={() => downloadAgreement(currentRental)}>
                Download Signed Agreement
              </button>
            )}
          </section>
        )}

        {activeTab === 'payment' && (
          <section className="panel payment-panel-clean" id="payment">
            <p className="eyebrow">Billing</p>
            <h3>Deposit & Rental Payment</h3>
            <p className="muted">
              Review the exact amount due today before payment. Your security deposit is refundable after return if there are no unpaid tolls, tickets, excess mileage, cleaning, smoking, late, or damage charges.
            </p>
            <div className="payment-summary-grid">
              <div className="invoice-row"><span>Rental Days</span><strong>{currentRental ? getRentalDaysSafe(currentRental.pickup_date, currentRental.return_date) : estimate ? `${estimate.days} days` : 'Pending'}</strong></div>
              <div className="invoice-row"><span>Base Rental</span><strong>{currentRental ? money(currentRental.base_rental_total ?? currentRental.rental_total) : estimate ? money(estimate.baseRentalTotal) : 'Pending'}</strong></div>
              {Number(currentRental?.under_25_markup_amount || estimate?.markupAmount || 0) > 0 && <div className="invoice-row"><span>Under-25 Rental Markup ({Number(currentRental?.under_25_markup_percentage ?? estimate?.markupPercentage ?? 0)}%)</span><strong>{money(currentRental?.under_25_markup_amount ?? estimate?.markupAmount)}</strong></div>}
              {Number(currentRental?.discount_amount || 0) > 0 && <div className="invoice-row discount-row"><span>Discount ({currentRental.discount_code})</span><strong>−{money(currentRental.discount_amount)}</strong></div>}
              <div className="invoice-row"><span>Rental Total</span><strong>{currentRental ? money(currentRental.rental_total) : estimate ? money(estimate.rentalTotal) : 'Pending'}</strong></div>
              <div className="invoice-row"><span>CT Sales Tax</span><strong>{currentRental ? money(currentRental.tax_amount) : estimate ? money(estimate.taxAmount) : 'Pending'}</strong></div>
              <div className="invoice-row"><span>Security Deposit</span><strong>{currentRental?.discount_waives_security_deposit ? 'Waived' : currentRental ? money(currentRental.security_deposit) : estimate ? money(estimate.securityDeposit) : 'Pending'}</strong></div>
              <ServiceFeesSummary serviceFees={serviceFees} total={currentRental?.service_fee_total ?? estimate?.serviceFeeTotal} />
              <div className="invoice-row total-row"><span>Total Due Today</span><strong>{currentRental ? money(Number(currentRental.rental_total || 0) + Number(currentRental.service_fee_total || 0) + Number(currentRental.tax_amount || 0) + Number(currentRental.security_deposit || 0)) : estimate && !estimate.invalid ? money(estimate.checkoutTotal + estimate.securityDeposit) : 'Pending'}</strong></div>
            </div>
            {currentRental && !paymentPaid && <div className="discount-code-card">
              <div><Tag size={19}/><span><strong>{currentRental.discount_code ? `${currentRental.discount_code} applied` : 'Have a promotion code?'}</strong><small>{currentRental.discount_code ? `Your customer total includes ${money(currentRental.discount_amount)} in savings.` : 'Paste the code from the website banner or popup. Your exact total and Stripe payment update immediately.'}</small></span></div>
              {!currentRental.discount_code && <div className="discount-code-entry"><input aria-label="Discount code" value={discountInput} maxLength="24" placeholder="DISCOUNT CODE" onChange={(event) => setDiscountInput(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}/><button type="button" className="secondary-btn" disabled={discountSaving || !discountInput.trim()} onClick={applyCustomerDiscount}>{discountSaving ? 'Applying…' : 'Apply code'}</button></div>}
            </div>}
            <details className="payment-terms-details">
              <summary>Rental terms and pickup requirements</summary>
              <div className="payment-summary-grid">
                <div className="invoice-row"><span>Mileage Included</span><strong>{MILEAGE_POLICY}</strong></div>
                <div className="invoice-row"><span>Pickup Address</span><strong>{RENTMECT_ADDRESS}</strong></div>
                <div className="invoice-row"><span>Required Before Pickup</span><strong>Phone, agreement, payment, saved driver license, and insurance for this rental</strong></div>
                <div className="invoice-row"><span>Cancellation</span><strong>{CANCELLATION_TERMS}</strong></div>
              </div>
            </details>
            {currentRentalAdditionalCharges.length > 0 && (
              <div className="additional-charge-list">
                <h4>Additional rental charges</h4>
                <p className="muted">Tolls, add-ons, or other charges added by Rent Me CT appear here with their exact tax and payment status.</p>
                {currentRentalAdditionalCharges.map((charge) => <div className="invoice-row" key={charge.id}>
                  <span>{charge.name}{charge.description ? ` — ${charge.description}` : ''}<small>Rental {String(charge.rental_id).slice(0, 8).toUpperCase()} • {prettyStatus(charge.status)}</small></span>
                  <strong>{money(charge.total_amount)}</strong>
                  {['pending', 'failed', 'checkout_open'].includes(charge.status) && <button className="secondary-btn" type="button" onClick={() => payAdditionalRentalCharge(charge)} disabled={paymentSaving}>{paymentSaving ? 'Opening…' : 'Pay charge'}</button>}
                </div>)}
              </div>
            )}
            <div className="agreement-status-box">
              <CheckCircle2 size={24} />
              <div>
                <strong>After payment</strong>
                <span>Rent Me CT reviews the required documents, confirms pickup, and keeps the reservation visible here for messages and return instructions.</span>
              </div>
            </div>
            {(missingRequiredDocuments || documentsRejected) && (
              <DocumentRequirementNotice
                licenseUploaded={licenseUploaded}
                insuranceUploaded={insuranceUploaded}
                licenseRejected={licenseRejected}
                insuranceRejected={insuranceRejected}
              />
            )}
            {paymentPaid && <p className="auth-message">{currentRental?.discount_waives_security_deposit ? 'Booking completed with the security deposit waived.' : 'Payment recorded. Deposit is marked as held.'}</p>}
            {approvedUnpaidExtension && (
              <div className="extension-payment-card">
                <strong>Extension Payment Required</strong>
                <span>Approved return: {formatRentalDate(approvedUnpaidExtension.requested_return_date, approvedUnpaidExtension.requested_return_time)}</span>
                <span>Extension due: {money(approvedUnpaidExtension.extension_total_amount)}</span>
                {approvedUnpaidExtension.request_kind === 'switch_car_continuation' && <span>{money(approvedUnpaidExtension.deposit_carried_amount || 0)} deposit carries forward{Number(approvedUnpaidExtension.deposit_increase_amount || 0) > 0 ? `; ${money(approvedUnpaidExtension.deposit_increase_amount)} additional deposit is included` : ''}{Number(approvedUnpaidExtension.deposit_decrease_amount || 0) > 0 ? `; ${money(approvedUnpaidExtension.deposit_decrease_amount)} will be refunded after the original vehicle passes inspection` : ''}.</span>}
                {approvedUnpaidExtension.request_kind !== 'switch_car_continuation' && <span>Your existing security deposit remains held; no second deposit is charged.</span>}
                <small>{extensionInsuranceRequired ? 'Upload new insurance for this extension before Stripe payment unlocks.' : 'New insurance is on file. Pay securely with Stripe before the longer return window activates.'}</small>
              </div>
            )}
            <button className="primary-btn big-action" onClick={startStripeCheckout} disabled={paymentSaving || checkoutExpired || extensionInsuranceRequired || (paymentPaid && !approvedUnpaidExtension)}>
              <CreditCard size={18} /> {approvedUnpaidExtension
                ? extensionInsuranceRequired ? 'Upload New Insurance First' : paymentSaving ? 'Opening Stripe...' : 'Pay Approved Extension'
                : paymentPaid ? 'Payment Complete' : paymentSaving ? 'Opening Stripe...' : 'Pay With Stripe'}
            </button>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="panel" id="history">
            <p className="eyebrow">Previous Orders</p>
            <h3>Rental History</h3>
            {previousRentals.length === 0 && <p className="muted">No previous rentals yet.</p>}
            {previousRentals.map((order) => (
              <div className="history-row" key={order.id}>
                <div>
                  <strong>{order.vehicles?.name || 'Vehicle'}</strong>
                  <span>{formatRentalDate(order.pickup_date, order.pickup_time)} - {formatRentalDate(order.return_date, order.return_time)}</span>
                </div>
                <em>{prettyStatus(order.status)}</em>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'messages' && (
          <section className="panel messages-panel" id="messages">
            <p className="eyebrow">Support</p>
            <h3>Message Rent Me CT</h3>
            <div className="message-box tall-message-box">
              {messages.length === 0 && (
                <div className="message">
                  <strong>Rent Me CT</strong>
                  <p>Send us a message about pickup, return, extension, documents, agreement, or billing.</p>
                  <span>Now</span>
                </div>
              )}
              {messages.map((m) => (
                <div className={m.sender_role === 'client' ? 'message own' : 'message'} key={m.id}>
                  <strong>{m.sender_role === 'client' ? 'You' : 'Rent Me CT'}</strong>
                  <p>{m.message}</p>
                  <span>{new Date(m.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <form className="support-form" onSubmit={sendSupportMessage}>
              <label className="sr-only" htmlFor="client-support-message">Message Rent Me CT</label>
              <input
                id="client-support-message"
                value={supportText}
                onChange={(e) => setSupportText(e.target.value)}
                placeholder="Ask about pickup, return, extension, documents, billing..."
                disabled={supportSending}
              />
              <button disabled={supportSending || !supportText.trim()}>{supportSending ? 'Sending…' : 'Send'}</button>
            </form>
          </section>
        )}
      </main>

      {agreementModalOpen && (
        <FlowStepErrorBoundary label="rental agreement" onClose={() => setAgreementModalOpen(false)}>
          <AgreementModal
            agreementText={agreementTextWithDetails}
            agreementChecked={agreementChecked}
            agreementSigned={agreementSigned}
            setAgreementChecked={setAgreementChecked}
            signatureName={signatureName}
            setSignatureName={setSignatureName}
            signatureImageData={signatureImageData}
            setSignatureImageData={setSignatureImageData}
            signAgreement={signAgreement}
            agreementSaving={agreementSaving}
            currentRental={currentRental}
            onClose={() => setAgreementModalOpen(false)}
          />
        </FlowStepErrorBoundary>
      )}

      {wizardOpen && (
        <FlowStepErrorBoundary label="guided rental steps" onClose={() => setWizardOpen(false)}>
          <WizardModal
            wizardSteps={wizardSteps}
            wizardStep={wizardStep}
          setWizardOpen={setWizardOpen}
          wizardReminder={wizardReminder}
          setWizardReminder={setWizardReminder}
          previousWizardStep={previousWizardStep}
          nextWizardStep={nextWizardStep}
          setWizardStep={setWizardStep}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          birthDateConfirmed={birthDateConfirmed}
          setConfirmedBirthDate={setConfirmedBirthDate}
          identityCorrectionTarget={identityCorrectionTarget}
          setIdentityCorrectionTarget={setIdentityCorrectionTarget}
          phoneCode={phoneCode}
          setPhoneCode={setPhoneCode}
          sendPhoneCode={sendPhoneCode}
          verifyPhoneCode={verifyPhoneCode}
          sendingCode={sendingCode}
          verifyingCode={verifyingCode}
          phoneVerified={phoneVerified}
          bookingFlowTestMode={bookingFlowTestMode}
          checkoutVehicleChoices={checkoutVehicleChoices}
          reservationForm={reservationForm}
          setReservationForm={setReservationForm}
          selectedVehicle={selectedVehicle}
          estimate={estimate}
          createReservationIfNeeded={createReservationIfNeeded}
          reservationSaving={reservationSaving}
          startStripeCheckout={startStripeCheckout}
          paymentSaving={paymentSaving}
          paymentPaid={paymentPaid}
          identityStatus={identityStatus}
          identityErrorCode={identityErrorCode}
          identityVerified={identityVerified}
          identitySaving={identitySaving}
          startIdentityVerification={startIdentityVerification}
          refreshIdentityVerification={refreshIdentityVerification}
          uploadDocument={uploadDocument}
          documentUploadBusy={documentUploadBusy}
          licenseUploaded={licenseUploaded}
          insuranceUploaded={insuranceUploaded}
          agreementChecked={agreementChecked}
          setAgreementChecked={setAgreementChecked}
          signatureName={signatureName}
          setSignatureName={setSignatureName}
          signatureImageData={signatureImageData}
          setSignatureImageData={setSignatureImageData}
          signAgreement={signAgreement}
          agreementSaving={agreementSaving}
          agreementText={agreementTextWithDetails}
          serviceFees={serviceFees}
          discountInput={discountInput}
          setDiscountInput={setDiscountInput}
          discountSaving={discountSaving}
          applyCustomerDiscount={applyCustomerDiscount}
          insuranceCoverage={insuranceCoverage}
          setInsuranceCoverage={setInsuranceCoverage}
            currentRental={currentRental}
            fleetRentals={fleetRentals}
          />
        </FlowStepErrorBoundary>
      )}
    </div>
  );
}

function LegalNameFields({ profileForm, setProfileForm, identityVerified = false, className = '' }) {
  const updateName = (field, value) => {
    setProfileForm((current) => {
      const next = { ...current, [field]: value };
      next.full_name = [next.first_name, next.last_name]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' ');
      return next;
    });
  };

  return (
    <div className={`legal-name-fields ${className}`.trim()}>
      <label>
        <span>Legal first name</span>
        <input
          type="text"
          name="given-name"
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          placeholder="As shown on your government ID"
          value={profileForm.first_name}
          onChange={(event) => updateName('first_name', event.target.value)}
          disabled={identityVerified}
        />
      </label>
      <label>
        <span>Legal last name</span>
        <input
          type="text"
          name="family-name"
          autoComplete="family-name"
          autoCapitalize="words"
          enterKeyHint="next"
          placeholder="As shown on your government ID"
          value={profileForm.last_name}
          onChange={(event) => updateName('last_name', event.target.value)}
          disabled={identityVerified}
        />
      </label>
    </div>
  );
}

function EmailMarketingPreference({ profileForm, setProfileForm }) {
  return (
    <label className="email-marketing-preference">
      <input
        type="checkbox"
        checked={Boolean(profileForm.email_marketing_opt_in)}
        onChange={(event) => setProfileForm((current) => ({ ...current, email_marketing_opt_in: event.target.checked }))}
      />
      <span>
        <strong>Email me occasional offers and Rent Me CT updates.</strong>
        <small>This is optional. You can unsubscribe from any marketing email at any time.</small>
      </span>
    </label>
  );
}

function SmsTransactionalPreference({ profileForm, setProfileForm }) {
  return (
    <div className="sms-consent-preference">
      <label>
        <input
          type="checkbox"
          checked={Boolean(profileForm.sms_transactional_opt_in)}
          onChange={(event) => setProfileForm((current) => ({ ...current, sms_transactional_opt_in: event.target.checked }))}
        />
        <span>
          <strong>Text me about my rental and Rent Me CT account.</strong>
          <small>This optional checkbox is for recurring transactional messages, not marketing.</small>
        </span>
      </label>
      <p>
        By checking this box, you agree to receive automated transactional texts from Rent Me CT about bookings, payments, documents, pickup, returns, extensions, and customer support. Message frequency varies. Message and data rates may apply. Reply <strong>STOP</strong> to unsubscribe or <strong>HELP</strong> for help. Consent is not a condition of purchase. Read the <a href={SMS_TERMS_URL} target="_blank" rel="noopener noreferrer">SMS Terms</a> and <a href={SMS_PRIVACY_URL} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
      </p>
    </div>
  );
}

function SmsVerificationDisclosure() {
  return <p className="sms-verification-disclosure">Selecting the verification-code button requests one automated security text from Rent Me CT. Message and data rates may apply.</p>;
}

function WizardModal({
  wizardSteps,
  wizardStep,
  setWizardOpen,
  wizardReminder,
  setWizardReminder,
  previousWizardStep,
  nextWizardStep,
  setWizardStep,
  profileForm,
  setProfileForm,
  birthDateConfirmed,
  setConfirmedBirthDate,
  identityCorrectionTarget,
  setIdentityCorrectionTarget,
  phoneCode,
  setPhoneCode,
  sendPhoneCode,
  verifyPhoneCode,
  sendingCode,
  verifyingCode,
  phoneVerified,
  bookingFlowTestMode,
  checkoutVehicleChoices,
  reservationForm,
  setReservationForm,
  selectedVehicle,
  estimate,
  createReservationIfNeeded,
  reservationSaving,
  startStripeCheckout,
  paymentSaving,
  paymentPaid,
  identityStatus,
  identityErrorCode,
  identityVerified,
  identitySaving,
  startIdentityVerification,
  refreshIdentityVerification,
  uploadDocument,
  documentUploadBusy,
  licenseUploaded,
  insuranceUploaded,
  agreementChecked,
  agreementSigned,
  setAgreementChecked,
  signatureName,
  setSignatureName,
  signatureImageData,
  setSignatureImageData,
  signAgreement,
  agreementSaving,
  agreementText,
  serviceFees,
  discountInput,
  setDiscountInput,
  discountSaving,
  applyCustomerDiscount,
  insuranceCoverage,
  setInsuranceCoverage,
  currentRental,
  fleetRentals,
}) {
  const step = wizardSteps[wizardStep];
  const Icon = step.icon;
  const [vehicleReminder, setVehicleReminder] = useState(null);
  const dialogRef = useDialogFocus(() => setWizardOpen(false));
  const correctingIdentity = Boolean(identityCorrectionTarget);
  const showCorrectionName = ['full_name', 'identity_details'].includes(identityCorrectionTarget);
  const showCorrectionBirthday = ['date_of_birth', 'identity_details'].includes(identityCorrectionTarget);

  return (
    <div className="wizard-backdrop" role="presentation">
      <div ref={dialogRef} className="wizard-modal" role="dialog" aria-modal="true" aria-labelledby="guided-rental-step-title" tabIndex="-1">
        <div className="wizard-header">
          <div>
            <p className="eyebrow">Step {wizardStep + 1} of {wizardSteps.length}</p>
            <h2 id="guided-rental-step-title"><Icon size={24} /> {step.title}</h2>
            <span>{step.status}</span>
          </div>
          <button className="wizard-close" type="button" aria-label="Close guided steps" onClick={() => setWizardOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="wizard-progress">
          {wizardSteps.map((item, index) => (
            <div
              key={item.title}
              className={[
                'wizard-dot',
                item.completed ? 'complete' : '',
                index === wizardStep && !item.completed ? 'active' : '',
              ].filter(Boolean).join(' ')}
            >
              {item.completed ? <CheckCircle2 size={15} /> : index + 1}
            </div>
          ))}
        </div>

        {wizardReminder && (
          <div className="wizard-reminder" role="alert">
            <AlertTriangle size={19} />
            <div>
              <strong>{wizardReminder.title}</strong>
              <span>{wizardReminder.text}</span>
            </div>
            <button type="button" onClick={() => setWizardReminder(null)} aria-label="Dismiss reminder">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="wizard-body">
          {wizardStep === 0 && (
            <div className="portal-form">
              <p className="muted">
                {correctingIdentity
                  ? 'Correct only the highlighted identity information below. Your verified email and phone number will not be changed.'
                  : 'Add your renter details once, then verify your phone. Your passwordless account is already connected to this booking.'}
              </p>

              {(!correctingIdentity || showCorrectionName) && <LegalNameFields
                profileForm={profileForm}
                setProfileForm={setProfileForm}
                identityVerified={identityVerified && !correctingIdentity}
              />}
              {identityVerified && !correctingIdentity && <small className="identity-name-lock-note">Identity already verified. Your legal name and birthday stay locked and the approved check is reused for returning rentals.</small>}

              {(!correctingIdentity || showCorrectionBirthday) && <BirthdayInput
                idPrefix="wizard-birthday"
                value={profileForm.date_of_birth}
                onChange={(dateOfBirth) => setProfileForm((current) => ({ ...current, date_of_birth: dateOfBirth }))}
                confirmed={birthDateConfirmed}
                onConfirmedChange={(isConfirmed) => setConfirmedBirthDate(isConfirmed ? profileForm.date_of_birth : '')}
                autoFocus={identityCorrectionTarget === 'date_of_birth'}
                disabled={identityVerified && !correctingIdentity}
              />}

              {!correctingIdentity && <>
                <label>
                <span>What will you use the vehicle for?</span>
                <textarea
                  placeholder="Example: commuting to work, a family trip, or local personal errands"
                  maxLength="500"
                  value={profileForm.intended_vehicle_use}
                  onChange={(e) => setProfileForm({ ...profileForm, intended_vehicle_use: e.target.value })}
                  required
                />
                <small>{profileForm.intended_vehicle_use.length}/500 characters</small>
              </label>

              <label><span>Phone number</span><input
                type="tel"
                autoComplete="tel"
                placeholder="Example: 8605551234"
                value={profileForm.phone}
                onChange={(e) => {
                  setWizardReminder(null);
                  setProfileForm({ ...profileForm, phone: e.target.value, sms_transactional_opt_in: false });
                }}
              /></label>

              <EmailMarketingPreference profileForm={profileForm} setProfileForm={setProfileForm} />
              <SmsTransactionalPreference profileForm={profileForm} setProfileForm={setProfileForm} />
              <SmsVerificationDisclosure />

              <button className="primary-btn" type="button" onClick={sendPhoneCode} disabled={sendingCode || phoneVerified}>
                {phoneVerified ? 'Phone Verified' : sendingCode ? 'Sending...' : 'Send Verification Code'}
              </button>

              {!phoneVerified && (
                <>
                  <label><span>Phone verification code</span><input
                    placeholder="Enter verification code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={phoneCode}
                    onChange={(e) => {
                      setWizardReminder(null);
                      setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 10));
                    }}
                  /></label>

                  <button className="secondary-btn" type="button" onClick={verifyPhoneCode} disabled={verifyingCode}>
                    {verifyingCode ? 'Verifying...' : 'Verify Phone'}
                  </button>
                </>
              )}
              </>}
            </div>
          )}

          {wizardStep === 1 && (
            <div className="portal-form">
              <p className="muted">{bookingFlowTestMode
                ? 'Your Booking Preview test vehicle and selected schedule have been carried into checkout automatically.'
                : 'Choose your rental dates first, then select an available vehicle.'}</p>

              <div className="vehicle-date-grid">
                <input
                  type="date"
                  min={getTodayDateInputValue()}
                  value={reservationForm.pickupDate}
                  onChange={(e) => {
                    setWizardReminder(null);
                    const pickupDate = e.target.value || getTodayDateInputValue();
                    const minReturnDate = getNextDateInputValue(pickupDate);
                    setReservationForm({
                      ...reservationForm,
                      pickupDate,
                      returnDate: reservationForm.returnDate && reservationForm.returnDate >= minReturnDate
                        ? reservationForm.returnDate
                        : minReturnDate,
                    });
                  }}
                />

                <input
                  type="date"
                  min={getNextDateInputValue(reservationForm.pickupDate || getTodayDateInputValue())}
                  value={reservationForm.returnDate}
                  onChange={(e) => {
                    setWizardReminder(null);
                    setReservationForm({ ...reservationForm, returnDate: e.target.value });
                  }}
                />

                <select
                  value={reservationForm.pickupTime}
                  onChange={(e) => {
                    setWizardReminder(null);
                    setReservationForm({ ...reservationForm, pickupTime: e.target.value });
                  }}
                >
                  {timeOptions().map((t) => <option key={t}>{t}</option>)}
                </select>

                <select
                  value={reservationForm.returnTime}
                  onChange={(e) => {
                    setWizardReminder(null);
                    setReservationForm({ ...reservationForm, returnTime: e.target.value });
                  }}
                >
                  {timeOptions().map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="vehicle-picker-grid">
                {checkoutVehicleChoices.map((vehicle) => {
                  const selected = reservationForm.vehicleId === vehicle.id;
                  const bookable = isVehicleAvailableForDates(vehicle, reservationForm, fleetRentals, currentRental?.id);
                  const statusLabel = bookable ? 'Available' : vehicleAvailabilityLabel(vehicle, reservationForm, fleetRentals, currentRental?.id);

                  return (
                    <button
                      type="button"
                      key={vehicle.id}
                      className={[
                        'vehicle-picker-card',
                        selected ? 'selected' : '',
                        !bookable ? 'disabled' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        if (!bookable) return;
                        setWizardReminder(null);
                        setReservationForm({ ...reservationForm, vehicleId: vehicle.id });
                        setVehicleReminder(vehicle);
                      }}
                      disabled={!bookable}
                      aria-pressed={selected}
                    >
                      {selected && (
                        <span
                          className="vehicle-clear-button"
                          role="button"
                          tabIndex={0}
                          aria-label={`Clear ${vehicle.name}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setWizardReminder(null);
                            setReservationForm({ ...reservationForm, vehicleId: '' });
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;
                            event.preventDefault();
                            event.stopPropagation();
                            setWizardReminder(null);
                            setReservationForm({ ...reservationForm, vehicleId: '' });
                          }}
                        >
                          <X size={16} />
                        </span>
                      )}
                      <span className="vehicle-picker-image">
                        {isBookingFlowTestVehicle(vehicle)
                          ? <span className="test-vehicle-placeholder"><Car size={28} /><small>No photo — test only</small></span>
                          : <img src={getVehicleImage(vehicle)} alt={`${vehicle.name} rental vehicle`} loading="lazy" />}
                      </span>
                      <span className="vehicle-picker-info">
                        <strong>{vehicle.name}</strong>
                        <span>{money(vehicle.daily_rate)}/day</span>
                        <small>{statusLabel}</small>
                      </span>
                      <span className="vehicle-picker-action">{selected ? 'Selected' : bookable ? 'Select Vehicle' : 'Unavailable'}</span>
                    </button>
                  );
                })}
              </div>

              {estimate && (
                <div className="invoice-row">
                  <span>{estimate.invalid ? 'Return date must be after pickup' : `${estimate.days} rental days`}</span>
                  <strong>{estimate.invalid ? 'Invalid' : `${money(estimate.checkoutTotal)} + deposit ${money(estimate.securityDeposit)}`}</strong>
                  {!estimate.invalid && profileForm.date_of_birth && <small>{isCustomerUnder25(profileForm.date_of_birth) ? 'Under-25 deposit applied' : 'Standard deposit applied'}</small>}
                </div>
              )}

              <button className="primary-btn" onClick={createReservationIfNeeded} disabled={reservationSaving || Boolean(currentRental)}>
                {currentRental ? 'Reservation Created' : reservationSaving ? 'Creating Reservation...' : 'Create Reservation'}
              </button>
            </div>
          )}

          {wizardStep === 5 && (
            <div className="wizard-agreement-step">
              {agreementSigned ? (
                <div className="guided-step-success" role="status">
                  <CheckCircle2 size={22} />
                  <div>
                    <strong>Agreement signed successfully</strong>
                    <span>Press “Continue to secure payment” below.</span>
                  </div>
                </div>
              ) : (
                <div className="agreement-guidance" role="note">
                  <ArrowDown size={22} />
                  <div>
                    <strong>Scroll down to complete this step</strong>
                    <span>Read the agreement, check the acknowledgment, type your legal name, draw your signature, then press the green sign button.</span>
                  </div>
                </div>
              )}

              <div className="agreement-preview wizard-agreement">
                <pre>{agreementText}</pre>
              </div>

              {!agreementSigned && (
                <>
                  <div className="agreement-end-marker"><ArrowDown size={18} /> End of agreement — complete the signature below</div>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={agreementChecked}
                      onChange={(e) => {
                        setWizardReminder(null);
                        setAgreementChecked(e.target.checked);
                      }}
                    />
                    I have read and agree to the rental agreement.
                  </label>

                  <input
                    className="signature-input"
                    placeholder="Type full legal name as signature"
                    value={signatureName}
                    onChange={(e) => {
                      setWizardReminder(null);
                      setSignatureName(e.target.value);
                    }}
                  />

                  <SignaturePad value={signatureImageData} onChange={setSignatureImageData} />

                  <button className="primary-btn agreement-sign-continue" onClick={() => {
                    setWizardReminder(null);
                    signAgreement();
                  }} disabled={agreementSaving}>
                    <FileSignature size={18} />
                    {agreementSaving ? 'Signing securely…' : 'Sign agreement & continue to payment'}
                  </button>
                </>
              )}
            </div>
          )}

          {wizardStep === 6 && (
            <div>
              <p className="muted">
                Confirm the totals, refundable deposit rules, mileage, pickup address, and required items before continuing to payment.
              </p>

              <div className="invoice-row"><span>Rental Days</span><strong>{currentRental ? getRentalDaysSafe(currentRental.pickup_date, currentRental.return_date) : estimate ? `${estimate.days} days` : 'Pending'}</strong></div>
              <div className="invoice-row"><span>Base Rental</span><strong>{currentRental ? money(currentRental.base_rental_total ?? currentRental.rental_total) : estimate ? money(estimate.baseRentalTotal) : 'Pending'}</strong></div>
              {Number(currentRental?.under_25_markup_amount || estimate?.markupAmount || 0) > 0 && <div className="invoice-row"><span>Under-25 Rental Markup ({Number(currentRental?.under_25_markup_percentage ?? estimate?.markupPercentage ?? 0)}%)</span><strong>{money(currentRental?.under_25_markup_amount ?? estimate?.markupAmount)}</strong></div>}
              {Number(currentRental?.discount_amount || 0) > 0 && <div className="invoice-row discount-row"><span>Discount ({currentRental.discount_code})</span><strong>−{money(currentRental.discount_amount)}</strong></div>}
              <div className="invoice-row"><span>Rental Total</span><strong>{currentRental ? money(currentRental.rental_total) : estimate ? money(estimate.rentalTotal) : 'Pending'}</strong></div>
              <div className="invoice-row"><span>Taxes</span><strong>{currentRental ? money(currentRental.tax_amount) : estimate ? money(estimate.taxAmount) : 'Pending'}</strong></div>
              <div className="invoice-row"><span>Security Deposit</span><strong>{currentRental?.discount_waives_security_deposit ? 'Waived' : currentRental ? money(currentRental.security_deposit) : estimate ? money(estimate.securityDeposit) : 'Pending'}</strong></div>
              <ServiceFeesSummary serviceFees={serviceFees} total={currentRental?.service_fee_total ?? estimate?.serviceFeeTotal} />
              <div className="invoice-row"><span>Mileage</span><strong>{MILEAGE_POLICY}</strong></div>
              <div className="invoice-row"><span>Pickup</span><strong>{RENTMECT_ADDRESS}</strong></div>
              <div className="invoice-row"><span>Booking checklist</span><strong>Phone, Identity, license, insurance, and agreement are complete before payment unlocks.</strong></div>
              {currentRental && !paymentPaid && <div className="discount-code-card">
                <div><Tag size={19}/><span><strong>{currentRental.discount_code ? `${currentRental.discount_code} applied` : 'Promotion code'}</strong><small>{currentRental.discount_code ? `You saved ${money(currentRental.discount_amount)}.` : 'Apply the code before opening Stripe.'}</small></span></div>
                {!currentRental.discount_code && <div className="discount-code-entry"><input aria-label="Discount code" value={discountInput} maxLength="24" placeholder="DISCOUNT CODE" onChange={(event) => setDiscountInput(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}/><button type="button" className="secondary-btn" disabled={discountSaving || !discountInput.trim()} onClick={applyCustomerDiscount}>{discountSaving ? 'Applying…' : 'Apply code'}</button></div>}
              </div>}

              {paymentPaid && <p className="auth-message">{currentRental?.discount_waives_security_deposit ? 'Booking completed with the security deposit waived.' : 'Payment recorded. Deposit is marked as held.'}</p>}
              {(!identityVerified || !licenseUploaded || !insuranceUploaded) && (
                <div className="pickup-reminder-box compact-reminder">
                  <ShieldCheck size={22} />
                  <div>
                  <strong>Verification still required</strong>
                  <span>Return to the required checklist step before opening Stripe.</span>
                  </div>
                </div>
              )}
              <button className="primary-btn" onClick={startStripeCheckout} disabled={paymentSaving || paymentPaid}>
                {paymentPaid ? 'Payment Complete' : paymentSaving ? 'Opening Stripe...' : 'Pay With Stripe'}
              </button>
            </div>
          )}

          {wizardStep === 2 && (
            <IdentityVerificationPanel
              status={identityStatus}
              verified={identityVerified}
              errorCode={identityErrorCode}
              saving={identitySaving}
              onStart={startIdentityVerification}
              onRefresh={() => refreshIdentityVerification(true)}
              onEditProfile={(target) => {
                setWizardReminder(null);
                setIdentityCorrectionTarget(target);
                setWizardStep(0);
              }}
            />
          )}

          {wizardStep === 3 && (
            <div>
              <p className="muted">
                {licenseUploaded
                  ? 'Your driver license is already on file for future rentals. Replace it here if Rent Me CT asks for a new copy.'
                  : 'Upload a clear driver license image or PDF once. Rent Me CT can reuse it for returning rentals.'}
              </p>
              {licenseUploaded ? (
                <div className="wizard-upload-complete">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>Driver license uploaded</strong>
                    <span>It is on file. Upload insurance next if this rental still needs it.</span>
                  </div>
                </div>
              ) : (
                <label className={`secondary-btn ${documentUploadBusy?.license ? 'is-busy' : ''}`}>
                  {documentUploadBusy?.license ? 'Uploading license…' : 'Upload Driver License'}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      setWizardReminder(null);
                      uploadDocument(e, 'license');
                    }}
                    disabled={Boolean(documentUploadBusy?.license)}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>
          )}

          {wizardStep === 4 && (
            <div>
              <p className="muted">
                {insuranceUploaded
                  ? 'Insurance is uploaded for this rental. Rent Me CT will review it before vehicle release.'
                  : 'Upload proof of active auto insurance. Rent Me CT must have insurance on file before pickup.'}
              </p>
              <InsuranceOptionsPanel insuranceCoverage={insuranceCoverage} setInsuranceCoverage={setInsuranceCoverage} />
              {insuranceUploaded ? (
                <div className="wizard-upload-complete">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>Insurance uploaded</strong>
                    <span>This guided step is complete.</span>
                  </div>
                </div>
              ) : (
                <label className={`secondary-btn ${documentUploadBusy?.insurance ? 'is-busy' : ''}`}>
                  {documentUploadBusy?.insurance ? 'Uploading insurance…' : 'Upload Insurance'}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      setWizardReminder(null);
                      uploadDocument(e, 'insurance');
                    }}
                    disabled={Boolean(documentUploadBusy?.insurance)}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <div className="wizard-actions">
          <button
            className="secondary-btn"
            type="button"
            onClick={previousWizardStep}
            disabled={wizardStep <= 0}
          >
            Back
          </button>
          <button
            className="primary-btn"
            type="button"
            onClick={nextWizardStep}
          >
            {wizardStep === wizardSteps.length - 1
              ? 'Finish'
              : wizardStep === 5
                ? agreementSigned ? 'Continue to secure payment' : 'Next — confirm signed agreement'
                : 'Next'}
          </button>
        </div>

        {vehicleReminder && (
          <div className="vehicle-reminder-backdrop" role="presentation">
            <div className="vehicle-reminder-modal" role="dialog" aria-modal="true" aria-labelledby="vehicleReminderTitle">
              <button
                className="wizard-close"
                type="button"
                onClick={() => setVehicleReminder(null)}
                aria-label="Close vehicle reminder"
              >
                <X size={20} />
              </button>
              <p className="eyebrow">Before Checkout</p>
              <h3 id="vehicleReminderTitle">Have these ready for {vehicleReminder.name}</h3>
              <div className="vehicle-reminder-list">
                <div>
                  <FileText size={20} />
                  <span>Driver's license number</span>
                </div>
                <div>
                  <ShieldCheck size={20} />
                  <span>Insurance declaration page if you opt out of Wheelbase insurance</span>
                </div>
              </div>
              <button className="primary-btn" type="button" onClick={() => setVehicleReminder(null)}>
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgreementModal({
  agreementText,
  agreementChecked,
  agreementSigned,
  setAgreementChecked,
  signatureName,
  setSignatureName,
  signatureImageData,
  setSignatureImageData,
  signAgreement,
  agreementSaving,
  currentRental,
  onClose,
}) {
  const dialogRef = useDialogFocus(onClose);
  const scrollRef = useRef(null);
  const alreadySigned = Boolean(currentRental?.agreement_snapshot);
  const [agreementReviewed, setAgreementReviewed] = useState(alreadySigned);
  const displayedAgreement = currentRental?.agreement_snapshot || agreementText;
  const displayedSignatureImage = extractSignatureImage(displayedAgreement);
  const printableAgreement = String(displayedAgreement || '').replace(
    /Drawn Signature Image:\s*data:image\/png;base64,[^\s]+/,
    'Drawn Signature Image: embedded below',
  );

  function trackAgreementReview() {
    const reviewBox = scrollRef.current;
    if (!reviewBox || agreementReviewed) return;
    const reachedEnd = reviewBox.scrollTop + reviewBox.clientHeight >= reviewBox.scrollHeight - 24;
    if (reachedEnd) setAgreementReviewed(true);
  }

  useEffect(() => {
    const reviewBox = scrollRef.current;
    if (!reviewBox || alreadySigned) return;
    if (reviewBox.scrollHeight <= reviewBox.clientHeight + 24) setAgreementReviewed(true);
  }, [alreadySigned, displayedAgreement]);

  return (
    <div className="modal-backdrop" role="presentation">
      <div ref={dialogRef} className="agreement-modal" role="dialog" aria-modal="true" aria-labelledby="agreement-modal-title" tabIndex="-1">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Rental Agreement</p>
            <h2 id="agreement-modal-title">Review & Sign</h2>
          </div>
          <button className="wizard-close" type="button" aria-label="Close rental agreement" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={`agreement-review-status ${agreementReviewed ? 'complete' : ''}`} role="status" aria-live="polite">
          {alreadySigned
            ? 'This is the exact signed agreement stored with your rental.'
            : agreementReviewed
              ? 'Full agreement reviewed. The acknowledgment and signature fields are unlocked below.'
              : 'Review the complete agreement and scroll to the bottom to unlock signing.'}
        </div>

        <div ref={scrollRef} className="agreement-scroll-box" onScroll={trackAgreementReview} tabIndex="0" aria-label="Complete rental agreement">
          <pre>{printableAgreement}</pre>
          {alreadySigned && displayedSignatureImage && <div className="agreement-stored-signature">
            <strong>Stored electronic signature</strong>
            <img src={displayedSignatureImage} alt={`Electronic signature for ${currentRental.agreement_signature_name || 'renter'}`} />
          </div>}
        </div>

        <div className="agreement-sign-box">
          {!alreadySigned && <><label className="checkbox-row">
            <input
              type="checkbox"
              checked={agreementChecked}
              onChange={(e) => setAgreementChecked(e.target.checked)}
              disabled={!agreementReviewed}
            />
            I have read and agree to the rental agreement.
          </label>

              <label className="signature-field">
                <span>Full legal name</span>
                <input
                  className="signature-input"
                  placeholder="Type full legal name as signature"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                />
              </label>

          <SignaturePad value={signatureImageData} onChange={setSignatureImageData} />
          </>}

          <div className="button-row end-row agreement-sign-actions">
            <button className="secondary-btn" type="button" onClick={onClose}>Cancel</button>
            {currentRental?.agreement_snapshot && (
              <button className="secondary-btn" type="button" onClick={() => downloadAgreement(currentRental)}>
                Download Agreement
              </button>
            )}
            {!alreadySigned && <button
              className="primary-btn"
              type="button"
              onClick={signAgreement}
              disabled={agreementSaving || !agreementReviewed || !agreementChecked || !signatureName.trim() || !signatureImageData}
            >
              <FileSignature size={17} /> {agreementSaving ? 'Signing...' : 'Sign Agreement'}
            </button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (source.clientX - rect.left) * scaleX,
      y: (source.clientY - rect.top) * scaleY,
      lineScale: (scaleX + scaleY) / 2,
    };
  }

  function start(event) {
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const point = getPoint(event);
    drawingRef.current = true;
    context.lineWidth = 2.4 * point.lineScale;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#172033';
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function move(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const point = getPoint(event);
    context.lineWidth = 2.4 * point.lineScale;
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stop() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  }

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = value;
  }, [value]);

  return <div className="signature-pad-wrap">
    <div className="signature-pad-header">
      <strong>Draw signature</strong>
      <button className="link-btn" type="button" onClick={clear}>Clear</button>
    </div>
    <canvas
      ref={canvasRef}
      className="signature-pad"
      width="720"
      height="220"
      onMouseDown={start}
      onMouseMove={move}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchMove={move}
      onTouchEnd={stop}
      aria-label="Draw your signature"
    />
  </div>;
}

function InsuranceOptionsPanel({ insuranceCoverage, setInsuranceCoverage }) {
  return <div className="insurance-options-panel">
    <div>
      <strong>Insurance options</strong>
      <span>Confirm your policy includes both coverages before upload.</span>
    </div>
    <div className="insurance-checks">
      <label><input type="checkbox" checked={insuranceCoverage.collision} onChange={(event) => setInsuranceCoverage({ ...insuranceCoverage, collision: event.target.checked })} /> Collision coverage</label>
      <label><input type="checkbox" checked={insuranceCoverage.liability} onChange={(event) => setInsuranceCoverage({ ...insuranceCoverage, liability: event.target.checked })} /> Liability coverage</label>
    </div>
    <a className="secondary-btn" href="#payment">Review payment and insurance requirements</a>
  </div>;
}

function ServiceFeesSummary({ serviceFees, total }) {
  const feeTotal = Number(total ?? serviceFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0));
  if (!serviceFees.length && feeTotal <= 0) return null;

  return <div className="invoice-row fee-summary-row">
    <span>Booking Fees</span>
    <strong>
      {serviceFees.length ? `${serviceFees.map((fee) => `${fee.name}: ${money(fee.amount)}`).join(' | ')} — ${money(feeTotal)} total` : money(feeTotal)}
    </strong>
  </div>;
}

function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="road"><div className="loading-car">▰</div></div>
      <h1>Getting your rental ready...</h1>
    </div>
  );
}

function Notice({ notice, onDismiss }) {
  const isError = notice.type === 'error';
  return (
    <div className={`notice-banner ${notice.type || 'info'}`} role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'} aria-atomic="true">
      <span>{notice.text}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">Dismiss</button>
    </div>
  );
}

function PortalDataHealth({ health, onRetry }) {
  if (!health?.errors?.length && !health?.refreshing) return null;
  const lastUpdated = health.lastUpdated ? new Date(health.lastUpdated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  if (!health.errors.length) {
    return <div className="portal-data-health refreshing" role="status" aria-live="polite"><Clock size={18}/><span>Refreshing your rental information{lastUpdated ? ` • last updated ${lastUpdated}` : ''}…</span></div>;
  }
  return <section className="portal-data-health error" role="alert" aria-live="assertive">
    <AlertTriangle size={20}/>
    <div>
      <strong>Some information could not refresh</strong>
      <span>{health.errors.map((item) => item.label).join(', ')} may be incomplete. Your existing information has not been changed.</span>
      <details><summary>View details</summary><ul>{health.errors.map((item) => <li key={item.label}><strong>{item.label}:</strong> {item.message}</li>)}</ul></details>
    </div>
    <button type="button" className="secondary-btn" onClick={onRetry} disabled={health.refreshing}>{health.refreshing ? 'Retrying…' : 'Try again'}</button>
  </section>;
}

function userFacingPortalError(error, fallback = 'Something went wrong. Please try again.') {
  const message = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
    typeof error === 'string' ? error : '',
  ].filter(Boolean).join(' ').trim();
  if (!message) return fallback;
  if (/failed to fetch|network|load failed|connection|timeout/i.test(message)) return 'The connection was interrupted. Check your internet connection and try again.';
  if (/jwt|token|session|not authenticated/i.test(message)) return 'Your secure session needs to be refreshed. Sign in again and retry.';
  if (/already uses this mobile number|profiles_normalized_phone_unique_idx/i.test(message)) {
    return 'This mobile number is already linked to another Rent Me CT account. Sign in with the email for that account, or contact Rent Me CT to safely correct the account. A verification code was not sent.';
  }
  if (/already uses this email|profiles_normalized_email_unique_idx/i.test(message)) {
    return 'This email is already linked to a Rent Me CT account. Sign in to that account or use Forgot Password. Your renter details were not changed.';
  }
  if (/duplicate key|already exists/i.test(message)) return 'That update was already recorded. Refresh to see the latest status.';
  return fallback;
}

function customerSafeMessage(message, fallback = 'Something went wrong. Please try again.') {
  const text = String(message || '').trim();
  if (!text) return fallback;
  if (
    /(?:insert|update|delete|select)\s+(?:on|from|into)\s+table|foreign key|constraint|violates|duplicate key|relation\s+["']|column\s+["']|schema cache|sqlstate|pgrst\d+|row-level security|permission denied for (?:table|schema|function)|null value in column|syntax error at or near|sensitive verification results|restricted api key|access-verification-results|stripe\.com\/docs\/identity/i.test(text)
  ) {
    return fallback;
  }
  return text;
}

function isTransientPortalError(error) {
  const message = String(error?.message || error || '').trim();
  return /failed to fetch|network|load failed|connection|timeout/i.test(message);
}

function validateDocumentFile(file) {
  if (file.size > MAX_DOCUMENT_BYTES) return 'Choose a document smaller than 10 MB.';
  if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) return 'Choose a PDF, JPEG, PNG, or WebP document.';
  return '';
}

function useDialogFocus(onClose) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const firstFocusable = dialog.querySelector(focusableSelector);
    window.requestAnimationFrame(() => (firstFocusable || dialog).focus());
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)].filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);
  return dialogRef;
}

class PortalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error('Client portal render failed', error);
  }
  render() {
    if (this.state.failed) {
      return <main className="portal-error-boundary"><div><AlertTriangle size={28}/><h1>We couldn’t display your portal</h1><p>Your rental information was not changed. Refresh the page to reconnect securely.</p><button type="button" className="primary-btn" onClick={() => window.location.reload()}>Refresh portal</button></div></main>;
    }
    return this.props.children;
  }
}

class FlowStepErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error(`${this.props.label || 'Guided step'} render failed`, error);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="modal-backdrop" role="presentation">
          <div className="flow-step-error" role="alert">
            <AlertTriangle size={30} />
            <h2>This step needs to reconnect</h2>
            <p>Your rental progress was not erased. Close this step and resume it from the dashboard.</p>
            <div className="button-row">
              <button type="button" className="primary-btn" onClick={this.props.onClose}>Return to guided steps</button>
              <button type="button" className="secondary-btn" onClick={() => window.location.reload()}>Refresh portal</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MobileFlowStatus({ items }) {
  if (!items?.length) return null;

  return (
    <section className="mobile-flow-status" aria-label="Rental status">
      {items.map((item) => (
        <div className={`mobile-flow-card ${item.tone || 'info'}`} key={item.key}>
          <strong>{item.title}</strong>
          <span>{item.text}</span>
        </div>
      ))}
    </section>
  );
}

function ReturnReviewNotice({ report }) {
  if (!report) return null;

  const depositHeld = Number(report.deposit_held_amount || 0);
  const issueLabel = prettyStatus(report.issue_type || 'return review');

  return (
    <section className="return-review-notice" aria-label="Return review status">
      <AlertTriangle size={22} />
      <div>
        <p className="eyebrow">Return Review</p>
        <h3>{issueLabel} case open</h3>
        <p>
          Rent Me CT is reviewing this return. {depositHeld > 0 ? `Your ${money(depositHeld)} security deposit is on hold while the case is reviewed.` : 'We will update you before anything changes with your deposit.'}
        </p>
        {report.description && <span>{report.description}</span>}
      </div>
      <strong>{prettyStatus(report.status || 'open')}</strong>
    </section>
  );
}

function PreviewVehicleGallery({ vehicle, compact = false, badge = '' }) {
  const images = getVehicleImages(vehicle);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(null);
  const imageKey = images.join('|');

  useEffect(() => {
    setActiveIndex(0);
  }, [vehicle?.id, imageKey]);

  const show = (requestedIndex) => {
    setActiveIndex((requestedIndex + images.length) % images.length);
  };

  const recoverImage = (event, index) => {
    const fallback = getVehicleImageFallback(vehicle, index);
    const currentSource = event.currentTarget.getAttribute('src');
    if (fallback && currentSource !== fallback) {
      event.currentTarget.src = fallback;
      return;
    }
    event.currentTarget.hidden = true;
  };

  return (
    <section className={`preview-vehicle-gallery${compact ? ' compact' : ''}`} aria-label={`${vehicle?.name || 'Vehicle'} photos`}>
      <div
        className="preview-vehicle-gallery-frame"
        onTouchStart={(event) => {
          if (event.touches.length === 1) touchStartX.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null || !event.changedTouches.length) return;
          const distance = event.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(distance) >= 42) show(activeIndex + (distance > 0 ? -1 : 1));
        }}
      >
        <img
          src={images[activeIndex]}
          alt={`${vehicle?.name || 'Vehicle'} photo ${activeIndex + 1} of ${images.length}`}
          onError={(event) => recoverImage(event, activeIndex)}
        />
        {badge && <span className="preview-badge">{badge}</span>}
        <button className="preview-gallery-arrow previous" type="button" onClick={() => show(activeIndex - 1)} aria-label="Show previous vehicle photo">
          <ChevronLeft size={compact ? 18 : 22} />
        </button>
        <button className="preview-gallery-arrow next" type="button" onClick={() => show(activeIndex + 1)} aria-label="Show next vehicle photo">
          <ChevronRight size={compact ? 18 : 22} />
        </button>
        <span className="preview-gallery-counter" aria-live="polite">{activeIndex + 1} / {images.length}</span>
      </div>
      <div className="preview-gallery-thumbnails" aria-label="Choose a vehicle photo">
        {images.map((image, index) => (
          <button
            className={index === activeIndex ? 'active' : ''}
            type="button"
            key={`${image}-${index}`}
            onClick={() => show(index)}
            aria-label={`Show ${vehicle?.name || 'vehicle'} photo ${index + 1}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          >
            <img src={image} alt="" onError={(event) => recoverImage(event, index)} />
          </button>
        ))}
      </div>
    </section>
  );
}

function PreviewGuestExperience({
  page,
  setPage,
  authForm,
  setAuthForm,
  handleAuth,
  verifyEmailOtp,
  emailOtp,
  setEmailOtp,
  emailOtpSent,
  setEmailOtpSent,
  emailAuthBusy,
  message,
  reservationForm,
  vehicle,
  estimate,
  checkoutSecondsRemaining,
  checkoutExpired,
  directCheckout = false,
  adminBookingHandoff = null,
  changeCheckoutDatesOrVehicle,
}) {
  const days = Math.max(1, getRentalDays(reservationForm.pickupDate, reservationForm.returnDate));
  const displayVehicle = vehicle || { id: BOOKING_FLOW_TEST_VEHICLE_ID, name: 'Booking Flow Test Vehicle', brand: 'Rent Me CT', model: 'Checkout Preview', vehicle_type: 'Internal Test', daily_rate: 1, security_deposit: 300, description: 'Internal test vehicle for the booking flow.', features: TEST_VEHICLE_FEATURES };
  const features = getVehicleFeatures(displayVehicle);
  const rental = Number(estimate?.rentalTotal ?? Number(displayVehicle.daily_rate || 0) * days);
  const serviceFeeTotal = Number(estimate?.serviceFeeTotal || 0);
  const tax = Number(estimate?.taxAmount ?? rental * CT_TAX_RATE);
  const deposit = Number(estimate?.securityDeposit ?? displayVehicle.security_deposit ?? 300);
  const total = rental + serviceFeeTotal + tax + deposit;
  const update = (key, value) => setAuthForm({ ...authForm, [key]: value });

  if (checkoutExpired) {
    return <CheckoutExpiredScreen reservationForm={reservationForm} />;
  }

  if (page === 'checkout') {
    const adminManagedBooking = Boolean(adminBookingHandoff?.rental_id);
    const returningPath = adminBookingHandoff?.customer_path === 'returning';
    return (
      <div className="preview-guest-shell">
        <PreviewTopbar
          onBack={adminManagedBooking ? undefined : () => directCheckout ? changeCheckoutDatesOrVehicle() : setPage('details')}
          label={directCheckout ? 'Change dates or vehicle' : 'Back to vehicle details'}
        />
        <main className="preview-checkout-layout preview-guest-checkout">
          <section className="preview-checkout-column">
            <div className="preview-page-heading">
              <p className="eyebrow">Secure checkout</p>
              <h1>{adminManagedBooking ? 'Review your selected trip.' : 'Let’s get your trip ready.'}</h1>
              <p>{adminManagedBooking
                ? 'Rent Me CT selected the vehicle and dates shown here. Enter the email attached to this booking to continue.'
                : 'Your account is created automatically. No password to remember.'}</p>
              {adminManagedBooking && (
                <div className="preview-guided-path-banner">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>{returningPath ? 'Returning customer fast path' : 'New customer guided setup'}</strong>
                    <span>{returningPath
                      ? 'Your verified phone, Stripe Identity check, and approved driver license will be reused. You will only complete requirements still missing for this rental.'
                      : 'After email login, the checklist will guide you through phone, identity, documents, agreement, and payment.'}</span>
                  </div>
                </div>
              )}
            </div>
            <form className="preview-auth-section" onSubmit={emailOtpSent ? verifyEmailOtp : handleAuth}>
              <div className="preview-section-number">1</div>
              <div className="preview-section-content">
                <div className="preview-section-title">
                  <div>
                    <h2>Contact information</h2>
                    <p>{adminManagedBooking ? 'Use the exact email that received this booking link.' : 'We’ll use this email for your receipt and secure trip access.'}</p>
                  </div>
                  <ShieldCheck size={22} />
                </div>
                <label>
                  <span>Email address</span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={authForm.email}
                    onChange={(event) => update('email', event.target.value)}
                    disabled={emailOtpSent || emailAuthBusy}
                    required
                  />
                </label>
                {emailOtpSent && <>
                  <label>
                    <span>One-time email code</span>
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter the code from your email"
                      value={emailOtp}
                      onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, '').slice(0, 8))}
                      required
                    />
                  </label>
                  <EmailVerificationSpamNotice email={authForm.email} />
                </>}
                <button className="preview-primary-button" type="submit" disabled={emailAuthBusy || checkoutExpired}>
                  {emailAuthBusy ? 'Please wait…' : emailOtpSent ? 'Verify email & continue' : 'Continue with email'}
                  <ChevronRight size={18} />
                </button>
                {message && <p className="preview-inline-message">{message}</p>}
                {emailOtpSent && (
                  <button className="preview-text-button" type="button" onClick={() => {
                    setEmailOtp('');
                    setEmailOtpSent(false);
                  }}>
                    Use a different email
                  </button>
                )}
                <p className="preview-security-note"><ShieldCheck size={16} /> {adminManagedBooking
                  ? 'The link never signs anyone in automatically. The booking email must be verified.'
                  : 'Returning customers receive the same secure code—no temporary passwords.'}</p>
              </div>
            </form>
          </section>
          <PreviewTripSummary
            reservationForm={reservationForm}
            rentalTotal={rental}
            serviceFeeTotal={serviceFeeTotal}
            taxAmount={tax}
            securityDeposit={deposit}
            total={total}
            vehicle={displayVehicle}
            secondsRemaining={checkoutSecondsRemaining}
            expired={checkoutExpired}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="preview-detail-shell">
      <PreviewTopbar />
      <main className="preview-detail-main">
        <PreviewVehicleGallery vehicle={displayVehicle} badge="Preview vehicle" />

        <div className="preview-detail-layout">
          <div className="preview-detail-copy">
            <p className="eyebrow">Booking Preview</p>
            <h1>{displayVehicle.name}</h1>
            <p className="preview-vehicle-subtitle">{[displayVehicle.brand, displayVehicle.model, displayVehicle.vehicle_type].filter(Boolean).join(' • ')}</p>
            <div className="preview-spec-pills">
              <span><Car size={17} /> 5 seats</span>
              <span><CreditCard size={17} /> Automatic</span>
              <span><ShieldCheck size={17} /> Verified fleet</span>
            </div>

            <section className="preview-detail-section">
              <h2>About this vehicle</h2>
              <p>{displayVehicle.description || 'A clean, reliable Rent Me CT vehicle. Your selected dates and times have carried over automatically.'}</p>
            </section>

            <section className="preview-detail-section">
              <h2>Vehicle features</h2>
              <div className="preview-feature-grid">
                {features.map((feature) => <span key={feature}><CheckCircle2 size={17} /> {feature}</span>)}
              </div>
            </section>

            <section className="preview-detail-section preview-policy-grid">
              <div><strong>200 miles/day</strong><span>Included with your rental</span></div>
              <div><strong>Secure verification</strong><span>Identity and documents protected</span></div>
              <div><strong>Farmington pickup</strong><span>{RENTMECT_ADDRESS}</span></div>
            </section>
          </div>

          <aside className="preview-detail-card">
            <p className="preview-price"><strong>{money(rental)}</strong> rental subtotal</p>
            <div className="preview-trip-dates">
              <div><span>Trip start</span><strong>{formatRentalDate(reservationForm.pickupDate, reservationForm.pickupTime)}</strong></div>
              <div><span>Trip end</span><strong>{formatRentalDate(reservationForm.returnDate, reservationForm.returnTime)}</strong></div>
            </div>
            <div className="preview-price-row"><span>{days} rental {days === 1 ? 'day' : 'days'}</span><strong>{money(rental)}</strong></div>
            {serviceFeeTotal > 0 && <div className="preview-price-row"><span>Booking fees</span><strong>{money(serviceFeeTotal)}</strong></div>}
            <div className="preview-price-row"><span>Estimated tax</span><strong>{money(tax)}</strong></div>
            <div className="preview-price-row"><span>Refundable deposit</span><strong>{money(deposit)}</strong></div>
            <div className="preview-price-row preview-total-row"><span>Due today</span><strong>{money(total)}</strong></div>
            <button className="preview-primary-button" type="button" onClick={() => setPage('checkout')} disabled={checkoutExpired}>
              Continue to checkout <ChevronRight size={18} />
            </button>
            <small><ShieldCheck size={14} /> You won’t be charged on this screen.</small>
          </aside>
        </div>
      </main>
    </div>
  );
}

function PreviewTopbar({ onBack, label = 'Booking Preview' }) {
  return (
    <header className="preview-topbar">
      <div className="preview-topbar-inner">
        {onBack ? (
          <button type="button" onClick={onBack}><ArrowLeft size={18} /> {label}</button>
        ) : <span className="preview-mode-label">{label}</span>}
        <img src={logoMobileUrl} alt="Rent Me CT" />
        <span className="preview-secure-label"><ShieldCheck size={16} /> Secure booking</span>
      </div>
    </header>
  );
}

function PreviewCheckout({
  activeSection,
  setActiveSection,
  reservationForm,
  estimate,
  profileForm,
  setProfileForm,
  birthDateConfirmed,
  setConfirmedBirthDate,
  identityCorrectionTarget,
  setIdentityCorrectionTarget,
  userEmail,
  emailVerified,
  phoneCode,
  setPhoneCode,
  sendPhoneCode,
  verifyPhoneCode,
  sendingCode,
  verifyingCode,
  phoneVerified,
  contactStepCompleted,
  continueContact,
  reservationSaving,
  currentRental,
  vehicle,
  identityStatus,
  identityErrorCode,
  identityVerified,
  identitySaving,
  startIdentityVerification,
  refreshIdentityVerification,
  uploadDocument,
  documentUploadBusy,
  licenseUploaded,
  insuranceUploaded,
  insuranceCoverage,
  setInsuranceCoverage,
  agreementSigned,
  openAgreement,
  paymentPaid,
  paymentSaving,
  startStripeCheckout,
  serviceFees,
  discountInput,
  setDiscountInput,
  discountSaving,
  applyCustomerDiscount,
  checkoutSecondsRemaining,
  checkoutExpired,
  changeCheckoutDatesOrVehicle,
  signOut,
  openPortal,
  adminBookingHandoff = null,
}) {
  const documentsComplete = licenseUploaded && insuranceUploaded;
  const completedCount = [contactStepCompleted, identityVerified, documentsComplete, agreementSigned, paymentPaid].filter(Boolean).length;
  const rentalTotal = Number(currentRental?.rental_total ?? estimate?.rentalTotal ?? 0);
  const serviceFeeTotal = Number(currentRental?.service_fee_total ?? estimate?.serviceFeeTotal ?? 0);
  const taxAmount = Number(currentRental?.tax_amount ?? estimate?.taxAmount ?? 0);
  const securityDeposit = Number(currentRental?.security_deposit ?? estimate?.securityDeposit ?? 0);
  const total = rentalTotal + serviceFeeTotal + taxAmount + securityDeposit;
  const depositWaived = Boolean(currentRental?.discount_waives_security_deposit);
  const correctingIdentity = Boolean(identityCorrectionTarget);
  const showCorrectionName = ['full_name', 'identity_details'].includes(identityCorrectionTarget);
  const showCorrectionBirthday = ['date_of_birth', 'identity_details'].includes(identityCorrectionTarget);
  const adminManagedBooking = Boolean(adminBookingHandoff?.rental_id);
  const returningAdminPath = adminBookingHandoff?.customer_path === 'returning';

  useEffect(() => {
    if (paymentPaid) return;
    if (activeSection === 'identity' && identityVerified) setActiveSection('documents');
    if (activeSection === 'documents' && documentsComplete) setActiveSection('agreement');
    if (activeSection === 'agreement' && agreementSigned) setActiveSection('payment');
  }, [activeSection, identityVerified, documentsComplete, agreementSigned, paymentPaid, setActiveSection]);

  if (paymentPaid) {
    return (
      <div className="preview-checkout-shell">
        <PreviewTopbar />
        <main className="preview-confirmation">
          <CheckCircle2 size={54} />
          <p className="eyebrow">Booking received</p>
          <h1>Your booking is complete.</h1>
          <p>Payment is recorded. Rent Me CT can now review the submitted documents and prepare pickup details.</p>
          <div className="preview-confirmation-trip">
            <strong>{vehicle?.name || 'Your Rent Me CT vehicle'}</strong>
            <span>{formatRentalDate(reservationForm.pickupDate, reservationForm.pickupTime)}</span>
            <span>to {formatRentalDate(reservationForm.returnDate, reservationForm.returnTime)}</span>
          </div>
          <button className="preview-primary-button" type="button" onClick={openPortal}>Manage trip in client portal <ChevronRight size={18} /></button>
        </main>
      </div>
    );
  }

  if (checkoutExpired) {
    return <CheckoutExpiredScreen reservationForm={reservationForm} />;
  }

  return (
    <div className="preview-checkout-shell">
      <PreviewTopbar />
      <main className="preview-checkout-layout">
        <section className="preview-checkout-column">
          <div className="preview-page-heading preview-signed-in-heading">
            <div>
              <p className="eyebrow">Verify & pay</p>
              <h1>Complete your booking.</h1>
              <p>{completedCount} of 5 sections complete • Signed in as {userEmail}</p>
              {adminManagedBooking ? (
                <div className="preview-guided-path-banner">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>{returningAdminPath ? 'Returning customer fast path' : 'New customer guided setup'}</strong>
                    <span>{returningAdminPath
                      ? 'Verified phone, Stripe Identity, and approved driver license records remain completed. Finish only the open sections below.'
                      : 'The vehicle and dates were selected by Rent Me CT. Complete each open section below.'}</span>
                  </div>
                </div>
              ) : (
                <button className="preview-change-booking-button" type="button" onClick={changeCheckoutDatesOrVehicle} disabled={reservationSaving}>
                  <ArrowLeft size={16} /> Change dates or choose another vehicle
                </button>
              )}
            </div>
            <button className="preview-text-button" type="button" onClick={signOut}>Sign out</button>
          </div>

          <PreviewCheckoutSection number="1" title="Contact information" summary={contactStepCompleted ? `${profileForm.full_name} • Phone verified` : 'Tell us who will be driving'} completed={contactStepCompleted} open={activeSection === 'contact'} onOpen={() => setActiveSection('contact')}>
            {correctingIdentity && <div className="identity-correction-notice" role="status">
              <strong>Correct only the highlighted identity information.</strong>
              <span>Your verified email and phone number will not be changed or verified again.</span>
            </div>}
            <div className="preview-form-grid">
              {(!correctingIdentity || showCorrectionName) && <LegalNameFields
                className="preview-full-field"
                profileForm={profileForm}
                setProfileForm={setProfileForm}
                identityVerified={identityVerified && !correctingIdentity}
              />}
              {identityVerified && !correctingIdentity && <small className="preview-full-field identity-name-lock-note">Identity already verified. Your legal name and birthday are locked and reused for future rentals.</small>}
              {(!correctingIdentity || showCorrectionBirthday) && <BirthdayInput
                idPrefix="preview-birthday"
                value={profileForm.date_of_birth}
                onChange={(dateOfBirth) => setProfileForm((current) => ({ ...current, date_of_birth: dateOfBirth }))}
                confirmed={birthDateConfirmed}
                onConfirmedChange={(isConfirmed) => setConfirmedBirthDate(isConfirmed ? profileForm.date_of_birth : '')}
                autoFocus={identityCorrectionTarget === 'date_of_birth'}
                disabled={identityVerified && !correctingIdentity}
              />}
              {!correctingIdentity && <>
                <label className="preview-full-field"><span>Email</span><input value={userEmail} disabled /></label>
                <label className="preview-full-field"><span>What will you use the vehicle for?</span><textarea maxLength="500" value={profileForm.intended_vehicle_use} onChange={(event) => setProfileForm({ ...profileForm, intended_vehicle_use: event.target.value })} placeholder="Personal transportation, work, family trip…" /></label>
                <label className="preview-full-field"><span>Mobile number</span><input value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value, sms_transactional_opt_in: false })} placeholder="(860) 555-0123" /></label>
                <div className="preview-full-field"><EmailMarketingPreference profileForm={profileForm} setProfileForm={setProfileForm} /></div>
                <div className="preview-full-field"><SmsTransactionalPreference profileForm={profileForm} setProfileForm={setProfileForm} /></div>
                <div className="preview-full-field"><SmsVerificationDisclosure /></div>
              </>}
            </div>
            {!correctingIdentity && <div className="preview-inline-actions">
              <button className="preview-secondary-button" type="button" onClick={sendPhoneCode} disabled={sendingCode || phoneVerified}>{phoneVerified ? 'Phone verified' : sendingCode ? 'Saving & sending…' : 'Save details & send code'}</button>
              {!phoneVerified && <><input className="preview-code-input" inputMode="numeric" autoComplete="one-time-code" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Verification code" /><button className="preview-secondary-button" type="button" onClick={verifyPhoneCode} disabled={verifyingCode}>{verifyingCode ? 'Verifying…' : 'Verify phone'}</button></>}
            </div>}
            <button className="preview-primary-button" type="button" onClick={continueContact} disabled={reservationSaving || checkoutExpired}>{reservationSaving ? 'Saving…' : correctingIdentity ? 'Save correction & return to Identity' : currentRental ? 'Continue' : 'Save & continue'} <ChevronRight size={18} /></button>
          </PreviewCheckoutSection>

          <PreviewCheckoutSection number="2" title="Identity verification" summary={identityVerified ? 'Verified once and saved for returning rentals' : identityStatus === 'processing' ? 'Verification processing' : 'Government ID and selfie'} completed={identityVerified} open={activeSection === 'identity'} onOpen={() => setActiveSection('identity')}>
            <IdentityVerificationPanel
              status={identityStatus}
              errorCode={identityErrorCode}
              verified={identityVerified}
              saving={identitySaving}
              onStart={startIdentityVerification}
              onRefresh={() => refreshIdentityVerification(true)}
              onEditProfile={(target) => {
                setIdentityCorrectionTarget(target);
                setActiveSection('contact');
              }}
            />
          </PreviewCheckoutSection>

          <PreviewCheckoutSection number="3" title="Driver documents" summary={documentsComplete ? `${licenseUploaded && returningAdminPath ? 'Saved license reused' : 'License uploaded'} • Insurance uploaded` : `${licenseUploaded ? (returningAdminPath ? 'Saved license reused' : 'License uploaded') : 'License required'} • ${insuranceUploaded ? 'Insurance uploaded' : 'Insurance required'}`} completed={documentsComplete} open={activeSection === 'documents'} onOpen={() => setActiveSection('documents')}>
            <div className="preview-upload-grid">
              <PreviewUploadCard title="Driver license" text="PDF, JPEG, PNG, or WebP up to 10 MB. Reused for future rentals." complete={licenseUploaded} busy={Boolean(documentUploadBusy?.license)} onUpload={(event) => uploadDocument(event, 'license')} />
              <div>
                <InsuranceOptionsPanel insuranceCoverage={insuranceCoverage} setInsuranceCoverage={setInsuranceCoverage} />
                <PreviewUploadCard title="Proof of insurance" text="Current policy as PDF, JPEG, PNG, or WebP up to 10 MB." complete={insuranceUploaded} busy={Boolean(documentUploadBusy?.insurance)} onUpload={(event) => uploadDocument(event, 'insurance')} />
              </div>
            </div>
          </PreviewCheckoutSection>

          <PreviewCheckoutSection number="4" title="Rental agreement" summary={agreementSigned ? 'Agreement signed' : 'Review the terms and add your signature'} completed={agreementSigned} open={activeSection === 'agreement'} onOpen={() => setActiveSection('agreement')}>
            <div className="preview-agreement-summary">
              <FileSignature size={28} />
              <div><strong>{agreementSigned ? 'Agreement signed successfully' : 'Open the agreement and scroll down to sign'}</strong><p>{agreementSigned ? 'This requirement is complete. Payment is your final step.' : 'The acknowledgment, typed name, signature pad, and green sign button are below the agreement text.'}</p></div>
            </div>
            <button className="preview-primary-button" type="button" onClick={openAgreement} disabled={!documentsComplete}>{agreementSigned ? 'View signed agreement' : 'Review, scroll & sign agreement'} <ChevronRight size={18} /></button>
          </PreviewCheckoutSection>

          <PreviewCheckoutSection number="5" title="Payment" summary={paymentPaid ? 'Payment complete' : `Due today ${money(total)}`} completed={paymentPaid} open={activeSection === 'payment'} onOpen={() => setActiveSection('payment')}>
            {currentRental?.discount_code ? (
              <div className="preview-discount-applied" role="status">
                <span><strong>{currentRental.discount_code}</strong> applied</span>
                <strong>−{money(currentRental.discount_amount)}</strong>
              </div>
            ) : (
              <div className="preview-discount-entry">
                <label htmlFor="previewDiscountCode">Promotion or discount code</label>
                <div>
                  <input
                    id="previewDiscountCode"
                    value={discountInput}
                    maxLength="24"
                    placeholder="DISCOUNT CODE"
                    onChange={(event) => setDiscountInput(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  />
                  <button
                    type="button"
                    className="preview-secondary-button"
                    disabled={discountSaving || !discountInput.trim() || !currentRental?.id}
                    onClick={applyCustomerDiscount}
                  >
                    {discountSaving ? 'Applying…' : 'Apply code'}
                  </button>
                </div>
                {!currentRental?.id && <small>Finish the contact section first, then apply your code before payment.</small>}
              </div>
            )}
            <div className="preview-payment-breakdown">
              <div><span>Rental</span><strong>{money(rentalTotal)}</strong></div>
              <div><span>CT sales tax</span><strong>{money(taxAmount)}</strong></div>
              <div><span>Refundable security deposit</span><strong>{depositWaived ? 'Waived' : money(securityDeposit)}</strong></div>
              <ServiceFeesSummary serviceFees={serviceFees} total={serviceFeeTotal} />
              <div className="preview-payment-total"><span>Total due today</span><strong>{money(total)}</strong></div>
            </div>
            <p className="preview-security-note"><ShieldCheck size={16} /> {isBookingFlowTestVehicle(vehicle) ? 'Internal test checkout records no charge and can never be used for a real vehicle.' : 'Payment opens Stripe’s secure hosted checkout after every verification step is complete.'}</p>
            <button className="preview-primary-button preview-pay-button" type="button" onClick={startStripeCheckout} disabled={paymentSaving || !agreementSigned || checkoutExpired}>{paymentSaving ? 'Completing…' : isBookingFlowTestVehicle(vehicle) ? 'Complete no-charge test booking' : `Pay ${money(total)} & book trip`} <ChevronRight size={18} /></button>
          </PreviewCheckoutSection>
        </section>

        <PreviewTripSummary reservationForm={reservationForm} rentalTotal={rentalTotal} serviceFeeTotal={serviceFeeTotal} taxAmount={taxAmount} securityDeposit={securityDeposit} depositWaived={depositWaived} total={total} secondsRemaining={checkoutSecondsRemaining} expired={checkoutExpired} vehicle={vehicle} />
      </main>
    </div>
  );
}

function PreviewCheckoutSection({ number, title, summary, completed, open, onOpen, children }) {
  return (
    <section className={`preview-checkout-section ${open ? 'open' : ''} ${completed ? 'complete' : ''}`}>
      <button className="preview-checkout-section-header" type="button" onClick={onOpen} aria-expanded={open}>
        <span className="preview-section-number">{completed ? <CheckCircle2 size={18} /> : number}</span>
        <span><strong>{title}</strong><small>{summary}</small></span>
        <ChevronRight className="preview-section-chevron" size={20} />
      </button>
      {open && <div className="preview-checkout-section-body">{children}</div>}
    </section>
  );
}

function PreviewUploadCard({ title, text, complete, busy = false, onUpload }) {
  return (
    <label className={`preview-upload-card ${complete ? 'complete' : ''}`}>
      {complete ? <CheckCircle2 size={25} /> : <Upload size={25} />}
      <strong>{busy ? `Uploading ${title.toLowerCase()}…` : complete ? `${title} uploaded` : title}</strong>
      <span>{complete ? 'Ready for review. Choose a file to replace it.' : text}</span>
      <em>{busy ? 'Please wait…' : complete ? 'Replace file' : 'Choose file'}</em>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={onUpload} disabled={busy} />
    </label>
  );
}

function PreviewTripSummary({ reservationForm, rentalTotal, serviceFeeTotal = 0, taxAmount, securityDeposit, depositWaived = false, total, secondsRemaining, expired, vehicle }) {
  const displayVehicle = vehicle || { name: 'Booking Flow Test Vehicle', id: BOOKING_FLOW_TEST_VEHICLE_ID };
  const features = getVehicleFeatures(displayVehicle);
  return (
    <aside className="preview-trip-summary">
      <div className="preview-trip-vehicle">
        <div><span>Booking Preview</span><strong>{displayVehicle.name}</strong></div>
        <PreviewVehicleGallery vehicle={displayVehicle} compact />
        <div className="preview-trip-features">
          {features.map((feature) => <span key={feature}><CheckCircle2 size={13} /> {feature}</span>)}
        </div>
      </div>
      <div className="preview-trip-summary-dates">
        <div><CalendarDays size={18} /><span><small>Pickup</small><strong>{formatRentalDate(reservationForm.pickupDate, reservationForm.pickupTime)}</strong></span></div>
        <div><Clock size={18} /><span><small>Return</small><strong>{formatRentalDate(reservationForm.returnDate, reservationForm.returnTime)}</strong></span></div>
        <div><MapPin size={18} /><span><small>Location</small><strong>{RENTMECT_ADDRESS}</strong></span></div>
      </div>
      {secondsRemaining !== null && <CheckoutHoldTimer secondsRemaining={secondsRemaining} expired={expired} />}
      <div className="preview-trip-prices">
        <div><span>Rental</span><strong>{money(rentalTotal)}</strong></div>
        {Number(serviceFeeTotal) > 0 && <div><span>Booking fees</span><strong>{money(serviceFeeTotal)}</strong></div>}
        <div><span>Estimated tax</span><strong>{money(taxAmount)}</strong></div>
        <div><span>Refundable deposit</span><strong>{depositWaived ? 'Waived' : money(securityDeposit)}</strong></div>
        <div className="preview-total-row"><span>Due today</span><strong>{money(total)}</strong></div>
      </div>
      <p><ShieldCheck size={15} /> Secure checkout • Your progress is saved</p>
    </aside>
  );
}

function AuthScreen({
  authForm,
  setAuthForm,
  handleAuth,
  verifyEmailOtp,
  emailOtp,
  setEmailOtp,
  emailOtpSent,
  setEmailOtpSent,
  emailAuthBusy,
  message,
  checkoutIntent,
  pendingVehicleName,
  reservationForm,
  checkoutSecondsRemaining,
  checkoutExpired
}) {
  if (checkoutIntent && checkoutExpired) {
    return <CheckoutExpiredScreen reservationForm={reservationForm} />;
  }

  const update = (key, value) => setAuthForm({ ...authForm, [key]: value });

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={emailOtpSent ? verifyEmailOtp : handleAuth}>
        <img className="auth-logo" src={logoMobileUrl} alt="Rent Me CT" />
        <span className="auth-portal-label">Client</span>
        <h2>{checkoutIntent ? 'Continue Your Booking' : 'Passwordless Client Login'}</h2>
        <p className="muted">Enter your email once. We will securely sign you in—or create your account automatically if this is your first rental.</p>

        {checkoutIntent && checkoutSecondsRemaining !== null && (
          <CheckoutHoldTimer secondsRemaining={checkoutSecondsRemaining} expired={checkoutExpired} compact />
        )}

        <label>
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={authForm.email}
            onChange={(e) => update('email', e.target.value)}
            disabled={emailOtpSent || emailAuthBusy}
            required
          />
        </label>

        {emailOtpSent && <>
          <label>
            <span>One-time email code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Code from your email"
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
              required
            />
          </label>
          <EmailVerificationSpamNotice email={authForm.email} />
        </>}

        <button className="primary-btn" type="submit" disabled={emailAuthBusy || checkoutExpired}>
          {emailAuthBusy ? 'Please wait…' : emailOtpSent ? 'Verify & Open Booking' : 'Email My Secure Sign-In'}
        </button>

        {message && <p className="auth-message">{message}</p>}

        {emailOtpSent && <button className="link-btn" type="button" onClick={() => {
          setEmailOtp('');
          setEmailOtpSent(false);
        }}>Use a different email</button>}

        <p className="auth-legal-links">By continuing, you acknowledge the <a href="https://rentmect.com/terms.html" target="_blank" rel="noopener noreferrer">Website and SMS Terms</a> and <a href="https://rentmect.com/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
      </form>
    </div>
  );
}

function EmailVerificationSpamNotice({ email }) {
  return (
    <div className="email-verification-spam-notice" role="alert">
      <AlertTriangle size={22} />
      <div>
        <strong>CHECK YOUR SPAM FOLDER</strong>
        <span>
          We sent the Rent Me CT verification email to <b>{email}</b>. Enter the one-time code from that email.
          If it is not in your inbox, open your <b>SPAM</b> folder now.
        </span>
      </div>
    </div>
  );
}

function CheckoutHoldTimer({ secondsRemaining, expired, compact = false }) {
  return (
    <div className={`checkout-hold-timer ${expired ? 'expired' : ''} ${compact ? 'compact' : ''}`} role="timer" aria-live="polite">
      <Clock size={compact ? 18 : 21} />
      <div>
        <strong>{expired ? 'Vehicle hold expired' : `${formatCheckoutCountdown(secondsRemaining)} remaining`}</strong>
        <span>{expired ? 'Return to the fleet page to begin a new booking.' : 'Finish the required steps before this vehicle is released.'}</span>
      </div>
    </div>
  );
}

function CheckoutExpiredScreen({ reservationForm }) {
  return (
    <div className="preview-checkout-shell">
      <PreviewTopbar label="Secure booking" />
      <main className="preview-expired-screen" role="alert">
        <AlertTriangle size={52} />
        <p className="eyebrow">Vehicle hold expired</p>
        <h1>Let’s restart your booking.</h1>
        <p>
          The 25-minute checkout hold ended and the vehicle is available to other customers again.
          Your selected dates and times will carry back to the fleet page.
        </p>
        <button
          className="preview-primary-button"
          type="button"
          onClick={() => restartExpiredBooking(reservationForm)}
        >
          Choose a vehicle and restart <ChevronRight size={18} />
        </button>
        <small>No payment was taken for the expired checkout.</small>
      </main>
    </div>
  );
}

function restartExpiredBooking(reservationForm = {}) {
  try {
    localStorage.removeItem('rentmect_pending_booking');
    localStorage.removeItem('rentMeCtBooking');
    localStorage.removeItem('pendingBooking');
  } catch {
    // Continue to the fleet even when browser storage is unavailable.
  }

  navigateToFleet(reservationForm);
}

function navigateToFleet(reservationForm = {}) {
  let target;
  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    target = referrer?.pathname.endsWith('/cars-2.html')
      ? new URL(referrer.pathname, referrer.origin)
      : /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
        ? new URL(`${window.location.protocol}//${window.location.hostname}:5501/cars-2.html`)
        : new URL('https://rentmect.com/cars-2.html');
  } catch {
    target = new URL('https://rentmect.com/cars-2.html');
  }

  [
    ['pickupDate', reservationForm.pickupDate],
    ['returnDate', reservationForm.returnDate],
    ['pickupTime', reservationForm.pickupTime],
    ['returnTime', reservationForm.returnTime],
  ].forEach(([key, value]) => {
    if (value) target.searchParams.set(key, value);
  });

  const promo = new URLSearchParams(window.location.search).get('promo');
  if (promo) target.searchParams.set('promo', promo);
  window.location.assign(target.toString());
}

function SummaryItem({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || 'Pending'}</strong>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="metric-card">
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value || 'Pending'}</strong>
    </div>
  );
}

function identityMatchResults(status, errorCode) {
  const code = String(errorCode || '').toLowerCase();
  if (status === 'verified') {
    return [
      { label: 'Legal name', result: 'Match confirmed', matched: true },
      { label: 'Date of birth', result: 'Match confirmed', matched: true },
    ];
  }
  if (code === 'name_mismatch') {
    return [
      { label: 'Legal name', result: 'Does not match', matched: false },
      { label: 'Date of birth', result: 'Match confirmed', matched: true },
    ];
  }
  if (code === 'date_of_birth_mismatch') {
    return [
      { label: 'Legal name', result: 'Match confirmed', matched: true },
      { label: 'Date of birth', result: 'Does not match', matched: false },
    ];
  }
  if (code === 'identity_details_mismatch') {
    return [
      { label: 'Legal name', result: 'Does not match', matched: false },
      { label: 'Date of birth', result: 'Does not match', matched: false },
    ];
  }
  return [];
}

function identityCorrectionGuidance(errorCode) {
  const code = String(errorCode || '').toLowerCase();
  if (code === 'date_of_birth_mismatch') {
    return {
      title: 'Your saved date of birth does not match your government ID',
      explanation: 'Correct the date of birth in Renter details so it exactly matches the ID you submitted.',
      fix: 'Select the correction button below, update the date of birth, save and continue, then run Stripe Identity again.',
      action: 'Correct date of birth',
      preservesContact: true,
    };
  }
  if (code === 'name_mismatch') {
    return {
      title: 'Your saved legal name does not match your government ID',
      explanation: 'Correct your full legal name in Renter details so spelling, first name, and last name match the ID you submitted.',
      fix: 'Select the correction button below, update the legal name, save and continue, then run Stripe Identity again.',
      action: 'Correct legal name',
      preservesContact: true,
    };
  }
  if (code === 'identity_details_mismatch') {
    return {
      title: 'Your saved legal name and date of birth do not match your government ID',
      explanation: 'Correct both fields in Renter details so they exactly match the ID you submitted.',
      fix: 'Select the correction button below, update both highlighted details, save and continue, then run Stripe Identity again.',
      action: 'Correct renter details',
      preservesContact: true,
    };
  }
  if (code === 'profile_details_changed') {
    return {
      title: 'Your corrected renter details are saved',
      explanation: 'Start a new Stripe Identity check so Stripe can compare your ID with the corrected information.',
      fix: 'Select Run Stripe Identity again and complete the new ID and selfie check.',
      action: '',
      preservesContact: true,
    };
  }
  const stripeFailures = {
    abandoned: {
      title: 'Your Stripe Identity check was not submitted',
      explanation: 'The ID and selfie check was closed before the final submission.',
      fix: 'Start Stripe Identity again and continue until Stripe confirms the submission is complete.',
    },
    consent_declined: {
      title: 'Stripe Identity consent was not accepted',
      explanation: 'Stripe cannot run the ID and selfie check without the required consent.',
      fix: 'Start again and accept Stripe’s verification consent. Contact Rent Me CT if you need help with an alternative review.',
    },
    device_not_supported: {
      title: 'Stripe could not use this device’s camera',
      explanation: 'Camera access was unavailable or not allowed.',
      fix: 'Allow camera access and retry, or use a different phone with a working camera.',
    },
    document_expired: {
      title: 'The government ID you submitted is expired',
      explanation: 'Stripe requires a current, unexpired photo ID.',
      fix: 'Retry with an unexpired driver license, state ID, or passport.',
    },
    document_type_not_supported: {
      title: 'Stripe does not accept the document type you submitted',
      explanation: 'The uploaded document is not a supported government photo ID.',
      fix: 'Retry with a driver license, state ID, or passport.',
    },
    document_type_not_allowed: {
      title: 'Stripe does not accept the document type you submitted',
      explanation: 'The uploaded document is not allowed for this government ID check.',
      fix: 'Retry with a driver license, state ID, or passport.',
    },
    document_unverified_other: {
      title: 'Stripe could not verify the government ID',
      explanation: 'The document image or document details could not be verified.',
      fix: 'Retry with the original, unexpired ID in good lighting. Make sure every edge and all text are clear.',
    },
    selfie_document_missing_photo: {
      title: 'The submitted ID does not contain a face photo',
      explanation: 'Stripe cannot compare a selfie with an ID that has no visible portrait.',
      fix: 'Retry with a supported government ID that includes a clear photo of your face.',
    },
    selfie_face_mismatch: {
      title: 'The selfie does not match the photo on the ID',
      explanation: 'Stripe could not confirm that the person taking the selfie is the person shown on the ID.',
      fix: 'The person named on the rental must retry using their own ID and live selfie in good lighting.',
    },
    selfie_unverified_other: {
      title: 'Stripe could not verify the selfie',
      explanation: 'The selfie image was not clear enough to complete the face check.',
      fix: 'Retry in good lighting with your full face visible and follow Stripe’s camera prompts.',
    },
    selfie_manipulated: {
      title: 'Stripe could not accept the selfie image',
      explanation: 'Stripe requires a new, live camera image without filters, screenshots, or image edits.',
      fix: 'Retry and take a fresh live selfie using Stripe’s camera screen.',
    },
    country_not_supported: {
      title: 'Stripe cannot verify an ID from this country',
      explanation: 'The issuing country is not currently supported by Stripe Identity.',
      fix: 'Contact Rent Me CT for help with an alternative identity review.',
    },
    under_supported_age: {
      title: 'Stripe cannot verify this age',
      explanation: 'Stripe reported that the person is below the supported age for Identity verification.',
      fix: 'Check that the saved birthday and submitted ID are correct, then contact Rent Me CT.',
    },
  };
  if (stripeFailures[code]) return { ...stripeFailures[code], action: '', preservesContact: false };
  return null;
}

function IdentityVerificationPanel({ status, verified, errorCode, saving, onStart, onRefresh, onEditProfile }) {
  const requiresInput = ['unverified', 'requires_input', 'canceled', 'redacted'].includes(status);
  const failed = ['requires_input', 'canceled', 'redacted'].includes(status);
  const configurationRequired = status === 'configuration_required' || errorCode === 'identity_results_access_required';
  const matchResults = identityMatchResults(status, errorCode);
  const resultsUnavailable = errorCode === 'identity_results_access_required';
  const correction = identityCorrectionGuidance(errorCode);
  const normalizedErrorCode = String(errorCode || '').toLowerCase();
  const identityDetailsMismatch = ['name_mismatch', 'date_of_birth_mismatch', 'identity_details_mismatch'].includes(normalizedErrorCode);
  const correctionTarget = normalizedErrorCode === 'date_of_birth_mismatch'
    ? 'date_of_birth'
    : normalizedErrorCode === 'name_mismatch'
      ? 'full_name'
      : normalizedErrorCode === 'identity_details_mismatch'
        ? 'identity_details'
        : '';
  const retryRequired = status !== 'unverified' || (
    Boolean(normalizedErrorCode) &&
    normalizedErrorCode !== 'profile_details_changed'
  );
  const identityActionLabel = identityDetailsMismatch
    ? 'Run Stripe Identity again'
    : retryRequired
      ? 'Retry Stripe Identity'
      : 'Start Stripe Identity';
  return <div className={`identity-verification-panel ${verified ? 'verified' : status}`} role="status" aria-live="polite">
    {failed ? <AlertTriangle size={30} /> : verified ? <CheckCircle2 size={30} /> : <ShieldCheck size={30} />}
    <div>
      <strong className="identity-status-title">{verified ? 'Identity verified' : status === 'processing' ? 'Stripe is checking your submission' : correction?.title || 'Verify your government ID and selfie'}</strong>
      <span>{verified
        ? 'Your legal name and date of birth both match the government ID. This check will be reused for future rentals.'
        : configurationRequired
          ? 'This is a Rent Me CT secure-results configuration issue, not a failed customer verification. Do not upload your ID or selfie again. Your completed Stripe session is saved.'
        : status === 'processing'
          ? 'Most checks finish quickly. Use refresh if this page does not update automatically.'
          : correction?.explanation || 'You will continue to Stripe’s secure hosted verification. Stripe captures the ID and selfie; do not email these images to us.'}</span>
      {matchResults.length > 0 && <div className="identity-match-results" aria-label="Stripe Identity comparison results">
        {matchResults.map((item) => <span className={item.matched ? 'matched' : 'mismatch'} key={item.label}>
          <strong>{item.label}</strong>
          {item.result}
        </span>)}
      </div>}
      {correction && <div className="identity-fix-guidance" role="alert">
        <strong>How to fix this</strong>
        <span>{correction.fix}</span>
        {correction.preservesContact && <small>Your verified email stays verified. Your phone also stays verified as long as you do not change the phone number.</small>}
        {correction.action && onEditProfile && <button type="button" className="identity-correction-button" onClick={() => onEditProfile(correctionTarget)}>{correction.action}</button>}
      </div>}
      {resultsUnavailable && <span className="identity-results-warning" role="alert">Stripe received your submission, but Rent Me CT could not securely retrieve the comparison results. You do not need to resubmit unless we contact you.</span>}
      <small>This identity check does not replace Rent Me CT’s separate driver-license validity and insurance review.</small>
      <div className="identity-verification-actions">
        {requiresInput && !configurationRequired && <button type="button" className="primary-btn" onClick={onStart} disabled={saving}>{saving ? 'Opening Stripe...' : identityActionLabel}</button>}
        {!verified && <button type="button" className="secondary-btn" onClick={onRefresh} disabled={saving}>{saving ? 'Checking...' : 'Refresh status'}</button>}
      </div>
    </div>
  </div>;
}

function ChecklistItem({ icon: Icon, title, status, completed, onOpen }) {
  return (
    <div className={completed ? 'check-item complete' : 'check-item'}>
      <Icon size={20} />
      <div>
        <strong>{title}</strong>
        <span>{status}</span>
      </div>
      {completed ? <CheckCircle2 size={20} /> : <button type="button" onClick={onOpen}>Open</button>}
    </div>
  );
}

function UploadCard({ icon: Icon, title, text, busy = false, onUpload }) {
  return (
    <div className="panel action-card">
      <Icon size={28} />
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      <label className="secondary-btn">
        {busy ? 'Uploading…' : 'Choose file'}
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          onChange={onUpload}
          disabled={busy}
          style={{ display: 'none' }}
        />
      </label>
    </div>
  );
}

function DocumentRequirementNotice({
  licenseUploaded,
  insuranceUploaded,
  licenseRejected,
  insuranceRejected,
}) {
  const rejected = licenseRejected || insuranceRejected;
  const missing = [
    !licenseUploaded ? 'driver license' : '',
    !insuranceUploaded ? 'insurance for this rental' : '',
  ].filter(Boolean);

  return (
    <div className={rejected ? 'pickup-reminder-box rejected' : 'pickup-reminder-box'}>
      <ShieldCheck size={22} />
      <div>
        <strong>{rejected ? 'Document replacement required' : 'Required before pickup'}</strong>
        <span>
          {rejected
            ? `Rent Me CT rejected ${[
              licenseRejected ? 'the saved driver license' : '',
              insuranceRejected ? 'this rental insurance upload' : '',
            ].filter(Boolean).join(' and ')}. Upload a replacement before vehicle release.`
            : `Upload ${missing.join(' and ')} before Rent Me CT can release the vehicle.`}
        </span>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, text, onClick }) {
  return (
    <div className="panel action-card">
      <Icon size={28} />
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      <button className="secondary-btn" onClick={onClick}>Start</button>
    </div>
  );
}

function UploadedDocuments({ documents, currentRental, openDocument, replaceDocument, busy = {} }) {
  const sortedDocuments = [...documents].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <section className="panel uploaded-documents-panel">
      <p className="eyebrow">Uploaded Documents</p>
      <h3>Review Or Replace Files</h3>
      {!currentRental && <p className="muted">Create a reservation first. Insurance is tied to each rental; your driver license can stay on file.</p>}
      {currentRental && sortedDocuments.length === 0 && <p className="muted">No documents uploaded for this rental yet.</p>}
      <div className="uploaded-document-list">
        {sortedDocuments.map((document) => (
          <div className="uploaded-document-row" key={document.id}>
            <div>
              <strong>{documentTypeLabel(document.document_type)}</strong>
              <span>{prettyStatus(document.status || 'pending_review')} • {document.created_at ? new Date(document.created_at).toLocaleString() : 'Recently uploaded'}</span>
            </div>
            <div className="document-actions">
              <button className="secondary-btn" type="button" onClick={() => openDocument(document)}>
                <FileText size={16} /> Open
              </button>
              <label className={`secondary-btn ${busy[`replace:${document.id}`] ? 'is-busy' : ''}`}>
                <Upload size={16} /> {busy[`replace:${document.id}`] ? 'Replacing…' : 'Replace'}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => replaceDocument(event, document)}
                  disabled={Boolean(busy[`replace:${document.id}`])}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function normalizeUSPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  if (String(phone || '').trim().startsWith('+')) {
    return String(phone).trim();
  }

  return phone;
}

async function functionInvokeErrorMessage(error, fallback) {
  const response = error?.context;
  if (response?.clone) {
    try {
      const body = await response.clone().json();
      if (body?.error || body?.message) return body.error || body.message;
    } catch {
      // Function failures do not always include a JSON response body.
    }
  }
  const message = String(error?.message || '').trim();
  return message && !/non-2xx status code/i.test(message) ? message : fallback;
}

function getRentalDays(start, end) {
  const pickup = new Date(`${start}T00:00:00`);
  const dropoff = new Date(`${end}T00:00:00`);
  return Math.ceil((dropoff - pickup) / (1000 * 60 * 60 * 24));
}

function getRentalDaysSafe(start, end) {
  if (!start || !end) return 'Pending';
  const days = getRentalDays(start, end);
  return days > 0 ? `${days} days` : 'Invalid';
}

function getTodayDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function customerAge(dateOfBirth, today = new Date()) {
  const [year, month, day] = String(dateOfBirth || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  const birthDate = new Date(year, month - 1, day);
  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() + 1 !== month ||
    birthDate.getDate() !== day ||
    birthDate > today
  ) return null;
  let age = today.getFullYear() - year;
  const birthdayHasPassed = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayHasPassed) age -= 1;
  return age;
}
function isValidBirthDate(dateOfBirth) {
  const age = customerAge(dateOfBirth);
  return age !== null && age >= 21 && age <= 120;
}
function hasFirstAndLastName(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length >= 2;
}
function splitLegalName(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' '),
  };
}
function isCustomerUnder25(dateOfBirth) {
  const age = customerAge(dateOfBirth);
  return age !== null && age < 25;
}

function getNextDateInputValue(value) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return getTodayDateInputValue(date);
}

function money(value) {
  const num = Number(value || 0);
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function calculateUnder25Deposit(baseDeposit, settings = DEFAULT_UNDER_25_PRICING) {
  const base = Math.max(0, Number(baseDeposit || 0));
  if (settings.deposit_adjustment_enabled === false) return base;
  const adjustment = Math.max(0, Number(settings.deposit_adjustment_value || 0));
  return settings.deposit_adjustment_type === 'percentage'
    ? base * (1 + adjustment / 100)
    : base + adjustment;
}

function formatCheckoutCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatRentalDate(date, time) {
  if (!date) return 'Pending';
  const formatted = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${formatted}${time ? ` ${time}` : ''}`;
}

function vehicleImageKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/mercedes benz/g, 'mercedes')
    .replace(/benz/g, 'mercedes')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function isBookingFlowTestVehicle(vehicle) {
  return BOOKING_FLOW_TEST_ENABLED && vehicle?.id === BOOKING_FLOW_TEST_VEHICLE_ID;
}

const VEHICLE_IMAGES_BY_KEY = Object.fromEntries(
  DEFAULT_VEHICLE_IMAGE_NAMES.map((name) => [vehicleImageKey(name), `${PUBLIC_FLEET_ASSET_BASE_URL}/${name}.webp`])
);

function getVehicleImage(vehicle) {
  if (Array.isArray(vehicle?.image_urls) && vehicle.image_urls[0]) return vehicle.image_urls[0];
  const imageKey = vehicleImageKey(vehicle?.name);
  if (VEHICLE_IMAGES_BY_KEY[imageKey]) return VEHICLE_IMAGES_BY_KEY[imageKey];

  const fallbackKey = Object.keys(VEHICLE_IMAGES_BY_KEY).find((key) =>
    imageKey.includes(key) || key.includes(imageKey)
  );

  return fallbackKey ? VEHICLE_IMAGES_BY_KEY[fallbackKey] : Object.values(VEHICLE_IMAGES_BY_KEY)[0];
}

function getVehicleImages(vehicle) {
  if (isBookingFlowTestVehicle(vehicle)) return TEST_VEHICLE_PREVIEW_IMAGES;
  const uploaded = parseVehicleList(vehicle?.image_urls);
  const primary = uploaded[0] || getVehicleImage(vehicle);
  const fleet = getVehicleFleetNumber(vehicle);
  const highResolutionImages = fleet ? FLEET_GALLERY_IMAGES[fleet] : null;
  const builtIn = Array.isArray(highResolutionImages) && highResolutionImages.length >= 4
    ? highResolutionImages.slice(0, 4)
    : fleet
      ? Array.from({ length: 4 }, (_, index) => {
        const imageKey = `${fleet}-${index + 1}`;
        const extension = VEHICLE_GALLERY_JPG_IMAGES.has(imageKey) ? 'jpg' : 'webp';
        return `${PUBLIC_FLEET_ASSET_BASE_URL}/fleet-2/${imageKey}.${extension}`;
      })
      : uploaded.slice(1);
  return [...new Set([primary, ...builtIn].filter(Boolean))].slice(0, 5);
}

function getVehicleImageFallback(vehicle, index) {
  if (isBookingFlowTestVehicle(vehicle)) return TEST_VEHICLE_PREVIEW_IMAGES[index] || TEST_VEHICLE_PREVIEW_IMAGES[0];

  if (index <= 0) {
    const imageKey = vehicleImageKey(vehicle?.name);
    if (VEHICLE_IMAGES_BY_KEY[imageKey]) return VEHICLE_IMAGES_BY_KEY[imageKey];
    const fallbackKey = Object.keys(VEHICLE_IMAGES_BY_KEY).find((key) =>
      imageKey.includes(key) || key.includes(imageKey)
    );
    return fallbackKey ? VEHICLE_IMAGES_BY_KEY[fallbackKey] : Object.values(VEHICLE_IMAGES_BY_KEY)[0];
  }

  const fleet = getVehicleFleetNumber(vehicle);
  if (!fleet) return getVehicleImage(vehicle);
  const galleryIndex = Math.min(index, 4);
  const imageKey = `${fleet}-${galleryIndex}`;
  const extension = VEHICLE_GALLERY_JPG_IMAGES.has(imageKey) ? 'jpg' : 'webp';
  return `${PUBLIC_FLEET_ASSET_BASE_URL}/fleet-2/${imageKey}.${extension}`;
}

function getVehicleFleetNumber(vehicle) {
  return String(vehicle?.name || '').match(/#([a-z0-9]+)/i)?.[1]?.toUpperCase() || '';
}

function parseVehicleList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // Legacy newline and comma-separated values are normalized below.
  }
  return String(value).split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function getVehicleFeatures(vehicle) {
  const saved = parseVehicleList(vehicle?.features);
  if (saved.length) return saved;
  const fleet = getVehicleFleetNumber(vehicle);
  if (VEHICLE_FEATURE_GROUPS.compactSuv.has(fleet)) return ['SUV', 'Compact', 'Efficient'];
  if (VEHICLE_FEATURE_GROUPS.hatchback.has(fleet)) return ['Compact', 'Hatchback', 'Efficient'];
  if (VEHICLE_FEATURE_GROUPS.truck.has(fleet)) return ['Truck', '4x4', 'Work Ready'];
  if (VEHICLE_FEATURE_GROUPS.van.has(fleet)) return ['Van', 'Passenger/Utility', 'Spacious'];
  if (VEHICLE_FEATURE_GROUPS.suv.has(fleet)) return ['SUV', 'Luxury', 'Comfortable'];
  return ['Sedan', 'Luxury', 'Comfortable'];
}

function parseRentalDateTime(date, time) {
  if (!date) return null;
  const normalizedTime = convertTo24HourTime(time || '11:59 PM');
  return new Date(`${date}T${normalizedTime}:00`);
}

function convertTo24HourTime(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return '23:59';
  let hour = Number(match[1]);
  const minute = match[2] || '00';
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function getReturnCountdown(date, time, now = Date.now()) {
  const due = parseRentalDateTime(date, time);
  if (!due) return { label: 'No Active Return Due', value: 'Pending', canConfirm: false };

  const ms = due.getTime() - now;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  const value = days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;

  if (ms <= 0) return { label: 'Return Is Due', value: ms < 0 ? `${value} overdue` : 'Due now', canConfirm: true };
  return { label: 'Return Countdown', value, canConfirm: true };
}

function getExtensionRequestWindow(rental, now = Date.now()) {
  if (!rental?.id) return { open: false, message: 'Extensions open after a rental is active.' };

  const status = String(rental.status || '').toLowerCase();
  if (!['active', 'overdue'].includes(status)) {
    return { open: false, message: 'Extensions open after the rental is active and within 24 hours of return.' };
  }

  const due = parseRentalDateTime(rental.return_date, rental.return_time);
  if (!due) return { open: false, message: 'Return time is missing for this rental.' };

  if (now < due.getTime() - 86400000) {
    return { open: false, message: 'Extension requests open 24 hours before the booked return time.' };
  }

  return { open: true, message: '' };
}

function prettyStatus(status) {
  const map = {
    none: 'No Active Rental',
    pending: 'Pending',
    pending_setup: 'Pending Setup',
    documents_needed: 'Documents Needed',
    document_review: 'Document Review',
    approved: 'Approved',
    active: 'Active',
    overdue: 'Overdue',
    completed: 'Completed',
    cancelled: 'Cancelled',
    'pending setup': 'Pending Setup',
  };

  return map[status] || status;
}

function latestDocument(documents, type) {
  return documents
    .filter((doc) => doc.document_type === type)
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))[0];
}

function isUsableDocument(document) {
  return Boolean(document && document.status !== 'rejected');
}

function isApprovedDocument(document) {
  return document?.status === 'approved';
}

function documentTypeLabel(type) {
  const map = {
    license: 'Driver license',
    insurance: 'Insurance policy',
  };

  return map[type] || type;
}

function extensionStatusTitle(request) {
  if (!request) return 'No extension request';
  const kind = request.request_kind === 'switch_car_continuation' ? 'Switch request' : 'Extension request';

  if (request.status === 'pending') return `${kind} pending`;
  if (request.status === 'approved_pending_payment') return `${kind} approved`;
  if (request.status === 'activated') return `${kind} active`;
  if (request.status === 'rejected') return `${kind} declined`;
  if (request.status === 'cancelled') return `${kind} cancelled`;
  return prettyStatus(request.status);
}

function extensionStatusText(request) {
  if (!request) return '';
  const requestedReturn = formatRentalDate(request.requested_return_date, request.requested_return_time);

  if (request.status === 'pending') {
    return `Rent Me CT is reviewing your request through ${requestedReturn}.`;
  }

  if (request.status === 'approved_pending_payment') {
    return request.request_kind === 'switch_car_continuation'
      ? `Approved through ${requestedReturn}. Payment is required before the replacement vehicle activates.`
      : `Approved through ${requestedReturn}. Payment is required before the new return time activates.`;
  }

  if (request.status === 'activated') {
    return request.request_kind === 'switch_car_continuation'
      ? 'Payment is recorded. Your replacement rental is available in this portal.'
      : `Payment is recorded. Your active return window is now ${requestedReturn}.`;
  }

  if (request.status === 'rejected') {
    return request.admin_note || 'Rent Me CT could not approve this request. Choose another option or message us.';
  }

  if (request.status === 'cancelled') {
    return 'This request was cancelled. You can submit a new request when the extension window is open.';
  }

  return prettyStatus(request.status);
}

function timeOptions() {
  const times = [];
  for (let minutes = 9 * 60; minutes < 24 * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const suffix = hour >= 12 && hour < 24 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    times.push(`${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`);
  }
  return times;
}


function isVehicleBookable(vehicle) {
  const status = String(vehicle?.status || 'available').toLowerCase();
  return !BLOCKING_VEHICLE_STATUSES.includes(status);
}

function prettyVehicleStatus(status) {
  const normalized = String(status || 'available').toLowerCase();
  if (normalized === 'available') return 'Available';
  if (normalized === 'reserved') return 'Reserved';
  if (normalized === 'rented') return 'Rented';
  if (normalized === 'maintenance') return 'Maintenance';
  if (normalized === 'unavailable') return 'Unavailable';
  return 'Unavailable';
}

function vehicleAvailabilityLabel(vehicle, reservation, rentals = [], currentRentalId = '') {
  if (isBookingFlowTestVehicle(vehicle)) return 'Always available for testing';

  const status = String(vehicle?.status || 'available').toLowerCase();
  if (BLOCKING_VEHICLE_STATUSES.includes(status)) {
    return prettyVehicleStatus(status);
  }

  if (!reservation?.pickupDate || !reservation?.returnDate) {
    return 'Choose dates to confirm';
  }

  const conflictingRental = rentals.find((rental) =>
    rental.id !== currentRentalId &&
    rental.vehicle_id === vehicle?.id &&
    AVAILABILITY_RENTAL_STATUSES.includes(String(rental.status || '').toLowerCase()) &&
    rentalPeriodsOverlap(reservation, rental)
  );

  return conflictingRental ? 'Unavailable for dates' : 'Available';
}

function normalizeVehicleName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/mercedes benz/g, 'mercedes')
    .replace(/benz/g, 'mercedes')
    .replace(/\s+/g, ' ')
    .trim();
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isVehicleAvailableForDates(vehicle, reservation, rentals = [], currentRentalId = '') {
  if (isBookingFlowTestVehicle(vehicle)) return true;

  const status = String(vehicle?.status || 'available').toLowerCase();
  if (BLOCKING_VEHICLE_STATUSES.includes(status)) return false;

  if (!reservation?.pickupDate || !reservation?.returnDate) {
    return true;
  }

  return !rentals.some((rental) =>
	    rental.id !== currentRentalId &&
	    rental.vehicle_id === vehicle?.id &&
	    AVAILABILITY_RENTAL_STATUSES.includes(String(rental.status || '').toLowerCase()) &&
	    rentalPeriodsOverlap(reservation, rental)
	  );
}

function parseRentMeCtDateTime(dateValue, timeValue = '9:00 AM') {
  if (!dateValue) return null;
  const match = String(timeValue || '9:00 AM').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return new Date(`${dateValue}T09:00:00`);

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return new Date(`${dateValue}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
}

function rentalPeriodsOverlap(reservation, rental) {
  const requestedStart = parseRentMeCtDateTime(reservation?.pickupDate, reservation?.pickupTime);
  const requestedEnd = parseRentMeCtDateTime(reservation?.returnDate, reservation?.returnTime);
  const bookedStart = parseRentMeCtDateTime(rental?.pickup_date, rental?.pickup_time);
  const bookedEnd = parseRentMeCtDateTime(rental?.return_date, rental?.return_time);

  if (!requestedStart || !requestedEnd || !bookedStart || !bookedEnd) return false;

  const bufferMinutes = rental?.status === 'calendar_block' ? 0 : TURNAROUND_BUFFER_MINUTES;
  const blockedUntil = new Date(bookedEnd.getTime() + bufferMinutes * 60 * 1000);
  const requestedBlockedUntil = new Date(requestedEnd.getTime() + bufferMinutes * 60 * 1000);
  return requestedStart < blockedUntil && requestedBlockedUntil > bookedStart;
}

function buildAgreementWithDetails({ agreementText, profile, email, vehicle, reservation, rental, signatureName, signatureImageData }) {
  const details = `
AUTO-FILLED RENTAL DETAILS

Agreement Version: ${AGREEMENT_VERSION}
Signed Snapshot Generated: ${new Date().toISOString()}

Renter Name: ${profile?.full_name || 'Pending'}
Intended Vehicle Use: ${profile?.intended_vehicle_use || 'Pending'}
Phone: ${profile?.phone || 'Pending'}
Email: ${email || 'Pending'}

Vehicle: ${vehicle?.name || 'Pending'}
Make: ${vehicle?.brand || vehicle?.make || 'Pending'}
Model: ${vehicle?.model || 'Pending'}
Year: ${vehicle?.year || 'Pending'}
VIN: ${vehicle?.vin || 'Pending'}
License Plate: ${vehicle?.plate_number || vehicle?.license_plate || 'Pending'}

Pickup Date/Time: ${formatRentalDate(reservation?.pickupDate, reservation?.pickupTime)}
Return Date/Time: ${formatRentalDate(reservation?.returnDate, reservation?.returnTime)}
Return Location: ${RENTMECT_ADDRESS}

Daily Rate: ${vehicle?.daily_rate ? money(vehicle.daily_rate) : 'Pending'}
Base Rental Total: ${rental?.base_rental_total ? money(rental.base_rental_total) : rental?.rental_total ? money(rental.rental_total) : 'Pending'}
Under-25 Rental Markup: ${Number(rental?.under_25_markup_amount || 0) > 0 ? `${money(rental.under_25_markup_amount)} (${Number(rental.under_25_markup_percentage || 0)}%)` : 'Not applied'}
Rental Total: ${rental?.rental_total ? money(rental.rental_total) : 'Pending'}
Tax Amount: ${rental?.tax_amount ? money(rental.tax_amount) : 'Pending'}
Security Deposit: ${rental?.discount_waives_security_deposit ? 'Waived by discount code' : rental ? money(rental.security_deposit) : vehicle?.security_deposit ? money(vehicle.security_deposit) : 'Pending'}
Mileage Policy: ${MILEAGE_POLICY}
Cancellation Terms: ${CANCELLATION_TERMS}
Typed Signature: ${signatureName || rental?.agreement_signature_name || 'Pending'}
Drawn Signature Image: ${signatureImageData || extractSignatureImage(rental?.agreement_snapshot) || 'Pending'}

------------------------------------------------------------
`;

  return `${details}\n${agreementText}`;
}

function extractSignatureImage(snapshot = '') {
  const match = String(snapshot).match(/Drawn Signature Image:\s*(data:image\/png;base64,[^\s]+)/);
  return match?.[1] || '';
}

function agreementHtml(snapshot, title = 'Rent Me CT Signed Agreement') {
  const signatureImage = extractSignatureImage(snapshot);
  const printableText = String(snapshot || '').replace(/Drawn Signature Image:\s*data:image\/png;base64,[^\s]+/, 'Drawn Signature Image: embedded below');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#172033;line-height:1.5;padding:32px;max-width:900px;margin:auto}
    pre{white-space:pre-wrap;font-family:inherit}
    .signature{margin-top:24px;border:1px solid #d6dee8;border-radius:10px;padding:16px}
    .signature img{max-width:420px;width:100%;height:auto;display:block}
  </style>
</head>
<body>
  <pre>${escapeHtml(printableText)}</pre>
  ${signatureImage ? `<div class="signature"><strong>Drawn Signature</strong><img src="${signatureImage}" alt="Drawn renter signature"></div>` : ''}
</body>
</html>`;
}

function downloadAgreement(rental) {
  const snapshot = rental?.agreement_snapshot;
  if (!snapshot) return;
  const html = agreementHtml(snapshot, `Rent Me CT Agreement ${rental.id || ''}`);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rent-me-ct-agreement-${rental.id || 'signed'}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);
}

const PORTAL_CONSENT_KEY = 'rentmect_privacy_choices_v1';
const PORTAL_CONSENT_VERSION = '2026-07-30';

function portalConsentDefaults() {
  return {
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
    globalPrivacyControl: navigator.globalPrivacyControl === true,
    version: PORTAL_CONSENT_VERSION,
    timestamp: null,
  };
}

function readPortalConsent() {
  const defaults = portalConsentDefaults();
  try {
    const stored = JSON.parse(localStorage.getItem(PORTAL_CONSENT_KEY) || 'null');
    if (!stored || stored.version !== PORTAL_CONSENT_VERSION) return defaults;
    return {
      ...defaults,
      functional: Boolean(stored.functional),
      analytics: defaults.globalPrivacyControl ? false : Boolean(stored.analytics),
      marketing: defaults.globalPrivacyControl ? false : Boolean(stored.marketing),
      timestamp: stored.timestamp || null,
    };
  } catch {
    return defaults;
  }
}

function PortalComplianceLayer() {
  const [consent, setConsent] = useState(readPortalConsent);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [draft, setDraft] = useState(consent);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  const openPreferences = () => {
    previousFocusRef.current = document.activeElement;
    setDraft(readPortalConsent());
    setPreferencesOpen(true);
  };

  const closePreferences = () => {
    setPreferencesOpen(false);
    window.requestAnimationFrame(() => {
      if (previousFocusRef.current instanceof HTMLElement) previousFocusRef.current.focus();
    });
  };

  const saveConsent = (next) => {
    const globalPrivacyControl = navigator.globalPrivacyControl === true;
    const value = {
      necessary: true,
      functional: Boolean(next.functional),
      analytics: globalPrivacyControl ? false : Boolean(next.analytics),
      marketing: globalPrivacyControl ? false : Boolean(next.marketing),
      globalPrivacyControl,
      version: PORTAL_CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(PORTAL_CONSENT_KEY, JSON.stringify(value));
    } catch {
      // Keep the current page choice when browser storage is unavailable.
    }
    setConsent(value);
    setDraft(value);
    setPreferencesOpen(false);
    window.dispatchEvent(new CustomEvent('rentmect:consent-changed', { detail: value }));
  };

  useEffect(() => {
    window.rentmectPortalConsent = {
      get: readPortalConsent,
      allows: (category) => category === 'necessary' || Boolean(readPortalConsent()[category]),
      open: openPreferences,
    };
    return () => { delete window.rentmectPortalConsent; };
  });

  useEffect(() => {
    if (!preferencesOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => dialogRef.current?.focus());
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePreferences();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [preferencesOpen]);

  return <>
    <footer className="portal-compliance-footer" aria-label="Rent Me CT legal and privacy links">
      <span>© 2026 Ancona Enterprises, Inc. d/b/a Rent Me CT</span>
      <nav aria-label="Legal links">
        <a href="https://rentmect.com/privacy-policy.html">Privacy</a>
        <a href="https://rentmect.com/terms.html">Terms</a>
        <a href="https://rentmect.com/cookie-policy.html">Cookie Policy</a>
        <a href="https://rentmect.com/accessibility.html">Accessibility</a>
        <a href="https://rentmect.com/rental-policies.html">Rental Policies</a>
        <a href="https://rentmect.com/sitemap.html">Sitemap</a>
        <a href="https://rentmect.com/privacy-choices.html">Do Not Sell or Share</a>
        <button type="button" onClick={openPreferences}>Manage Cookie Preferences</button>
      </nav>
    </footer>

    {!consent.timestamp && <section className="portal-privacy-banner" aria-label="Privacy choices">
      <div><strong>Your privacy choices</strong><p>This portal uses necessary browser storage for secure sign-in, booking, and payments. No advertising or analytics pixel is currently active.</p><a href="https://rentmect.com/cookie-policy.html">Cookie and Browser Storage Policy</a></div>
      <div className="portal-privacy-actions">
        <button type="button" onClick={() => saveConsent({ functional: true, analytics: true, marketing: true })}>Accept all</button>
        <button type="button" onClick={() => saveConsent({ functional: false, analytics: false, marketing: false })}>Reject non-essential</button>
        <button type="button" onClick={openPreferences}>Customize</button>
      </div>
    </section>}

    {preferencesOpen && <div className="portal-privacy-modal">
      <button type="button" className="portal-privacy-backdrop" onClick={closePreferences} aria-label="Close privacy preferences" />
      <section ref={dialogRef} className="portal-privacy-panel" role="dialog" aria-modal="true" aria-labelledby="portalPrivacyTitle" tabIndex="-1">
        <div className="portal-privacy-heading"><div><p className="eyebrow">Privacy controls</p><h2 id="portalPrivacyTitle">Manage cookie and storage preferences</h2></div><button type="button" className="portal-privacy-close" onClick={closePreferences} aria-label="Close privacy preferences"><X size={22}/></button></div>
        <p>Necessary storage keeps you signed in and supports requested booking, document, identity, payment, and security functions. The portal currently has no analytics or advertising pixels.</p>
        <div className="portal-privacy-choice-list">
          <label><span><strong>Necessary</strong><small>Secure sign-in, booking, fraud prevention, and your consent record. Always on.</small></span><input type="checkbox" checked disabled readOnly /></label>
          <label><span><strong>Functional</strong><small>Optional display preferences.</small></span><input type="checkbox" checked={Boolean(draft.functional)} onChange={(event) => setDraft({ ...draft, functional: event.target.checked })} /></label>
          <label><span><strong>Analytics</strong><small>Audience measurement. No provider is currently active.</small></span><input type="checkbox" checked={Boolean(draft.analytics)} disabled={draft.globalPrivacyControl} onChange={(event) => setDraft({ ...draft, analytics: event.target.checked })} /></label>
          <label><span><strong>Marketing</strong><small>Targeted advertising. No advertising pixel is currently active.</small></span><input type="checkbox" checked={Boolean(draft.marketing)} disabled={draft.globalPrivacyControl} onChange={(event) => setDraft({ ...draft, marketing: event.target.checked })} /></label>
        </div>
        {draft.globalPrivacyControl && <p className="portal-gpc-notice"><strong>Global Privacy Control detected.</strong> Analytics and marketing remain off while this signal is enabled.</p>}
        <div className="portal-privacy-actions modal-actions"><button type="button" onClick={() => saveConsent(draft)}>Save choices</button><button type="button" onClick={() => saveConsent({ functional: false, analytics: false, marketing: false })}>Reject non-essential</button></div>
        <a className="portal-privacy-rights-link" href="https://rentmect.com/privacy-choices.html">View privacy rights and opt-out information</a>
      </section>
    </div>}
  </>;
}

const portalRoot = document.getElementById('root');
portalRoot.tabIndex = -1;
createRoot(portalRoot).render(<>
  <a className="portal-skip-link" href="#root">Skip to portal content</a>
  <PortalErrorBoundary><App /></PortalErrorBoundary>
  <PortalComplianceLayer />
</>);
