import test from 'node:test';import assert from 'node:assert/strict';
import {formatMerchantPhone,parseInputDate,formatDateInput,moveMonth} from './merchantFormFields.js';
test('phone formatting inserts dashes while typing and normalizes US pastes',()=>{
 for(const [input,expected] of [['',''],['860','860'],['8602','860-2'],['8602050','860-205-0'],['8602050115','860-205-0115'],['+1 (860) 205-0115','860-205-0115'],['860-205-','860-205']])assert.equal(formatMerchantPhone(input),expected);
});
test('typed calendar dates preserve leap years and reject impossible or incomplete dates',()=>{
 assert.equal(parseInputDate('02/29/2000'),'2000-02-29');
 for(const value of ['02/29/2001','04/31/2026','13/01/2026','11/04/20',''])assert.equal(parseInputDate(value),'');
 assert.equal(formatDateInput('11041990'),'11/04/1990');
});
test('calendar month navigation crosses year boundaries without day overflow',()=>{
 assert.equal(moveMonth('2026-12-01',1),'2027-01-01');
 assert.equal(moveMonth('2027-01-01',-1),'2026-12-01');
 assert.equal(moveMonth('2026-01-31',1),'2026-02-01');
});
