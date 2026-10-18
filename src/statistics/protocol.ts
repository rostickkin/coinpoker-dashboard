/** The complete allowlist of information allowed to leave the browser. */
export interface VisitEvent {
 schemaVersion:1;
 eventId:string;
 visitorId:string;
 type:'visit';
 occurredAt:string;
}
export interface ImportEvent extends Omit<VisitEvent,'type'> {
 type:'import';
 hands:number;
 files:number;
 bytes:number;
}
export type UsageEvent=VisitEvent|ImportEvent;
export interface ProjectTotals {
 schemaVersion:1;
 totalVisits:number;
 uniqueVisitors:number;
 databasesLoaded:number;
 handsProcessed:number;
 filesImported:number;
 dataProcessed:number;
 startedAt:string;
 updatedAt:string;
}
export const EVENT_MAX_AGE=7*86400000;
export const SESSION_IDLE=30*60000;
export const isIdentifier=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const date=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const integer=(value:unknown,max=Number.MAX_SAFE_INTEGER):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max;

export function parseUsageEvent(value:unknown,now=Date.now()):UsageEvent|null {
 if(!object(value)||value.schemaVersion!==1||!isIdentifier(value.eventId)||!isIdentifier(value.visitorId)||!date(value.occurredAt))return null;
 const timestamp=Date.parse(value.occurredAt);
 if(timestamp<now-EVENT_MAX_AGE||timestamp>now+5*60000)return null;
 const common=['schemaVersion','eventId','visitorId','type','occurredAt'];
 if(value.type==='visit'&&Object.keys(value).every(key=>common.includes(key)))return value as unknown as VisitEvent;
 if(value.type==='import'&&Object.keys(value).every(key=>[...common,'hands','files','bytes'].includes(key))&&integer(value.hands,100_000_000)&&value.hands>0&&integer(value.files,10_000)&&value.files>0&&integer(value.bytes,100_000_000_000)&&value.bytes>0)return value as unknown as ImportEvent;
 return null;
}

export function parseProjectTotals(value:unknown):ProjectTotals|null {
 if(!object(value)||value.schemaVersion!==1||!date(value.startedAt)||!date(value.updatedAt))return null;
 const keys=['totalVisits','uniqueVisitors','databasesLoaded','handsProcessed','filesImported','dataProcessed'] as const;
 if(!keys.every(key=>integer(value[key])))return null;
 return {schemaVersion:1,...Object.fromEntries(keys.map(key=>[key,value[key]])),startedAt:value.startedAt,updatedAt:value.updatedAt} as ProjectTotals;
}

export function canonicalEvent(event:UsageEvent):string {
 return JSON.stringify([event.schemaVersion,event.eventId,event.visitorId,event.type,event.occurredAt,...(event.type==='import'?[event.hands,event.files,event.bytes]:[])]);
}
