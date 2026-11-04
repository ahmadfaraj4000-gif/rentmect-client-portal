import React, {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
export default function MerchantDialog({title,onClose,children,className='',role='dialog',descriptionId}){
 const ref=useRef(null);
 useEffect(()=>{const previous=document.activeElement;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';ref.current.focus();
 const key=e=>{if(ref.current!==[...document.querySelectorAll('.merchant-overlay [aria-modal="true"]')].at(-1))return;if(e.key==='Escape')onClose();if(e.key==='Tab'){const nodes=[...ref.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]')];const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow;previous?.focus();};},[onClose]);
 return createPortal(<div className="merchant-shell merchant-overlay"><section className={`merchant-dialog ${className}`} role={role} aria-describedby={descriptionId} aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><header><h2>{title}</h2><button type="button" aria-label="Close dialog" onClick={onClose}>×</button></header>{children}</section></div>,document.body);
}
