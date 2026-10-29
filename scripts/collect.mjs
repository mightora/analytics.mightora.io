import {readFile, appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {DAY, dayRange, isoDay} from '../src/stats.mjs';
import {gql, request, atomicJson, archivePath, exists, readJson, settingsQuery, summaryQuery, fetchCompleteDimension, EDGE_DIMENSIONS, RUM_DIMENSIONS} from './cloudflare.mjs';

export function earliestFullDay(retention, now=Date.now()) {
  return isoDay(Math.ceil((now-retention*1000)/DAY)*DAY);
}
export function normaliseSummary(row) {
  const s=row?.sum ?? {};
  return {status:'available',dataset:'httpRequests1dGroups',precision:'aggregate',
    summary:Object.fromEntries(['requests','bytes','cachedRequests','cachedBytes','threats','pageViews','encryptedRequests','encryptedBytes'].map(k=>[k,s[k]??0])),
    dailyUniqueIPs:row?.uniq?.uniques??0,
    maps:Object.fromEntries(['countryMap','responseStatusMap','contentTypeMap','browserMap'].map(k=>[k,s[k]??[]])),
    mapsStatus:Object.hasOwn(s,'countryMap')?'available':'partial',raw:row??null};
}
export function emptyDay(date, now=new Date().toISOString()) {
  return {schemaVersion:1,date,timezone:'UTC',collectedAt:now,
    edge:{status:'unavailable',reason:'Outside the Cloudflare daily-summary retention window'},
    details:{status:'unavailable',reason:'Outside the Cloudflare detailed HTTP retention window',datasets:{}},
    rum:{status:'unavailable',reason:'Outside the Cloudflare Web Analytics retention window',datasets:{}}};
}
async function chunks(dates,size,fn) {
  for(let i=0;i<dates.length;i+=size) {
    const slice=dates.slice(i,i+size);
    // Separate disjoint dates to avoid overwriting already archived results.
    const gaps=slice.some((d,j)=>j && Date.parse(d)-Date.parse(slice[j-1])!==DAY);
    if(gaps) { for(const d of slice) await fn([d]); } else await fn(slice);
  }
}
export async function collect({days=365, now=Date.now(), queryFn=gql, requestFn=request}={}) {
  const config=JSON.parse(await readFile('config.json','utf8'));
  const end=isoDay(Math.floor(now/DAY)*DAY-DAY);
  const start=isoDay(Date.parse(end)-(days-1)*DAY);
  const dates=dayRange(start,end);
  const settingsData=await queryFn(settingsQuery(config));
  const edgeSettings=settingsData.viewer?.zones?.[0]?.settings;
  const rumSettings=settingsData.viewer?.accounts?.[0]?.settings?.rumPageloadEventsAdaptiveGroups;
  if(!edgeSettings?.httpRequests1dGroups?.enabled) throw new Error('Daily HTTP summaries are not accessible. Check Zone Analytics Read permission.');
  await atomicJson('data/source-settings.json',{checkedAt:new Date(now).toISOString(),edge:edgeSettings,rum:rumSettings});
  const archive=new Map();
  for(const date of dates) archive.set(date,await exists(archivePath(date)) ? await readJson(archivePath(date)) : emptyDay(date,new Date(now).toISOString()));
  // Commit each successful batch to disk. Failed later batches leave earlier ones recoverable.
  let checkpointAt=Date.now();
  const runGit=promisify(execFile);
  const checkpoint=async(force=false)=>{
    if(process.env.GITHUB_ACTIONS!=='true'||(!force&&Date.now()-checkpointAt<180000))return;
    await runGit('git',['add','data/daily','data/source-settings.json']);
    let changed=false;
    try{await runGit('git',['diff','--cached','--quiet']);}catch(e){if(e.code===1)changed=true;else throw e;}
    if(changed){await runGit('git',['commit','-m','Checkpoint Cloudflare analytics archive']);await runGit('git',['push','origin','HEAD:main']);}
    checkpointAt=Date.now();
  };
  const save=async slice=>{for(const date of slice) await atomicJson(archivePath(date),archive.get(date));await checkpoint();};
  let failures=0;
  const firstSummary=earliestFullDay(edgeSettings.httpRequests1dGroups.notOlderThan,now);
  const neededSummary=dates.filter(d=>d>=firstSummary && (archive.get(d).edge.status!=='available'||archive.get(d).edge.mapsStatus==='partial'));
  await chunks(neededSummary,Math.min(7,Math.floor(edgeSettings.httpRequests1dGroups.maxDuration/86400)),async slice=>{
    console.log(`Archiving daily HTTP summaries ${slice[0]} → ${slice.at(-1)}`);
    const data=await queryFn(summaryQuery(config,slice[0],isoDay(Date.parse(slice.at(-1))+DAY)));
    const rows=data.viewer?.zones?.[0]?.httpRequests1dGroups;
    if(!Array.isArray(rows)) throw new Error('Daily summary dataset missing');
    const byDate=new Map(rows.map(r=>[r.dimensions.date,r]));
    for(const date of slice) archive.get(date).edge=normaliseSummary(byDate.get(date));
    await save(slice);
  });
  for(const [source,settings,dimensions,key] of [
    ['edge',edgeSettings.httpRequestsAdaptiveGroups,EDGE_DIMENSIONS,'details'],
    ['rum',rumSettings,RUM_DIMENSIONS,'rum']
  ]) {
    if(!settings?.enabled) {
      for(const date of dates) if(archive.get(date)[key].status!=='available') archive.get(date)[key].reason='Dataset not accessible with the configured token or plan';
      continue;
    }
    const first=earliestFullDay(settings.notOlderThan,now);
    for(const dimension of Object.keys(dimensions)) {
      // An observed empty host dataset proves the day has no events to group further.
      if(dimension!=='hosts')for(const date of dates){const item=archive.get(date)[key];if(Array.isArray(item.datasets?.hosts)&&item.datasets.hosts.length===0)item.datasets[dimension]=[];}
      const needed=dates.filter(d=>d>=first && !Array.isArray(archive.get(d)[key].datasets?.[dimension]));
      // Small daily windows and limits keep query cost reasonable on the Free plan.
      // High-cardinality days are recursively split; no tail groups are discarded.
      await chunks(needed,1,async slice=>{
        console.log(`Archiving ${source}/${dimension} ${slice[0]} → ${slice.at(-1)}`);
        try {
          const rows=await fetchCompleteDimension(config,slice[0]+'T00:00:00Z',isoDay(Date.parse(slice.at(-1))+DAY)+'T00:00:00Z',dimension,source,queryFn,Math.min(100,settings.maxPageSize));
          for(const date of slice) {
            const item=archive.get(date)[key]; item.datasets ??= {};
            item.datasets[dimension]=rows.filter(r=>r.dimensions.date===date);
            item.status='partial'; item.dataset=source==='edge'?'httpRequestsAdaptiveGroups':'rumPageloadEventsAdaptiveGroups';
            item.precision='adaptive'; delete item.reason;
          }
          await save(slice);
        } catch(error) {
          failures++; console.error(`Could not archive ${source}/${dimension}: ${error.message}`);
          for(const date of slice) archive.get(date)[key].errors={...archive.get(date)[key].errors,[dimension]:error.message};
        }
      });
    }
    for(const date of dates) {
      const item=archive.get(date)[key];
      if(Object.keys(dimensions).every(d=>Array.isArray(item.datasets?.[d]))) {item.status='available';delete item.errors;delete item.reason;}
    }
  }
  await save(dates);
  await checkpoint(true);
  try {
    const records=[];
    for(let page=1;;page++) {
      const result=await requestFn(`/zones/${config.zoneId}/dns_records?per_page=100&page=${page}`);
      // request() unwraps REST's result array. Continue until a short page.
      records.push(...result.filter(r=>['A','AAAA','CNAME'].includes(r.type)).map(({name,proxied,type})=>({name,proxied,type})));
      if(result.length<100)break;
    }
    await atomicJson('data/coverage.json',{checkedAt:new Date(now).toISOString(),records});
  } catch(error) {console.warn(`Coverage snapshot not refreshed: ${error.message}`);}
  await atomicJson('data/last-run.json',{finishedAt:new Date().toISOString(),start,end,failures,status:failures?'partial':'success'});
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`## Cloudflare archive\n${start} to ${end} (UTC). ${neededSummary.length} new daily summaries; ${failures} failed detail batches. Existing files are retained.\n`);
  if(failures)throw new Error(`${failures} detail batches failed. Successful data is saved; missing dimensions will be retried next run.`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const arg=process.argv.indexOf('--days');
  const days=arg<0 ? 365:Number(process.argv[arg+1]);
  if(!Number.isInteger(days)||days<1||days>3660)throw new Error('--days must be between 1 and 3660');
  await collect({days});
}
