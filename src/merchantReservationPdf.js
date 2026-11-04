import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const one=x=>Array.isArray(x)?x[0]:x;
export async function reservationPdf(r,fontBytes){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:true});
 let page=pdf.addPage([612,792]);let y=738;const ink=rgb(.06,.07,.1),red=rgb(.9,.035,.08);
 function draw(row,size,color){if(y<size+65){page=pdf.addPage([612,792]);y=738;}page.drawText(row,{x:54,y,size,font,color});y-=size+7;}
 function line(text,size=11,color=ink){let row='';for(const character of String(text).replace(/[\r\n]+/g,' ')){const next=row+character;if(font.widthOfTextAtSize(next,size)>504&&row){const space=row.lastIndexOf(' ');if(space>0){draw(row.slice(0,space),size,color);row=row.slice(space+1)+character;}else{draw(row,size,color);row=character;}}else row=next;}if(row)draw(row,size,color);}
 line('RENT ME CT',24,red);line('Merchant rental reservation',16);y-=12;
 line(r.merchant_reservation_number||r.id,17);line(`Partner: ${one(r.merchants)?.name||'Merchant'}`);line(`Customer: ${one(r.profiles)?.full_name||''}`,14);y-=10;
 line(`Vehicle: ${one(r.vehicles)?.name||''}`,14);line(`Pickup: ${r.pickup_date} at ${r.pickup_time} Eastern`);line(`Drop-off: ${r.return_date} at ${r.return_time} Eastern`);line('Rent Me CT · 12 Holmes Circle, Farmington, CT');y-=14;
 line(`Rental: ${money(r.rental_total)}     Tax: ${money(r.tax_amount)}`);line(`Service fees: ${money(r.service_fee_total)}     Refundable deposit: ${money(r.security_deposit)}`);
 line(`Total: ${money(Number(r.rental_total)+Number(r.tax_amount)+Number(r.service_fee_total||0)+Number(r.security_deposit))}`,14);y-=10;
 const closed=['cancelled','completed','active','rented','overdue','return_initiated'].includes(r.status);
 const expired=r.payment_status!=='paid'&&new Date(r.payment_due_at||r.checkout_expires_at||0).getTime()<=Date.now();
 line(`Payment: ${r.payment_status==='paid'?'PAID':'PAYMENT NOT COMPLETED'}`,12,red);
 line(`Reservation status: ${closed?r.status.toUpperCase():expired?'PAYMENT HOLD EXPIRED':r.payment_status==='paid'?'Reserved — pickup approval required':'Temporary hold — complete payment before expiry'}`);
 if(r.payment_status!=='paid'&&r.payment_due_at)line(`Payment deadline: ${new Date(r.payment_due_at).toLocaleString('en-US',{timeZone:'America/New_York'})} Eastern`);
 line(`Rental agreement: ${r.agreement_signed?'Signed and saved with your rental':'Not yet signed'}`);y-=10;
 line('Before pickup',14);line('Upload your driver’s license and insurance declaration page using your secure customer link. Sign in with the email used for this reservation.');line('Rent Me CT must approve your license and insurance, and confirm all pickup requirements. This confirmation does not authorize vehicle release.');y-=10;
 line('Bring this confirmation and your original driver’s license to Rent Me CT.');
 if(r.merchant_documents_due_at)line(`Documents due: ${new Date(r.merchant_documents_due_at).toLocaleString('en-US',{timeZone:'America/New_York'})} Eastern`);
 for(const page of pdf.getPages())page.drawText('rentmect.com · Merchant reservation confirmation',{x:54,y:35,size:9,font,color:ink});
 pdf.setTitle(`Rent Me CT Reservation ${r.merchant_reservation_number||r.id}`);return pdf.save();
}
export async function downloadReservationPdf(r){const font=await fetch('/fonts/NotoSans-Regular.ttf');if(!font.ok)throw new Error('The reservation PDF font could not load. Please retry.');const bytes=await reservationPdf(r,await font.arrayBuffer());const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=`RentMeCT-${r.merchant_reservation_number||r.id}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
