import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument,PDFName} from 'pdf-lib';
import {reservationPdf,reservationStatus} from './merchantReservationPdf.js';

const sample={id:'00000000-0000-4000-8000-000000000015',merchant_reservation_number:'RM-00000015',profiles:{full_name:'Jordan Sample',email:'jordan@example.test'},merchants:{name:'CarCraft'},vehicles:{name:'Synthetic Test Vehicle'},pickup_date:'2026-12-04',pickup_time:'09:00:00',return_date:'2026-12-07',return_time:'09:00:00',status:'documents_needed',payment_status:'paid',rental_total:222,tax_amount:14.1,service_fee_total:0,security_deposit:400,agreement_signed:true,merchant_documents_due_at:'2026-12-03T21:00:00Z'};

test('paid and unpaid reservation handouts fit one printed page with an embedded logo',async()=>{
 const font=await readFile(new URL('../public/fonts/NotoSans-Regular.ttf',import.meta.url));
 const logo=await readFile(new URL('./assets/logo-sidebar.png',import.meta.url));
 for(const rental of [sample,{...sample,payment_status:'unpaid',payment_due_at:'2026-12-02T15:25:00Z'}]){
  const pdf=await PDFDocument.load(await reservationPdf(rental,font,logo));
  assert.equal(pdf.getPageCount(),1);
  assert.ok(pdf.getPage(0).node.Resources().lookup(PDFName.of('XObject')).keys().length>0);
 }
 const long={...sample,profiles:{full_name:'Alexandra María de la Cruz-Sánchez '.repeat(4),email:'long.customer.email.address.for.layout.verification@example.test'},vehicles:{name:'Synthetic test vehicle with a long description to verify wrapping and safe page breaks'}};
 const pdf=await PDFDocument.load(await reservationPdf(long,font,logo));
 assert.equal(pdf.getPageCount(),2);
 await assert.rejects(reservationPdf(sample,font),/logo could not load/);
});

test('reservation status distinguishes paid, expired, pickup-ready and closed rentals',()=>{
 const now=Date.parse('2026-12-03T00:00:00Z');
 assert.equal(reservationStatus(sample,now),'Reserved - pickup approval required');
 assert.equal(reservationStatus({...sample,status:'ready_for_pickup'},now),'Ready for pickup');
 assert.equal(reservationStatus({...sample,payment_status:'unpaid',payment_due_at:'2026-12-02T00:00:00Z'},now),'Payment hold expired');
 assert.equal(reservationStatus({...sample,status:'cancelled'},now),'Cancelled');
 assert.equal(reservationStatus({...sample,status:'completed'},now),'Completed');
});
