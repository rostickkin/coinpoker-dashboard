export const SCHEMA_VERSION = 2;
export const METHOD_VERSION = 'tracker-snapshot-v1';
export type Status = 'available'|'unavailable'|'unsupported'|'conflict'|'notApplicable';
export interface Value<T> { status: Status; value: T|null; reasonCodes: string[] }
export const available = <T>(value:T):Value<T> => ({status:'available',value,reasonCodes:[]});
export const missing = <T>(...reasonCodes:string[]):Value<T> => ({status:'unavailable',value:null,reasonCodes});
export const unsupported = <T>(reason:string):Value<T> => ({status:'unsupported',value:null,reasonCodes:[reason]});
export const Reasons = {
 auto:'AUTO_BLIND_SEMANTICS_UNKNOWN', splash:'SPLASH_RATIO_UNKNOWN', cards:'UNKNOWN_OPPONENT_HOLE_CARDS',
 future:'MULTIWAY_FUTURE_ACTION_AMBIGUITY', rake:'RAKE_ALLOCATION_UNKNOWN', bomb:'BOMBPOT_EV_UNSUPPORTED',
 cash:'HERO_CASHOUT_UNSUPPORTED', residual:'POT_LEDGER_RESIDUAL', unknownMoney:'UNKNOWN_MONETARY_LINE',
 incomplete:'INCOMPLETE_HAND', pot:'POT_RECONSTRUCTION_UNAVAILABLE', fee:'FEE_ALLOCATION_UNKNOWN'
} as const;
export interface Rational { n:bigint; d:bigint }
function gcd(a:bigint,b:bigint):bigint { a=a<0n?-a:a; while(b){[a,b]=[b,a%b];} return a; }
export function rational(n:bigint,d=1n):Rational { if(d===0n)throw Error('Zero denominator'); if(d<0n){n=-n;d=-d;} const g=gcd(n,d); return {n:n/g,d:d/g}; }
export const add=(a:Rational,b:Rational):Rational=>rational(a.n*b.d+b.n*a.d,a.d*b.d);
export const mul=(a:Rational,b:Rational):Rational=>rational(a.n*b.n,a.d*b.d);
export const sub=(a:Rational,b:Rational):Rational=>add(a,rational(-b.n,b.d));
export const ratioNumber=(a:Rational):number=>Number(a.n)/Number(a.d);
export function money(raw:string):bigint {
 const s=raw.replace(/^₮/,'');
 if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(s))throw Error('Invalid money: '+raw);
 const [i,f='']=s.replaceAll(',','').split('.'); return BigInt(i!)*100n+BigInt(f.padEnd(2,'0'));
}
export interface LocalTime {raw:string;year:number;month:number;day:number;hour:number;minute:number;second:number;timezoneRaw:string;dateKey:string;monthKey:string;ordinalSeconds:number}
export function localTime(raw:string):LocalTime {
 const m=/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2}) (\S+)$/.exec(raw); if(!m)throw Error('Invalid date');
 const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number) as [number,number,number,number,number,number];
 // UTC here is only a calendar arithmetic coordinate; the written timezone is never converted.
 const x=new Date(Date.UTC(year,month-1,day,hour,minute,second));
 if(x.getUTCFullYear()!==year||x.getUTCMonth()+1!==month||x.getUTCDate()!==day||hour>23||minute>59||second>59)throw Error('Invalid calendar date');
 return {raw,year,month,day,hour,minute,second,timezoneRaw:m[7]!,dateKey:raw.slice(0,10).replaceAll('/','-'),monthKey:raw.slice(0,7).replace('/','-'),ordinalSeconds:x.getTime()/1000};
}
