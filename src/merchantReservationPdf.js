import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));
const one=value=>Array.isArray(value)?value[0]:value;
const logoUrl=new URL('./assets/logo-sidebar.png',import.meta.url).href;
const clean=value=>String(value??'').replace(/[\r\n\t]+/g,' ').replace(/[\u2010-\u2015]/g,'-').trim();
const dateLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'Not scheduled';
const timeLabel=value=>{
 const match=String(value||'').match(/^(\d{2}):(\d{2})/);
 if(!match)return 'Time to be confirmed';
 const hour=Number(match[1]);return `${hour%12||12}:${match[2]} ${hour<12?'AM':'PM'} ET`;
};
const deadline=value=>value&&Number.isFinite(new Date(value).getTime())?new Date(value).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})+' ET':null;

export function reservationStatus(r,now=Date.now()){
 const closed={cancelled:'Cancelled',completed:'Completed',active:'Rental in progress',rented:'Rental in progress',overdue:'Return overdue',return_initiated:'Return in progress'};
 if(closed[r.status])return closed[r.status];
 if(r.payment_status==='paid')return r.status==='ready_for_pickup'?'Ready for pickup':'Reserved - pickup approval required';
 const expires=new Date(r.payment_due_at||r.checkout_expires_at||0).getTime();
 return expires<=now?'Payment hold expired':'Temporary hold - payment required';
}

