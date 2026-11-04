import React,{useState,useCallback} from 'react';
import MerchantDialog from './MerchantDialog.jsx';
import {merchantEmail} from './merchantWorkflow.js';
export default function MerchantDocumentEmail({booking,onSend,onClose}){
 const [email,setEmail]=useState(booking.customer_email||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 const close=useCallback(()=>{if(!busy)onClose();},[busy,onClose]);
 async function send(event){event.preventDefault();if(busy)return;setBusy(true);setError('');try{setResult(await onSend(merchantEmail(email)));}catch(e){setError(e.message||'Email could not be sent. Please retry.');}finally{setBusy(false);}}
 return <MerchantDialog title="Send email to client" className="merchant-date-dialog" onClose={close}>
 <p>{booking.customer_name} · {booking.merchant_reservation_number}</p>
 {result?<><p role="status">{result.status==='sent'?'Email sent to':'Email queued for delivery to'} <strong>{result.recipient_email}</strong>.</p><p>The client can open the secure link, upload their driver’s license and insurance declaration page, and submit them for review.</p><button className="merchant-primary" onClick={onClose}>Done</button></>:<form onSubmit={send}><label>Client email<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event=>setEmail(event.target.value)}/></label><p>Use the email entered for this reservation. The client signs in with that email to upload their documents.</p>{error&&<p role="alert">{error}</p>}<button className="merchant-primary" disabled={busy}>{busy?'Sending…':'Send email to client'}</button></form>}
 </MerchantDialog>;
}
