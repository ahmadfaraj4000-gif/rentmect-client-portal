import React from 'react';
import {dateKey,readableDate,easternToday} from './merchantFormFields.js';
// Calendar classes, dimensions and colors are shared with booking-picker.css.
export default function MerchantCalendar({month,start='',end='',min='',max='',onChoose,onNavigate}) {
 const first=new Date(`${month.slice(0,7)}-01T12:00:00Z`);
 const count=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 const heading=first.toLocaleDateString('en-US',{timeZone:'UTC',month:'long',year:'numeric'});
 function keyboard(event,day){
  const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
  if(offset===undefined)return;
  event.preventDefault();const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+offset);const next=dateKey(d);
  if((min&&next<min)||(max&&next>max))return;
  const dialog=event.currentTarget.closest('[role="dialog"]');
  if(!dialog.querySelector(`[data-day="${next}"]`))onNavigate?.(next.slice(0,7)+'-01');
  requestAnimationFrame(()=>dialog.querySelector(`[data-day="${next}"]`)?.focus());
 }
 return <section className="booking-calendar-month" aria-label={heading}><h3>{heading}</h3><div className="booking-calendar-weekdays" aria-hidden="true">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><span key={day}>{day}</span>)}</div><div className="booking-calendar-grid">{Array.from({length:first.getUTCDay()},(_,i)=><span className="booking-calendar-blank" key={'blank'+i}/>)}{Array.from({length:count},(_,i)=>{
  const day=dateKey(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),i+1)));
  const classes=['booking-calendar-day',day===start?'range-start':'',day===end?'range-end':'',start&&end&&day>start&&day<end?'in-range':'',day===easternToday()?'today':''].filter(Boolean).join(' ');
  return <button type="button" className={classes} key={day} data-day={day} aria-label={readableDate(day)} aria-pressed={day===start||day===end} disabled={Boolean((min&&day<min)||(max&&day>max))} onKeyDown={e=>keyboard(e,day)} onClick={()=>onChoose(day)}>{i+1}</button>;
 })}</div></section>;
}