export async function reservationPdf(r,fontBytes,logoBytes){
 if(!logoBytes)throw new Error('The Rent Me CT logo could not load. Please retry the PDF download.');
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const [font,bold,logo]=await Promise.all([pdf.embedFont(fontBytes,{subset:true}),pdf.embedFont(StandardFonts.HelveticaBold),pdf.embedPng(logoBytes)]);
 const ink=rgb(.09,.12,.10),muted=rgb(.34,.39,.36),green=rgb(.07,.24,.16),border=rgb(.82,.86,.83),pale=rgb(.96,.98,.96);
 const left=48,right=564,width=516,column=246,gap=24;
 const reference=clean(r.merchant_reservation_number||r.id);
 let page,y;
 function text(value,x,baseline,size=10,face=font,color=ink){page.drawText(clean(value),{x,y:baseline,size,font:face,color});}
 function rule(baseline,x=left,length=width){page.drawLine({start:{x,y:baseline},end:{x:x+length,y:baseline},thickness:.65,color:border});}
 function wrap(value,size,maxWidth,face=font){
  const rows=[];let row='';
  for(const character of clean(value)){
   if(row&&face.widthOfTextAtSize(row+character,size)>maxWidth){
    const space=row.lastIndexOf(' ');
    if(space>0){rows.push(row.slice(0,space));row=row.slice(space+1);}
    else{rows.push(row);row='';}
   }
   row+=character;
  }
  if(row)rows.push(row);return rows;
 }
 function lines(value,x,baseline,size,maxWidth,leading=size+4,face=font,color=ink){
  const rows=wrap(value,size,maxWidth,face);rows.forEach((row,i)=>text(row,x,baseline-i*leading,size,face,color));return rows.length*leading;
 }
 function newPage(){
  page=pdf.addPage([612,792]);
  page.drawImage(logo,{x:left,y:710,width:154,height:154*logo.height/logo.width});
  text('RESERVATION',350,755,9,bold,muted);
  let referenceSize=15;
  while(bold.widthOfTextAtSize(reference,referenceSize)>214&&referenceSize>8)referenceSize-=.5;
  text(reference,350,734,referenceSize,bold,green);
  text('Merchant booking',350,708,9,font,muted);
  rule(694);y=666;
 }
 function ensure(height){if(y-height<72){newPage();text('Reservation details, continued',left,y,16,bold,green);y-=34;}}
 function paragraph(value,size=9.5){const height=wrap(value,size,width).length*(size+4);ensure(height+5);lines(value,left,y,size,width);y-=height+7;}
 function section(label){ensure(40);text(label,left,y,13,bold,green);y-=25;}
 newPage();
 text('Your rental reservation',left,y,23,bold,green);y-=25;
 paragraph(reservationStatus(r),10.5);y-=5;
 const customer=one(r.profiles)||{},merchant=one(r.merchants)||{},vehicle=one(r.vehicles)||{};
 const customerRows=wrap(customer.full_name||'Customer',13,column);
 const merchantRows=wrap(merchant.name||'Merchant',13,column);
 const emailRows=wrap(customer.email||'',9.5,column);
 const detailHeight=20+Math.max(customerRows.length*17+emailRows.length*13+4,merchantRows.length*17);
 ensure(detailHeight+15);
 text('CUSTOMER',left,y,8.5,bold,muted);text('BOOKED THROUGH',left+column+gap,y,8.5,bold,muted);y-=20;
 const nameHeight=lines(customer.full_name||'Customer',left,y,13,column,17);
 lines(customer.email||'',left,y-nameHeight-2,9.5,column,13,font,muted);
 lines(merchant.name||'Merchant',left+column+gap,y,13,column,17);
 y-=detailHeight-20+17;
 const vehicleHeight=wrap(vehicle.name||'Vehicle',16,width).length*20;
 ensure(vehicleHeight+38);text('VEHICLE',left,y,8.5,bold,muted);y-=21;
 lines(vehicle.name||'Vehicle',left,y,16,width,20);y-=vehicleHeight+14;
 ensure(94);
 for(const [x,label,date,time] of [[left,'PICKUP',r.pickup_date,r.pickup_time],[left+column+gap,'RETURN',r.return_date,r.return_time]]){
  page.drawRectangle({x,y:y-70,width:column,height:80,borderWidth:.65,borderColor:border,color:rgb(1,1,1)});
  text(label,x+16,y-10,8.5,bold,muted);text(dateLabel(date),x+16,y-34,16,bold);text(timeLabel(time),x+16,y-56,11,font,muted);
 }
 y-=92;
 text('Rent Me CT  |  12 Holmes Circle, Farmington, CT',left,y,9,font,muted);y-=24;
 ensure(165);section('Reservation total');
 for(const [label,value] of [['Rental',r.rental_total],['Tax',r.tax_amount],['Service fees',r.service_fee_total],['Refundable security deposit',r.security_deposit]]){
  text(label,left,y,10.5);const amount=money(value);text(amount,right-font.widthOfTextAtSize(amount,10.5),y,10.5);y-=18;
 }
 rule(y+7);y-=13;
 const total=money(Number(r.rental_total||0)+Number(r.tax_amount||0)+Number(r.service_fee_total||0)+Number(r.security_deposit||0));
 text('Total including deposit',left,y,12,bold,green);text(total,right-bold.widthOfTextAtSize(total,17),y-1,17,bold,green);y-=29;
 const payment=r.payment_status==='paid'?'Payment received':r.payment_status==='refunded'?'Payment refunded':'Payment not completed';
 paragraph(`${payment}  |  Agreement: ${r.agreement_signed?'signed and saved':'not yet signed'}`,9.5);
 if(r.payment_status!=='paid'&&deadline(r.payment_due_at||r.checkout_expires_at))paragraph(`Payment deadline: ${deadline(r.payment_due_at||r.checkout_expires_at)}`,9.5);
 y-=5;
 const closed=['cancelled','completed','active','rented','overdue','return_initiated'].includes(r.status);
 const instructions=closed
  ?['Keep this reservation summary for your records. For questions about this rental, contact Rent Me CT at rentmect.com/contact.html.']
  :[
   r.payment_status==='paid'
    ?'Check the customer email used for this reservation for the secure document-upload link. Upload your driver’s license and insurance declaration page, then submit them.'
    :'After successful payment, we email the customer a secure link to upload their driver’s license and insurance declaration page.',
   ...(r.payment_status==='paid'&&deadline(r.merchant_documents_due_at)?[`Documents due: ${deadline(r.merchant_documents_due_at)}.`]:[]),
   'Bring this confirmation and your original driver’s license to pickup. Rent Me CT must approve your documents and confirm pickup requirements before releasing the vehicle.',
  ];
 const instructionHeight=25+instructions.reduce((sum,value)=>sum+wrap(value,9.5,width-28).length*13.5+7,0)+13;
 ensure(instructionHeight);
 page.drawRectangle({x:left-1,y:y-instructionHeight+14,width:width+2,height:instructionHeight,color:pale});
 text(closed?'Rental record':'Before pickup',left+14,y-7,12,bold,green);y-=30;
 for(const instruction of instructions){const h=lines(instruction,left+14,y,9.5,width-28,13.5);y-=h+7;}
 const pages=pdf.getPages();pages.forEach((p,index)=>{
  page=p;rule(48);text('rentmect.com  |  Rent Me CT',left,32,8,font,muted);
  const numbering=`Page ${index+1} of ${pages.length}`;text(numbering,right-font.widthOfTextAtSize(numbering,8),32,8,font,muted);
 });
 pdf.setTitle(`Rent Me CT Reservation ${reference}`);pdf.setAuthor('Rent Me CT');pdf.setSubject('Customer reservation summary');return pdf.save();
}

export async function downloadReservationPdf(r){
 const [font,logo]=await Promise.all([fetch('/fonts/NotoSans-Regular.ttf'),fetch(logoUrl)]);
 if(!font.ok||!logo.ok)throw new Error('The reservation PDF assets could not load. Please retry.');
 const bytes=await reservationPdf(r,await font.arrayBuffer(),await logo.arrayBuffer());
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=`RentMeCT-${r.merchant_reservation_number||r.id}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
