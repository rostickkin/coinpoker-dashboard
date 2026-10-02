export interface Interval {handId:string;start:number;end:number;timezoneRaw:string}
export interface Session {id:string;start:number;end:number;timezoneRaw:string;handIds:string[];estimatedSpanSeconds:number;observedUnionSeconds:number}
export function buildSessions(input:readonly Interval[]):Session[] {
 const sorted=[...input].sort((a,b)=>a.timezoneRaw.localeCompare(b.timezoneRaw)||a.start-b.start||a.handId.length-b.handId.length||a.handId.localeCompare(b.handId));
 const sessions:Session[]=[];let unionEnd=0;
 for(const i of sorted){if(i.end<i.start)throw Error('Negative interval');let s=sessions.at(-1);
  if(!s||s.timezoneRaw!==i.timezoneRaw||i.start-s.end>1800){s={id:'session'+sessions.length,start:i.start,end:i.end,timezoneRaw:i.timezoneRaw,handIds:[],estimatedSpanSeconds:0,observedUnionSeconds:0};sessions.push(s);unionEnd=i.start;}
  s.observedUnionSeconds+=Math.max(0,i.end-Math.max(i.start,unionEnd));unionEnd=Math.max(unionEnd,i.end);s.end=Math.max(s.end,i.end);s.estimatedSpanSeconds=s.end-s.start;s.handIds.push(i.handId);
 }return sessions;
}
export function clipIntervals(input:readonly Interval[],from:number,to:number):Interval[]{return input.filter(i=>i.end>from&&i.start<to).map(i=>({...i,start:Math.max(i.start,from),end:Math.min(i.end,to)}));}
