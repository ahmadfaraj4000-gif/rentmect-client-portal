import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('merchant document email uses a confirmed recipient and protected RPC rather than a clipboard link',()=>{
 const portal=read('./MerchantPortal.jsx'),dialog=read('./MerchantDocumentEmail.jsx');
 assert.match(portal,/merchant_send_document_email/);assert.match(portal,/p_email:email/);
 assert.match(dialog,/booking.customer_email/);assert.match(dialog,/type="email"/);
 assert.doesNotMatch(portal,/Copy document upload link|Copy completion link|Resend customer link/);
});
test('document email route requires the exact paid merchant rental and preserves email sign-in redirect',()=>{
 const source=read('./main.jsx');
 assert.match(source,/currentRental\?\.id === guidedAdminRentalId && currentRental\?\.merchant_id && currentRental\?\.payment_status === 'paid'/);
 assert.match(source,/shouldCreateUser: !adminBookingToken && !merchantDocumentsRoute/);
 assert.match(source,/if \(merchantDocumentsRoute\) return;/);
 assert.match(source,/sync_customer_rental_document_review_status/);
 const upload=read('./MerchantDocumentUpload.jsx');
 assert.match(upload,/disabled=\{busy\|\|submitting\|\|!licenseUploaded\|\|!insuranceUploaded\}/);
 assert.match(upload,/await onSubmit\(\);setSubmitted\(true\)/);
});
