import {useEffect,useSyncExternalStore} from 'react';
import {createStatisticsClient,type StatisticsStorage} from '../statistics/client.ts';
import type {ProjectTotals} from '../statistics/protocol.ts';

function storage():StatisticsStorage|undefined {try{return window.localStorage;}catch{return undefined;}}
export const statistics=createStatisticsClient({endpoint:import.meta.env.VITE_STATS_API_URL??'',storage:storage()});
const metrics:{key:keyof Pick<ProjectTotals,'totalVisits'|'uniqueVisitors'|'databasesLoaded'|'handsProcessed'|'filesImported'|'dataProcessed'>;label:string;description:string}[]=[
 {key:'totalVisits',label:'Total Visits',description:'Visits separated by at least 30 minutes of inactivity.'},
 {key:'uniqueVisitors',label:'Unique Visitors',description:'Estimated unique browsers, using a random identifier stored on each device.'},
 {key:'databasesLoaded',label:'Databases Loaded',description:'Successful imports. Each completed file selection counts once, including reimports.'},
 {key:'handsProcessed',label:'Hands Processed',description:'Accepted hands across successful imports. Reimported histories count again.'},
 {key:'filesImported',label:'Files Imported',description:'Files processed in successful imports.'},
 {key:'dataProcessed',label:'Data Processed',description:'Total file size across successful imports. GB uses decimal units.'},
];
function format(value:number,key:string):string {
 if(key==='dataProcessed'){
  const exponent=value?Math.min(3,Math.floor(Math.log10(value)/3)):0;
  return new Intl.NumberFormat('en-US',{maximumFractionDigits:exponent?1:0}).format(value/1000**exponent)+' '+['B','KB','MB','GB'][exponent];
 }
 return new Intl.NumberFormat('en-US',key==='handsProcessed'&&value>=1_000_000?{notation:'compact',maximumFractionDigits:2}:{}).format(value);
}
const displayDate=(value:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value));

export function ProjectStatistics(){
 const snapshot=useSyncExternalStore(statistics.subscribe,statistics.getSnapshot);
 useEffect(()=>{
  void statistics.start();
  const activity=()=>statistics.activity();
  const resume=()=>{statistics.activity();void statistics.flush();void statistics.loadTotals();};
  const visibility=()=>{if(document.visibilityState==='visible')resume();else statistics.persist();};
  window.addEventListener('pointerdown',activity,{passive:true});window.addEventListener('keydown',activity);
  window.addEventListener('focus',resume);window.addEventListener('online',resume);
  window.addEventListener('storage',statistics.synchronizeSharing);
  window.addEventListener('pagehide',statistics.persist);document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);window.removeEventListener('storage',statistics.synchronizeSharing);window.removeEventListener('pagehide',statistics.persist);document.removeEventListener('visibilitychange',visibility);statistics.persist();};
 },[]);
 const {totals,status,sharing}=snapshot;
 const notice=status==='unconfigured'?'Statistics are not available yet.':status==='loading'?'Loading project statistics…':status==='unavailable'?(totals?'Showing the last available totals.':'Statistics are temporarily unavailable.'):totals?'Since '+displayDate(totals.startedAt):'';
 return <section className="project-statistics" aria-labelledby="project-statistics-title">
  <h2 id="project-statistics-title" title="All-time project activity">CoinPoker Dashboard Statistics</h2>
  <div className="project-stat-grid">{metrics.map(metric=><article className="project-stat" key={metric.key} title={metric.description}><div>{metric.label}</div><strong>{totals?format(totals[metric.key],metric.key):'—'}</strong></article>)}</div>
  <div className="project-statistics-meta"><span className="project-statistics-status" role="status">{notice}</span><span title={'Updated '+displayDate(__BUILD_DATE__)}>v{__APP_VERSION__}</span>{status!=='unconfigured'&&<label className="project-sharing" title="Shares a random browser ID and visit/import counts. Hand histories, filenames and poker results stay on your device."><input type="checkbox" checked={sharing} onChange={event=>statistics.setSharing(event.target.checked)}/>Share usage statistics</label>}</div>
 </section>;
}
