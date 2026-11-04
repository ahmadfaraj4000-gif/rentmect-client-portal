// Format checks only, not DMV validity checks. Preserve leading zeroes.
// Sources: CT DMV credential verification; NY DMV transaction entries; NTSI
// state format guide (reviewed 2026-11-04). Legacy variants are retained.
const formats = {
 AL:['[0-9]{1,8}',8], AK:['[0-9]{1,7}',7], AZ:['(?:[A-Z][0-9]{8}|[0-9]{9})',9], AR:['[0-9]{4,9}',9],
 CA:['[A-Z][0-9]{7}',8], CO:['(?:[0-9]{9}|[A-Z][0-9]{3,6}|[A-Z]{2}[0-9]{2,5})',9],
 CT:['[0-9]{9}',9], DE:['[0-9]{1,7}',7], DC:['(?:[0-9]{7}|[0-9]{9})',9], FL:['[A-Z][0-9]{12}',13],
 GA:['[0-9]{7,9}',9], HI:['(?:[A-Z][0-9]{8}|[0-9]{9})',9], ID:['(?:[A-Z]{2}[0-9]{6}[A-Z]|[0-9]{9})',9],
 IL:['[A-Z][0-9]{11,12}',13], IN:['(?:[A-Z][0-9]{9}|[0-9]{9,10})',10], IA:['(?:[0-9]{9}|[0-9]{3}[A-Z]{2}[0-9]{4})',9],
 KS:['(?:[A-Z][0-9][A-Z][0-9][A-Z][0-9]?|[A-Z][0-9]{8}|[0-9]{9})',9], KY:['(?:[A-Z][0-9]{8,9}|[0-9]{9})',10],
 LA:['[0-9]{1,9}',9], ME:['(?:[0-9]{7}[A-Z]?|[0-9]{8})',8], MD:['(?:[A-Z][0-9]{12}|MD[0-9]{11,12})',14],
 MA:['(?:[A-Z0-9]{2}[0-9]{7})',9], MI:['(?:[A-Z][0-9]{10}|[A-Z][0-9]{12})',13], MN:['[A-Z][0-9]{12}',13], MS:['[0-9]{9}',9],
 MO:['(?:[0-9]{3}[A-Z*][0-9]{6}|[A-Z][0-9]{5,9}|[A-Z][0-9]{6}R|[0-9]{8}[A-Z]{2}|[0-9]{9}[A-Z]?)',10],
 MT:['(?:[A-Z]{3}[0-9]{10}|[A-Z][0-9]{8}|[0-9]{9}|[0-9]{13,14})',14], NE:['[A-Z][0-9]{6,8}',9], NV:['(?:[0-9]{9,10}|[0-9]{12}|X[0-9]{8})',12],
 NH:['[0-9]{2}[A-Z]{3}[0-9]{5}',10], NJ:['[A-Z][0-9]{14}',15], NM:['[0-9]{8,9}',9], NY:['[0-9]{9}',9], NC:['[0-9]{1,12}',12],
 ND:['(?:[A-Z]{3}[0-9]{6}|[0-9]{9})',9], OH:['(?:[A-Z][0-9]{4,8}|[A-Z]{2}[0-9]{3,7}|[0-9]{8})',9], OK:['(?:[A-Z][0-9]{9}|[0-9]{9})',10],
 OR:['[0-9]{1,9}',9], PA:['[0-9]{8}',8], RI:['(?:[0-9]{7}|[A-Z][0-9]{6})',7], SC:['[0-9]{5,11}',11], SD:['(?:[0-9]{6,10}|[0-9]{12})',12],
 TN:['[0-9]{7,9}',9], TX:['[0-9]{7,8}',8], UT:['[0-9]{4,10}',10], VT:['(?:[0-9]{8}|[0-9]{7}A)',8], VA:['(?:[A-Z][0-9]{8,11}|[0-9]{9})',12],
 WA:['[A-Z][A-Z0-9*]{11}',12], WV:['(?:[0-9]{7}|[A-Z]{1,2}[0-9]{5,6})',8], WI:['[A-Z][0-9]{13}',14], WY:['[0-9]{9,10}',10],
};
export const LICENSE_STATES = Object.keys(formats).sort();
export function licenseRule(state) {
 const rule=formats[String(state).toUpperCase()];
 return rule ? {pattern:rule[0],maxLength:rule[1],hint:state==='CT'||state==='NY'?'9 digits':`Use the ${state} license number, up to ${rule[1]} characters; omit spaces and dashes.`} : null;
}
export function normalizeLicense(value) { return String(value||'').toUpperCase().replace(/[\s-]/g,''); }
export function validateLicense(state,value) {
 const rule=licenseRule(state); const number=normalizeLicense(value);
 if(!rule)throw new Error('Choose a supported US issuing state. Contact Rent Me CT for other licenses.');
 if(!new RegExp(`^(?:${rule.pattern})$`).test(number))throw new Error(`The license number does not match the ${state} format. ${rule.hint}. Check the original license or contact Rent Me CT.`);
 return number;
}
