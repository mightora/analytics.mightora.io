// Accept the authenticated connector's API results without ever writing an API token.
// Usage: node scripts/import-bootstrap.mjs /absolute/path/to/result.json [edge|rum] [dimension]
import {readFile} from 'node:fs/promises';
import {unwrap,archivePath,readJson,atomicJson,exists,sanitiseRows} from './cloudflare.mjs';
import {emptyDay,normaliseSummary} from './collect.mjs';
import {dayRange} from '../src/stats.mjs';
const payload=JSON.parse(await readFile(process.argv[2],'utf8'));
const data=unwrap(payload);
const source=process.argv[3];
if(!source) {
  const rows=data.viewer.zones[0].httpRequests1dGroups;
  for(const row of rows) {
    const date=row.dimensions.date;
    const item=await exists(archivePath(date))?await readJson(archivePath(date)):emptyDay(date);
    const next=normaliseSummary(row);
    if(!Object.hasOwn(row.sum,'countryMap')&&item.edge.maps?.countryMap){next.maps=item.edge.maps;next.mapsStatus=item.edge.mapsStatus||'available';}
    item.edge=next;await atomicJson(archivePath(date),item);
  }
  if(data.viewer.accounts?.[0]?.settings)await atomicJson('data/rum-settings.json',data.viewer.accounts[0].settings);
  console.log(`Imported ${rows.length} daily summaries.`);
} else {
  const owner=source==='edge'?data.viewer.zones[0]:data.viewer.accounts[0];
  const rows=sanitiseRows(owner[source==='edge'?'httpRequestsAdaptiveGroups':'rumPageloadEventsAdaptiveGroups']);
  const byDate=Map.groupBy(rows,r=>r.dimensions.date);
  if(process.argv[5]&&process.argv[6])for(const date of dayRange(process.argv[5],process.argv[6]))if(!byDate.has(date))byDate.set(date,[]);
  for(const [date,dateRows] of byDate) {
    const item=await exists(archivePath(date))?await readJson(archivePath(date)):emptyDay(date);
    const key=source==='edge'?'details':'rum';const section=item[key];
    section.datasets??={};section.datasets[process.argv[4]]=dateRows;
    section.status='partial';section.dataset=source==='edge'?'httpRequestsAdaptiveGroups':'rumPageloadEventsAdaptiveGroups';
    section.precision='adaptive';delete section.reason;
    await atomicJson(archivePath(date),item);
  }
  console.log(`Imported ${rows.length} ${source}/${process.argv[4]} groups across ${byDate.size} days.`);
}
