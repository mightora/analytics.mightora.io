import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {dayRange,percentage,change,csvCell,redactPath,escapeHtml,mergeGroups,completePreviousPeriod,coverageForHost} from '../src/stats.mjs';
import {unwrap,request,summaryQuery,detailQuery,fetchCompleteDimension,mergeSplitRows} from '../scripts/cloudflare.mjs';
import {earliestFullDay,normaliseSummary,emptyDay} from '../scripts/collect.mjs';
import {zip,crc32} from '../scripts/zip.mjs';

test('UTC days stay correct through daylight-saving changes and leap days',()=>{
  assert.deepEqual(dayRange('2024-02-28','2024-03-01'),['2024-02-28','2024-02-29','2024-03-01']);
  assert.equal(dayRange('2026-03-28','2026-03-30').length,3);
  assert.equal(earliestFullDay(31*86400,Date.parse('2026-10-29T19:30:00Z')),'2026-09-29');
});
test('missing data and zero baselines never invent percentages',()=>{
  assert.equal(percentage(0,0),null);assert.equal(change(10,0),null);assert.equal(change(120,100),20);
  const d=emptyDay('2026-01-01');assert.equal(d.edge.status,'unavailable');assert.equal(d.edge.summary,undefined);
  assert.equal(normaliseSummary(undefined).summary.requests,0);
  assert.equal(completePreviousPeriod([{date:'2026-01-01',edge:{status:'unavailable'}}],'2026-01-02','2026-01-02'),null);
});
test('all returned duplicate groups are retained and combined without dropping the tail',()=>{
  const rows=Array.from({length:125},(_,i)=>({dimensions:{host:'host-'+i},count:1}));
  rows.push({dimensions:{host:'host-124'},count:3});
  const result=mergeGroups(rows,'host');assert.equal(result.length,125);assert.equal(result.find(x=>x.name==='host-124').value,4);
});
test('text, CSV and common identifying path patterns are neutralised',()=>{
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(csvCell('=HYPERLINK("bad")'),'"\'=HYPERLINK(""bad"")"');
  assert.equal(redactPath('/user/123e4567-e89b-12d3-a456-426614174000?token=private'),'/user/[id]');
  assert.equal(redactPath('/contact/a@example.com/'),' /contact/[email]/'.trim());
});
test('DNS-only host coverage is never described as full HTTP analytics',()=>{
  assert.equal(coverageForHost('qr.mightora.io',[{name:'qr.mightora.io',proxied:false}],[]),'DNS only · no edge request data');
  assert.equal(coverageForHost('qr.mightora.io',[],['qr.mightora.io']),'DNS only · browser page views');
});
test('GraphQL errors in HTTP 200 responses cannot become successful archive entries',()=>{
  assert.throws(()=>unwrap({data:null,errors:[{message:'Not authorised'}]}),/Not authorised/);
  assert.deepEqual(unwrap({data:{viewer:{}}}),{viewer:{}});
});
test('collector retries rate limits without exposing the bearer token',async()=>{
  let attempts=0,waits=[];
  const fetcher=async()=>{attempts++;return new Response(JSON.stringify(attempts===1?{errors:[{message:'Rate limiter budget depleted'}]}:{data:{viewer:{ok:true}}}),{status:200});};
  const value=await request('/graphql',{query:'test'},{token:'test-secret',fetcher,wait:async ms=>waits.push(ms)});
  assert.equal(attempts,2);assert.deepEqual(waits,[60000]);assert.equal(value.viewer.ok,true);
});
test('HTTP queries have no bot, status or asset-exclusion filters; browser and edge sources remain separate',()=>{
  const c={zoneId:'zone',accountId:'account',rumSiteTags:['site']};
  const edge=detailQuery(c,'2026-10-01T00:00:00Z','2026-10-02T00:00:00Z','paths');
  const rum=detailQuery(c,'2026-10-01T00:00:00Z','2026-10-02T00:00:00Z','hosts','rum');
  assert.match(edge,/httpRequestsAdaptiveGroups/);assert.match(edge,/date clientRequestHTTPHost clientRequestPath/);
  assert.doesNotMatch(edge,/botScore:|requestSource:|edgeResponseStatus:|clientRequestQuery|clientIP/);
  assert.match(rum,/rumPageloadEventsAdaptiveGroups/);assert.match(rum,/siteTag_in/);
  assert.match(summaryQuery(c,'2026-01-01','2026-01-02'),/countryMap/);
});
test('row-limit results split time windows and merge duplicate groups instead of truncating',async()=>{
  let calls=0;
  const row=n=>({count:n,avg:{sampleInterval:1},sum:{edgeResponseBytes:n*10,visits:0},dimensions:{date:'2026-01-01',clientRequestHTTPHost:'api.mightora.io'}});
  const queryFn=async()=>({viewer:{zones:[{httpRequestsAdaptiveGroups:++calls===1?[row(1),row(1)]:[row(calls)]}]}});
  const rows=await fetchCompleteDimension({zoneId:'zone'},'2026-01-01T00:00:00Z','2026-01-02T00:00:00Z','hosts','edge',queryFn,2);
  assert.equal(calls,3);assert.equal(rows.length,1);assert.equal(rows[0].count,5);assert.equal(rows[0].sum.edgeResponseBytes,50);
});
test('offline ZIP is interoperable and CRC-checked',()=>{
  const data=zip({'index.html':'Hello offline','LICENSE':'MIT'});
  assert.equal(data.readUInt32LE(0),0x04034b50);
  const n=data.readUInt16LE(26),len=data.readUInt32LE(18),compressed=data.subarray(30+n,30+n+len),plain=inflateRawSync(compressed);
  assert.equal(plain.toString(),'Hello offline');assert.equal(crc32(plain),data.readUInt32LE(14));
});
test('built archive has no placeholder/truncated data and every manifest hash matches',async()=>{
  const index=JSON.parse(await readFile('data/index.json','utf8'));
  assert.ok(index.files.length>0);
  for(const file of index.files){const buffer=await readFile(file.path);assert.equal(createHash('sha256').update(buffer).digest('hex'),file.sha256);const text=buffer.toString();assert.doesNotMatch(text,/TRUNCATED/);const d=JSON.parse(text);if(d.edge.status==='available')assert.ok(Number.isFinite(d.edge.summary.requests)&&d.edge.summary.requests>=0);}
});
test('offline HTML is self-contained, downloads match, and sticky navigation is implemented',async()=>{
  const online=await readFile('index.html','utf8'),offline=await readFile('downloads/mightora-analytics-offline.html','utf8');
  assert.match(offline,/connect-src 'none'/);assert.match(offline,/window.MIGHTORA_DATA=/);assert.match(offline,/window.MIGHTORA_OFFLINE=true/);
  assert.doesNotMatch(offline,/<script[^>]+src=/);assert.doesNotMatch(offline,/<link[^>]+rel="stylesheet"/);assert.doesNotMatch(offline,/<img[^>]+src="https?:/);
  assert.ok(online.indexOf('js-yaml@4.1.1')<online.indexOf('shared-ui@main/components.js'));
  assert.match(online,/<mightora-header/);assert.match(online,/<mightora-author/);assert.match(online,/<mightora-footer/);
  assert.ok(online.indexOf('quality-badges')>online.indexOf('</mightora-author>'));
  assert.match(await readFile('src/styles.css','utf8'),/top:var\(--header-height\)/);
  assert.match(await readFile('src/app.js','utf8'),/ResizeObserver/);
  const manifest=JSON.parse(await readFile('downloads/manifest.json','utf8'));
  assert.equal(createHash('sha256').update(offline).digest('hex'),manifest.htmlSha256);
});
