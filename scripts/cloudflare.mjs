import {readFile, mkdir, writeFile, rename, access} from 'node:fs/promises';
import {dirname} from 'node:path';
import {redactPath} from '../src/stats.mjs';

export const ENDPOINT = 'https://api.cloudflare.com/client/v4';
export async function atomicJson(path, value) {
  await mkdir(dirname(path), {recursive:true});
  await writeFile(path + '.tmp', JSON.stringify(value) + '\n');
  await rename(path + '.tmp', path);
}
export async function exists(path) { try { await access(path); return true; } catch { return false; } }
export async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
export function archivePath(date) { return `data/daily/${date.slice(0,4)}/${date.slice(5,7)}/${date}.json`; }
export function unwrap(payload) {
  // The direct API returns {data,errors}; the Cloudflare connector uses {result,errors}.
  if (payload.errors?.length || payload.success === false) throw new Error((payload.errors || []).map(e=>e.message).join('; ') || 'Cloudflare request failed');
  const data = payload.data ?? payload.result;
  if (!data) throw new Error('Cloudflare returned no data');
  return data;
}
export async function request(path, body, {token=process.env.CLOUDFLARE_API_TOKEN, fetcher=fetch, retries=7, wait=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is missing. Add the read-only token to the repository Actions secrets.');
  for (let attempt=0; attempt<=retries; attempt++) {
    const res = await fetcher(ENDPOINT + path, {
      method:body ? 'POST':'GET', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
      ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(60000)
    });
    let payload;
    try { payload = await res.json(); } catch { throw new Error(`Cloudflare returned HTTP ${res.status} without JSON`); }
    const message = (payload.errors || []).map(e=>e.message).join('; ');
    const rateLimited = res.status === 429 || /rate limit|budget depleted/i.test(message);
    const transient = rateLimited || res.status >= 500;
    if (transient && attempt < retries) {
      const seconds = rateLimited ? Math.min(60, Math.max(30, Number(res.headers.get('retry-after')) || 60)) : Math.min(30, 2**attempt);
      console.warn(`Cloudflare is busy; retry ${attempt+1}/${retries} in ${seconds}s.`);
      await wait(seconds*1000); continue;
    }
    if (!res.ok) throw new Error(`Cloudflare HTTP ${res.status}: ${message || 'request failed'}`);
    return unwrap(payload);
  }
}
export const gql = query => request('/graphql', {query});
export function settingsQuery(config) {
  return `{ viewer { zones(filter:{zoneTag:"${config.zoneId}"}) { settings {
    httpRequests1dGroups { enabled notOlderThan maxDuration maxPageSize }
    httpRequestsAdaptiveGroups { enabled notOlderThan maxDuration maxPageSize }
  } } accounts(filter:{accountTag:"${config.accountId}"}) { settings {
    rumPageloadEventsAdaptiveGroups { enabled notOlderThan maxDuration maxPageSize }
  } } } }`;
}
export const SUMMARY_FIELDS = `dimensions { date } uniq { uniques } sum {
  requests bytes cachedRequests cachedBytes threats pageViews encryptedRequests encryptedBytes
  countryMap { clientCountryName requests bytes threats }
  responseStatusMap { edgeResponseStatus requests }
  contentTypeMap { edgeResponseContentTypeName requests bytes }
  browserMap { uaBrowserFamily pageViews }
}`;
export function summaryQuery(config, start, end, limit=400) {
  return `{ viewer { zones(filter:{zoneTag:"${config.zoneId}"}) { httpRequests1dGroups(limit:${limit},filter:{date_geq:"${start}",date_lt:"${end}"},orderBy:[date_ASC]) { ${SUMMARY_FIELDS} } } } }`;
}
export const EDGE_DIMENSIONS = {
  hosts:['clientRequestHTTPHost'], paths:['clientRequestHTTPHost','clientRequestPath'],
  countries:['clientRequestHTTPHost','clientCountryName'], status:['clientRequestHTTPHost','edgeResponseStatus'],
  cache:['clientRequestHTTPHost','cacheStatus'], devices:['clientRequestHTTPHost','clientDeviceType'],
  referrers:['clientRequestHTTPHost','clientRefererHost'], protocols:['clientRequestHTTPHost','clientRequestHTTPProtocol'],
  hourly:['clientRequestHTTPHost','datetimeHour']
};
export const RUM_DIMENSIONS = {
  hosts:['requestHost'], paths:['requestHost','requestPath'], countries:['requestHost','countryName'],
  browsers:['requestHost','userAgentBrowser'], devices:['requestHost','deviceType'],
  referrers:['requestHost','refererHost'], operatingSystems:['requestHost','userAgentOS'], hourly:['requestHost','datetimeHour']
};
export function detailQuery(config, start, end, dimension, source='edge', limit=10000) {
  const selected = (source==='edge' ? EDGE_DIMENSIONS : RUM_DIMENSIONS)[dimension];
  if (!selected) throw new Error('Unknown dimension');
  const fields = ['date', ...selected];
  const filter = source==='edge' ? '' : `,siteTag_in:${JSON.stringify(config.rumSiteTags)}`;
  const dataset=source==='edge' ? 'httpRequestsAdaptiveGroups':'rumPageloadEventsAdaptiveGroups';
  const owner=source==='edge' ? `zones(filter:{zoneTag:"${config.zoneId}"})` : `accounts(filter:{accountTag:"${config.accountId}"})`;
  // Deliberately no bot, status, requestSource, cache or path exclusion filter.
  return `{ viewer { ${owner} { ${dataset}(limit:${limit},filter:{datetime_geq:"${start}",datetime_lt:"${end}"${filter}},orderBy:[${fields.map(f=>f+'_ASC').join(',')}]) {
    count avg { sampleInterval } sum { ${source==='edge' ? 'edgeResponseBytes visits':'visits'} } dimensions { ${fields.join(' ')} }
  } } } }`;
}
export function detailRows(data, source) {
  const owner = source==='edge' ? data.viewer?.zones?.[0] : data.viewer?.accounts?.[0];
  const rows=owner?.[source==='edge' ? 'httpRequestsAdaptiveGroups':'rumPageloadEventsAdaptiveGroups'];
  if (!Array.isArray(rows)) throw new Error('Cloudflare omitted the requested dataset');
  return rows;
}
export function sanitiseRows(rows) {
  // No IPs, query strings, full referrer URLs, user IDs or user-agent strings are queried.
  // Redact common sensitive path shapes before they reach a public repository.
  return rows.map(row=>({...row, dimensions:Object.fromEntries(Object.entries(row.dimensions).map(([k,v])=>[k,/Path$/.test(k) ? redactPath(v):v]))}));
}
export function mergeSplitRows(rows) {
  const groups=new Map();
  for(const row of rows) {
    const key=JSON.stringify(Object.entries(row.dimensions).sort(([a],[b])=>a.localeCompare(b)));
    const old=groups.get(key);
    if(!old) { groups.set(key,structuredClone(row)); continue; }
    const count=old.count+row.count;
    old.avg.sampleInterval=count ? (old.avg.sampleInterval*old.count+row.avg.sampleInterval*row.count)/count : 1;
    old.count=count;
    for(const [k,v] of Object.entries(row.sum)) old.sum[k]=(old.sum[k]||0)+v;
  }
  return [...groups.values()];
}
export async function fetchCompleteDimension(config, start, end, dimension, source='edge', queryFn=gql, limit=10000) {
  const rows=detailRows(await queryFn(detailQuery(config,start,end,dimension,source,limit)),source);
  if(rows.length < limit) return sanitiseRows(rows);
  // Split time recursively rather than silently keeping only a top-N result.
  const left=Date.parse(start), right=Date.parse(end);
  if(right-left<=1000) throw new Error(`Dimension ${dimension} exceeds the API row limit even at one second; no complete result was archived.`);
  const middle=new Date(Math.floor((left+right)/2000)*1000).toISOString();
  const a=await fetchCompleteDimension(config,start,middle,dimension,source,queryFn,limit);
  const b=await fetchCompleteDimension(config,middle,end,dimension,source,queryFn,limit);
  return mergeSplitRows([...a,...b]);
}
