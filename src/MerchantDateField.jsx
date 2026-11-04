import React,{useState,useEffect,useRef,useCallback,useId} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import MerchantDialog from './MerchantDialog.jsx';
import MerchantCalendar from './MerchantCalendar.jsx';
import {easternToday,inputDate,parseInputDate,formatDateInput,moveMonth} from './merchantFormFields.js';
export default function MerchantDateField({label,value,onChange,birthDate=false,min='',max='',name,invalid=false,describedBy}){
 const id=useId();const today=easternToday();const year=Number(today.slice(0,4));
 const earliest=min||(birthDate?`${year-110}-01-01`:`${year-20}-01-01`);
 const latest=max||(birthDate?today:`${year+30}-12-31`);
 const [open,setOpen]=useState(false),[month,setMonth]=useState(today.slice(0,7)+'-01'),[draft,setDraft]=useState(inputDate(value));
 const emitted=useRef(value),input=useRef(null);const close=useCallback(()=>setOpen(false),[]);
 useEffect(()=>{if(value!==emitted.current){setDraft(inputDate(value));emitted.current=value;}},[value]);
 useEffect(()=>{input.current?.setCustomValidity(draft&&(!value||value<earliest||value>latest)?`Enter a valid ${label.toLowerCase()} within the allowed date range.`:'');},[draft,value,earliest,latest,label]);
 function show(){const initial=value||(birthDate?`${year-25}-01-01`:today);setMonth((initial<earliest?earliest:initial>latest?latest:initial).slice(0,7)+'-01');setOpen(true);}
 function choose(day){emitted.current=day;setDraft(inputDate(day));onChange(day);close();}
 const years=Array.from({length:Number(latest.slice(0,4))-Number(earliest.slice(0,4))+1},(_,i)=>Number(latest.slice(0,4))-i);
 return <div className="merchant-date-field"><label htmlFor={id}>{label}</label><div className="merchant-date-input"><input ref={input} id={id} name={name} aria-invalid={invalid || undefined} aria-describedby={describedBy} type="text" inputMode="numeric" autoComplete={birthDate?'bday':'off'} placeholder="MM/DD/YYYY" required maxLength={10} value={draft} onChange={event=>{const next=formatDateInput(event.target.value);setDraft(next);const parsed=parseInputDate(next);emitted.current=parsed;onChange(parsed);}}/><button type="button" aria-label={`Open calendar for ${label.toLowerCase()}`} aria-haspopup="dialog" aria-expanded={open} onClick={show}><CalendarDays size={18}/></button></div>
 {open&&<MerchantDialog title={label} className="merchant-date-dialog" onClose={close}><div className="merchant-month-controls"><button type="button" aria-label="Previous month" disabled={month.slice(0,7)<=earliest.slice(0,7)} onClick={()=>setMonth(moveMonth(month,-1))}><ChevronLeft size={18}/></button><select aria-label="Month" value={Number(month.slice(5,7))} onChange={e=>setMonth(`${month.slice(0,4)}-${String(e.target.value).padStart(2,'0')}-01`)}>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{new Date(Date.UTC(2020,i,1)).toLocaleDateString('en-US',{month:'long',timeZone:'UTC'})}</option>)}</select><select aria-label="Year" value={Number(month.slice(0,4))} onChange={e=>setMonth(`${e.target.value}-${month.slice(5,7)}-01`)}>{years.map(y=><option key={y}>{y}</option>)}</select><button type="button" aria-label="Next month" disabled={month.slice(0,7)>=latest.slice(0,7)} onClick={()=>setMonth(moveMonth(month,1))}><ChevronRight size={18}/></button></div><MerchantCalendar month={month} start={value} min={earliest} max={latest} onChoose={choose} onNavigate={setMonth}/><small className="merchant-date-hint">Choose a day to apply the date.</small></MerchantDialog>}
 </div>;
}
