// Rendered from the same source in the online and fully self-contained offline editions.
const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('en-GB');
const compact = new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1});
const dateLabel = d => new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const shortDate = d => new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const bytesLabel = n => {if(n===null||!Number.isFinite(n))return '—';const u=['B','KB','MB','GB','TB'];let i=0;while(n>=1000&&i<4){n/=1000;i++}return `${new Intl.NumberFormat('en-GB',{maximumFractionDigits:i?1:0}).format(n)} ${u[i]}`;};
const countryLabel = code => {try {return new Intl.DisplayNames(['en-GB'],{type:'region'}).of(code)||code;} catch{return code;}};
let archive, state={source:'edge',host:'all',start:'',end:'',metric:'requests',detail:'paths',search:'',showAll:false};
function empty(message='No data is available for this selection.') {return `<div class="empty">${escapeHtml(message)}</div>`;}
function selectedDays(){return archive.days.filter(d=>d.date>=state.start&&d.date<=state.end);}
function groups(days,dimension){
  const rows=days.flatMap(d=>(d[state.source==='edge'?'details':'rum']?.datasets?.[dimension]||[]));
  return state.host==='all'?rows:rows.filter(r=>(r.dimensions.clientRequestHTTPHost??r.dimensions.requestHost)===state.host);
}
function timeSeries(days){return days.map(d=>{
  if(state.source==='edge'&&state.host==='all')return {date:d.date,...(d.edge?.status==='available'?d.edge.summary:{requests:null,bytes:null}),available:d.edge?.status==='available'};
  const section=d[state.source==='edge'?'details':'rum'];
  const rows=section?.datasets?.hosts;
  if(!Array.isArray(rows))return {date:d.date,requests:null,bytes:null,available:false};
  const selected=state.host==='all'?rows:rows.filter(r=>(r.dimensions.clientRequestHTTPHost??r.dimensions.requestHost)===state.host);
  return {date:d.date,requests:sum(selected,'count'),bytes:sum(selected.map(r=>r.sum),'edgeResponseBytes'),visits:sum(selected.map(r=>r.sum),'visits'),available:true};
});}
function table(headers,rows,numeric=[]){if(!rows.length)return empty();return `<table><thead><tr>${headers.map((h,i)=>`<th scope="col"${numeric.includes(i)?' class="num"':''}>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((c,i)=>`<td${numeric.includes(i)?' class="num"':''}>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
function rank(target,items,{total,limit=6,format=n=>nf.format(n)}={}){
  if(!items.length){$(target).innerHTML=empty();return;}
  total??=items.reduce((a,b)=>a+b.value,0);const max=Math.max(...items.map(x=>x.value),1);
  $(target).innerHTML=items.slice(0,limit).map(({name,value})=>`<div class="rank-row"><div class="rank-label"><span class="rank-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span><span class="rank-value">${format(value)}</span><span class="rank-share">${(percentage(value,total)||0).toFixed(1)}%</span></div><div class="rank-track"><div class="rank-fill" style="width:${Math.max(0,value/max*100)}%"></div></div></div>`).join('');
}
function metric(label,value,note,icon,delta=null){return `<article class="metric"><div class="metric-label">${label}<span class="metric-icon" aria-hidden="true">${icon}</span></div><div class="metric-value">${value}</div><p class="metric-note">${delta===null?'':`<span class="delta${delta<0?' negative':''}">${delta>=0?'↗':'↘'} ${Math.abs(delta).toFixed(1)}%</span>`}${escapeHtml(note)}</p></article>`;}
function priorSeries(){const count=dayRange(state.start,state.end).length;const end=isoDay(Date.parse(state.start)-DAY);const start=isoDay(Date.parse(end)-(count-1)*DAY);const result=timeSeries(archive.days.filter(d=>d.date>=start&&d.date<=end));return result.length===count&&result.every(d=>d.available)?result:null;}
function renderMetrics(days,series){
  const available=series.filter(s=>s.available), count=available.length;
  const prev=priorSeries();const requests=count?sum(available,'requests'):null;
  const bytes=count?sum(available,'bytes'):null;
  const delta=prev?change(requests,sum(prev,'requests')):null;
  const countNote=`${count} of ${series.length} selected days available`;
  if(state.source==='edge'&&state.host==='all'){
    const records=days.filter(d=>d.edge?.status==='available').map(d=>d.edge.summary);
    const cached=sum(records,'cachedRequests'),ratio=percentage(cached,requests),threats=count?sum(records,'threats'):null;
    $('metrics').innerHTML=metric('HTTP requests',requests===null?'—':nf.format(requests),prev?'vs previous complete period':countNote,'↗',delta)+metric('Bandwidth',bytes===null?'—':bytesLabel(bytes),'Response data served by the edge','↓')+metric('Requests served from cache',ratio===null?'—':ratio.toFixed(1)+'%',`${nf.format(cached)} cached requests`,'◷')+metric('Threats stopped',threats===null?'—':nf.format(threats),'Included within the traffic picture','◇');
  }else{
    const visits=count?sum(available,'visits'):null;
    const countries=mergeGroups(groups(days,'countries'),state.source==='edge'?'clientCountryName':'countryName');
    $('metrics').innerHTML=metric(state.source==='edge'?'HTTP requests':'Browser page views',requests===null?'—':nf.format(requests),prev?'vs previous complete period':countNote,'↗',delta)+metric(state.source==='edge'?'Bandwidth':'Visits',state.source==='edge'?(bytes===null?'—':bytesLabel(bytes)):(visits===null?'—':nf.format(visits)),state.source==='edge'?'Response data in adaptive groups':'Cloudflare visit metric; not unique people','↓')+metric('Countries recorded',count?nf.format(countries.length):'—','From available adaptive breakdowns','◎')+metric('Days archived',nf.format(count),`Within ${series.length} selected UTC days`,'▦');
  }
}
function renderLine(series){
  const field=state.metric;const valid=series.filter(r=>r.available&&Number.isFinite(r[field]));
  if(!valid.length){$('traffic-chart').innerHTML=empty('This source has no archived data for the selected dates. Try another range or source.');$('traffic-table').innerHTML='';return;}
  const previous=priorSeries();const W=1100,H=250,p={l:55,r:16,t:14,b:28};const iw=W-p.l-p.r,ih=H-p.t-p.b;
  const max=Math.max(1,...valid.map(r=>r[field]),...(previous||[]).map(r=>r[field]||0))*1.12;
  const x=i=>p.l+(series.length===1?iw/2:i/(series.length-1)*iw),y=v=>p.t+ih-v/max*ih;
  function line(rows){let path='',open=false;rows.forEach((r,i)=>{if(!r.available||r[field]===null){open=false;return;}path+=`${open?'L':'M'}${x(i).toFixed(1)},${y(r[field]).toFixed(1)} `;open=true;});return path;}
  let area='',segment=[];
  function finish(){if(segment.length){area+=`M${x(segment[0][0])},${p.t+ih} `+segment.map(([i,v])=>`L${x(i)},${y(v)}`).join(' ')+` L${x(segment.at(-1)[0])},${p.t+ih} Z `;segment=[];}}
  series.forEach((r,i)=>{if(r.available&&r[field]!==null)segment.push([i,r[field]]);else finish();});finish();
  const format=field==='bytes'?bytesLabel:v=>compact.format(v);
  const grids=Array.from({length:5},(_,i)=>{const v=max*i/4;return `<line class="grid-line" x1="${p.l}" x2="${W-p.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${p.l-12}" y="${y(v)+3}" text-anchor="end">${format(v)}</text>`;}).join('');
  const ticks=[...new Set([0,Math.floor((series.length-1)/4),Math.floor((series.length-1)/2),Math.floor((series.length-1)*3/4),series.length-1])].map(i=>`<text x="${x(i)}" y="${H-5}" text-anchor="${i===0?'start':i===series.length-1?'end':'middle'}">${shortDate(series[i].date)}</text>`).join('');
  const circles=series.length<50?series.map((r,i)=>r.available?`<circle cx="${x(i)}" cy="${y(r[field])}" r="${series.length===1?4:2}" fill="var(--chart)"/>`:'').join(''):'';
  const hits=series.map((r,i)=>`<rect class="chart-hit" data-point="${i}" x="${x(i)-Math.max(2,iw/series.length/2)}" y="${p.t}" width="${Math.max(4,iw/series.length)}" height="${ih}"><title>${escapeHtml(dateLabel(r.date))}: ${r.available?nf.format(r[field]):'Unavailable'}</title></rect>`).join('');
  $('traffic-chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${field==='bytes'?'Bandwidth':'Traffic'} over ${series.length} days; ${valid.length} days have data. Accessible values are in the table below."><defs><linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--chart)" stop-opacity=".20"/><stop offset="100%" stop-color="var(--chart)" stop-opacity=".01"/></linearGradient></defs>${grids}<path d="${area}" fill="url(#traffic-fill)"/>${previous?`<path d="${line(previous)}" fill="none" stroke="#9caea2" stroke-width="1.6" stroke-dasharray="5 5"/>`:''}<path d="${line(series)}" stroke="var(--chart)" stroke-width="2.3" fill="none" stroke-linejoin="round"/>${circles}${ticks}${hits}</svg><div class="chart-tip" hidden></div>`;
  const tip=$('traffic-chart').querySelector('.chart-tip');
  $('traffic-chart').querySelectorAll('[data-point]').forEach(el=>el.addEventListener('pointermove',event=>{const row=series[+el.dataset.point];tip.textContent=`${dateLabel(row.date)} · ${row.available?(field==='bytes'?bytesLabel(row[field]):nf.format(row[field])):'Unavailable'}`;tip.hidden=false;const box=$('traffic-chart').getBoundingClientRect();tip.style.left=Math.max(0,Math.min(box.width-220,event.clientX-box.left+12))+'px';tip.style.top=Math.max(0,event.clientY-box.top-42)+'px';}));
  $('traffic-chart').addEventListener('pointerleave',()=>{tip.hidden=true;},{once:true});
  $('traffic-table').innerHTML=table(['UTC day',state.source==='rum'?'Browser page views':'HTTP requests','Bandwidth','Archive status'],series.map(r=>[r.date,r.available?nf.format(r.requests):'—',state.source==='edge'&&r.available?bytesLabel(r.bytes):'—',r.available?'Available':'Unavailable']),[1,2]);
}
function renderBreakdowns(days){
  const hosts=mergeGroups(groups(days,'hosts'),state.source==='edge'?'clientRequestHTTPHost':'requestHost');
  rank('sites-chart',hosts);$('site-count').textContent=`${hosts.length} recorded`;
  $('sites-table').innerHTML=table(['Hostname',state.source==='edge'?'Estimated requests':'Estimated page views'],hosts.map(x=>[x.name,nf.format(x.value)]),[1]);
  let countries,status,browsers;
  if(state.source==='edge'&&state.host==='all'){
    countries=mergeGroups(days.flatMap(d=>d.edge?.maps?.countryMap||[]),'clientCountryName','requests');
    status=mergeGroups(days.flatMap(d=>d.edge?.maps?.responseStatusMap||[]),'edgeResponseStatus','requests');
    browsers=mergeGroups(days.flatMap(d=>d.edge?.maps?.browserMap||[]),'uaBrowserFamily','pageViews');
  }else{
    countries=mergeGroups(groups(days,'countries'),state.source==='edge'?'clientCountryName':'countryName');
    status=state.source==='edge'?mergeGroups(groups(days,'status'),'edgeResponseStatus'):[];
    browsers=mergeGroups(groups(days,state.source==='rum'?'browsers':'devices'),state.source==='rum'?'userAgentBrowser':'clientDeviceType');
  }
  countries=countries.map(x=>({...x,name:countryLabel(x.name)}));
  rank('countries-chart',countries);$('country-count').textContent=`${countries.length} countries`;
  const mapDays=days.filter(d=>d.edge?.mapsStatus==='available').length;
  $('countries-table').innerHTML=(state.source==='edge'&&state.host==='all'?`<p class="panel-note">Country maps available for ${mapDays} of ${days.length} selected days.</p>`:'')+table(['Country',state.source==='edge'?'Requests':'Page views'],countries.map(x=>[x.name,nf.format(x.value)]),[1]);
  const statusGroups=new Map();for(const r of status){const k=+r.name>=100?`${Math.floor(+r.name/100)}xx`:'Other';statusGroups.set(k,(statusGroups.get(k)||0)+r.value);}
  const meanings={'1xx':'Informational','2xx':'Successful','3xx':'Redirected','4xx':'Client error','5xx':'Server error'};
  rank('status-chart',[...statusGroups].map(([name,value])=>({name:`${name} · ${meanings[name]||'Other'}`,value})).sort((a,b)=>b.value-a.value));
  if(state.source==='rum')$('status-chart').innerHTML=empty('HTTP status codes belong to the HTTP request source.');
  rank('browsers-chart',browsers,{limit:5});
  $('browser-title').textContent=state.source==='rum'?'Browsers':state.host==='all'?'Browser page requests':'Device types';
  $('browser-note').textContent=state.source==='edge'&&state.host==='all'?'Based on Cloudflare’s pageViews browser map. Bot browser families remain included.':'Based on available adaptive groups; unknown values are retained.';
  const series=timeSeries(days),requests=sum(series.filter(s=>s.available),'requests');
  const ratio=state.source==='edge'&&state.host==='all'?percentage(sum(days.map(d=>d.edge?.summary),'cachedRequests'),requests):null;
  $('cache-chart').innerHTML=ratio===null?empty('Zone-wide cache efficiency is available in the HTTP request overview.'):`<svg viewBox="0 0 200 200" role="img" aria-label="${ratio.toFixed(1)} percent of HTTP requests served from cache"><circle cx="100" cy="100" r="75" stroke="var(--soft)" stroke-width="19" fill="none"/><circle cx="100" cy="100" r="75" stroke="var(--chart)" stroke-width="19" stroke-linecap="round" stroke-dasharray="${ratio/100*471.24} 471.24" transform="rotate(-90 100 100)" fill="none"/><text x="100" y="101" font-size="31" font-weight="600">${ratio.toFixed(1)}%</text><text x="100" y="123" font-size="10">served from cache</text></svg>`;
  $('cache-note').textContent=ratio===null?'Select all sites in HTTP requests for the full zone view.':'Cached requests / total HTTP requests. Cache statuses are preserved in the archive.';
}
function renderCalendar(){
  const all=timeSeries(archive.days);const end=archive.days.at(-1)?.date;if(!end){$('calendar-chart').innerHTML=empty();return;}
  const start=isoDay(Date.parse(end)-364*DAY),dates=dayRange(start,end),lookup=new Map(all.map(r=>[r.date,r]));
  const max=Math.max(1,...all.filter(r=>r.available).map(r=>r.requests));const offset=(new Date(start).getUTCDay()+6)%7,cell=15,gap=4,W=1100;
  let labels='',lastMonth='';const squares=dates.map((date,i)=>{const d=new Date(date),week=Math.floor((i+offset)/7),weekday=(i+offset)%7,x=45+week*(cell+gap),y=24+weekday*(cell+gap),row=lookup.get(date);const month=d.toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'});if(month!==lastMonth){labels+=`<text x="${x}" y="11">${month}</text>`;lastMonth=month;}const intensity=row?.available?(row.requests===0?0:Math.max(1,Math.ceil(Math.sqrt(row.requests/max)*4))):-1;const fill=intensity<0?'url(#missing-hatch)':['#edf2e8','#c4dfbd','#8bbc94','#4a9570','#1b6850'][intensity];return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="${fill}"${date>=state.start&&date<=state.end?' stroke="var(--chart)" stroke-opacity=".28"':''}><title>${date}: ${row?.available?nf.format(row.requests):'Unavailable'}</title></rect>`;}).join('');
  $('calendar-chart').innerHTML=`<svg viewBox="0 0 ${W} 160" role="img" aria-label="Daily activity heatmap for the last 365 days; missing days are hatched."><defs><pattern id="missing-hatch" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="var(--bg)"/><path d="M0 5L5 0" stroke="var(--border)" stroke-width="1.5"/></pattern></defs>${labels}<text x="0" y="35">Mon</text><text x="0" y="73">Wed</text><text x="0" y="111">Fri</text>${squares}</svg>`;
}
function renderDetail(days){
  if(state.detail==='daily'){
    const rows=timeSeries(days).filter(r=>r.date.includes(state.search));
    const wide=state.source==='edge'&&state.host==='all';
    const header=['UTC date',state.source==='edge'?'Requests':'Page views',...(wide?['Bytes','Cached requests','Cached bytes','Threats','Page requests','HTTPS requests','HTTPS bytes','Daily unique IPs']:[]),'Availability'];
    $('detail-table').innerHTML=table(header,rows.map(r=>{const d=days.find(d=>d.date===r.date);return [r.date,r.available?nf.format(r.requests):'—',...(wide?['bytes','cachedRequests','cachedBytes','threats','pageViews','encryptedRequests','encryptedBytes'].map(k=>r.available?nf.format(d.edge.summary[k]):'—').concat(r.available?nf.format(d.edge.dailyUniqueIPs):'—'):[]),r.available?'Available':'Unavailable'];}),header.map((_,i)=>i).filter(i=>i>0&&i<header.length-1));
    $('detail-note').textContent='Every archived daily metric. Unique IPs are not unique people and are never added across days. HTTPS metrics and Cloudflare page requests come from the daily aggregate dataset.';$('show-more').hidden=true;return;
  }
  if(state.detail==='content'||(state.detail==='status'&&state.source==='edge'&&state.host==='all')){
    const content=state.detail==='content';const rows=state.source==='edge'&&state.host==='all'?days.flatMap(d=>d.edge?.maps?.[content?'contentTypeMap':'responseStatusMap']||[]):[];
    const dimension=content?'edgeResponseContentTypeName':'edgeResponseStatus',items=mergeGroups(rows,dimension,'requests').filter(r=>r.name.toLowerCase().includes(state.search.toLowerCase()));
    $('detail-table').innerHTML=table([content?'Content type':'HTTP status code','Requests'],items.map(r=>[r.name,nf.format(r.value)]),[1]);
    $('detail-note').textContent=`Daily aggregate maps for ${days.filter(d=>d.edge?.mapsStatus==='available').length} of ${days.length} selected days. Select all sites in the HTTP source to inspect these zone-wide maps.`;$('show-more').hidden=true;return;
  }
  const rows=groups(days,state.detail);const dimensionNames={paths:state.source==='edge'?'clientRequestPath':'requestPath',referrers:state.source==='edge'?'clientRefererHost':'refererHost',devices:state.source==='edge'?'clientDeviceType':'deviceType',cache:'cacheStatus',status:'edgeResponseStatus',operatingSystems:'userAgentOS',protocols:'clientRequestHTTPProtocol',hourly:'datetimeHour'};
  const dimension=dimensionNames[state.detail],map=new Map();
  for(const r of rows){const host=r.dimensions.clientRequestHTTPHost??r.dimensions.requestHost;const name=r.dimensions[dimension]||'(not specified)';const key=host+'\u0000'+name;const old=map.get(key)||{host,name,count:0,bytes:0};old.count+=r.count;old.bytes+=r.sum?.edgeResponseBytes||0;map.set(key,old);}
  const filtered=[...map.values()].filter(r=>(r.host+' '+r.name).toLowerCase().includes(state.search.toLowerCase())).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  const show=state.showAll?filtered:filtered.slice(0,100);
  $('detail-table').innerHTML=table(['Site',state.detail==='hourly'?'UTC hour':'Value',state.source==='edge'?'Estimated requests':'Estimated page views',...(state.source==='edge'?['Bandwidth']:[])],show.map(r=>[r.host,r.name,nf.format(r.count),...(state.source==='edge'?[bytesLabel(r.bytes)]:[])]),[2,3]);
  const key=state.source==='edge'?'details':'rum';const n=days.filter(d=>Array.isArray(d[key]?.datasets?.[state.detail])).length;
  $('detail-note').textContent=`${nf.format(filtered.length)} matching groups · ${n} of ${days.length} selected days have this breakdown. ${state.source==='rum'&&state.detail==='protocols'?'Protocols are only available for HTTP requests.':'Adaptive estimates; no top-N groups are discarded during collection. Exports include the complete selected records.'}`;
  $('show-more').hidden=state.showAll||filtered.length<=100;
}
function renderCoverage(){
  const records=archive.coverage?.records||[],hosts=[...new Set(records.map(r=>r.name))].sort();const proxied=hosts.filter(h=>records.some(r=>r.name===h&&r.proxied));const rumHosts=[...new Set(archive.days.flatMap(d=>d.rum?.datasets?.hosts||[]).map(r=>r.dimensions.requestHost))];
  $('coverage-summary').textContent=`${archive.days.filter(d=>d.edge?.status==='available').length} daily HTTP summaries archived · ${proxied.length} proxied hostnames · ${hosts.length-proxied.length} DNS-only hostnames · ${rumHosts.length} hostnames observed in Web Analytics.`;
  $('coverage-table').innerHTML=table(['Hostname','Current collection coverage'],hosts.map(host=>[host,coverageForHost(host,records,rumHosts)]));
  const last=archive.lastRun;const age=archive.days.length?(Date.now()-Date.parse(archive.days.at(-1).date+'T00:00:00Z'))/DAY:Infinity;
  $('run-health').textContent=`Latest archive: ${archive.days.at(-1)?.date||'not yet collected'} UTC. ${last?`Last collector run: ${last.status}, ${last.failures||0} failed batches.`:'Initial snapshot imported using the authenticated Cloudflare connection.'} ${archive.automation?.enabled===false?'Automatic collection is awaiting configuration. ':''}${age>3?'The archive is stale. Check the daily workflow and Cloudflare Actions secret.':'The latest snapshot is recent.'}`;
  const s=archive.settings,rows=[];
  for(const [label,value]of [['Daily HTTP summaries',s?.edge?.httpRequests1dGroups],['Detailed HTTP breakdowns',s?.edge?.httpRequestsAdaptiveGroups],['Browser page views',s?.rum]])if(value)rows.push([label,value.enabled?'Available':'Restricted',`${Math.round(value.notOlderThan/86400)} days`,`${Math.round(value.maxDuration/86400)} days`]);
  $('retention-info').innerHTML=table(['Dataset','Access','Source retention','Maximum query window'],rows)+`<p>These limits are discovered from this account rather than assumed from the plan. Archiving preserves successfully retrieved data after these source windows expire.</p>`;
}
function render(){
  const days=selectedDays(),series=timeSeries(days),available=series.filter(r=>r.available).length;
  $('selection-label').textContent=`${dateLabel(state.start)} — ${dateLabel(state.end)} · ${state.host==='all'?'All recorded sites':state.host}`;
  $('precision-label').textContent=state.source==='edge'&&state.host==='all'?'Daily aggregate · all request types':'Adaptive estimates · all returned groups';
  $('notice').hidden=available===days.length&&available>0&&archive.automation?.enabled!==false;
  $('notice').textContent=(archive.automation?.enabled===false?'Daily collection has not been activated. This page shows the initial imported snapshot. ':'')+(available!==days.length||available===0?`${available} of ${days.length} selected days are available for this source and site. Missing days are gaps, never zero. DNS-only sites have no Cloudflare edge request count.`:'');
  $('chart-series-label').textContent=state.source==='edge'?'All HTTP requests':'Browser page views';
  $('traffic-note').textContent=`${available} days of data shown. ${state.source==='edge'?'Bots, assets, API calls and errors remain included wherever visible to Cloudflare.':'Browser beacon observations are separate from HTTP requests and are never added to them.'} ${state.source==='edge'&&state.host==='all'?'Site and path breakdowns have a shorter source retention window than the daily summary.':''}`;
  document.querySelector('[data-metric="bytes"]').disabled=state.source==='rum';
  if(state.source==='rum'&&state.metric==='bytes'){state.metric='requests';document.querySelectorAll('[data-metric]').forEach(b=>{const active=b.dataset.metric==='requests';b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});}
  document.querySelector('[data-metric="requests"]').textContent=state.source==='rum'?'Page views':'Requests';
  renderMetrics(days,series);renderLine(series);renderBreakdowns(days);renderCalendar();renderDetail(days);
}
function setRange(range){
  state.end=archive.days.at(-1).date;
  state.start=range==='all'?archive.days[0].date:isoDay(Date.parse(state.end)-(Number(range)-1)*DAY);
  $('start').value=state.start;$('end').value=state.end;
  document.querySelectorAll('[data-range]').forEach(b=>{const active=b.dataset.range===String(range);b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});
}
function download(name,type,text){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function exportCsv(){const rows=timeSeries(selectedDays());const cells=[['date_utc','source','hostname','requests_or_page_views','response_bytes','availability'],...rows.map(r=>[r.date,state.source,state.host,r.available?r.requests:'',state.source==='edge'&&r.available?r.bytes:'',r.available?'available':'unavailable'])];download(`mightora-${state.source}-${state.start}-${state.end}.csv`,'text/csv;charset=utf-8','\ufeff'+cells.map(r=>r.map(csvCell).join(',')).join('\r\n'));}
async function init(){
  archive=window.MIGHTORA_DATA||await fetch('data/dashboard.json').then(r=>{if(!r.ok)throw new Error('Archive snapshot unavailable');return r.json();});
  if(!archive.days.length){$('notice').hidden=false;$('notice').textContent='No data has been archived yet. Configure the Cloudflare Actions secret, then run the Daily archive workflow.';return;}
  const end=archive.days.at(-1).date;$('latest-date').textContent=dateLabel(end);const age=Math.floor((Date.now()-Date.parse(end))/DAY);$('freshness').textContent=`Complete UTC day · built ${dateLabel(archive.generatedAt.slice(0,10))}${age>2?' · snapshot is stale':''}`;
  const hosts=[...new Set([...archive.days.flatMap(d=>d.details?.datasets?.hosts||[]).map(r=>r.dimensions.clientRequestHTTPHost),...archive.days.flatMap(d=>d.rum?.datasets?.hosts||[]).map(r=>r.dimensions.requestHost),...(archive.coverage?.records||[]).map(r=>r.name)])].filter(Boolean).sort();
  $('host').innerHTML='<option value="all">All recorded sites</option>'+hosts.map(h=>`<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');
  setRange(30);render();renderCoverage();
  document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{setRange(b.dataset.range);render();}));
  $('source').addEventListener('change',()=>{state.source=$('source').value;render();});$('host').addEventListener('change',()=>{state.host=$('host').value;render();});
  $('filters').addEventListener('submit',event=>{event.preventDefault();const a=$('start').value,b=$('end').value;if(!a||!b||a>b){$('notice').hidden=false;$('notice').textContent='Choose a valid start and end date.';return;}state.start=a;state.end=b;document.querySelectorAll('[data-range]').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});render();});
  document.querySelectorAll('[data-metric]').forEach(b=>b.addEventListener('click',()=>{state.metric=b.dataset.metric;document.querySelectorAll('[data-metric]').forEach(x=>{const active=x===b;x.classList.toggle('selected',active);x.setAttribute('aria-pressed',active);});render();}));
  document.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',()=>{state.detail=b.dataset.detail;state.showAll=false;document.querySelectorAll('[data-detail]').forEach(x=>{const active=x===b;x.classList.toggle('selected',active);x.setAttribute('aria-pressed',active);});renderDetail(selectedDays());}));
  $('detail-search').addEventListener('input',()=>{state.search=$('detail-search').value;state.showAll=false;renderDetail(selectedDays());});$('show-more').addEventListener('click',()=>{state.showAll=true;renderDetail(selectedDays());});
  $('export-csv').addEventListener('click',exportCsv);$('export-json').addEventListener('click',()=>{const key=state.source==='edge'?'details':'rum';const days=selectedDays().map(d=>{const section=structuredClone(d[key]);for(const dimension of Object.keys(section.datasets||{}))section.datasets[dimension]=groups([d],dimension);return state.source==='edge'&&state.host==='all'?d:{date:d.date,source:state.source,host:state.host,[key]:section};});download(`mightora-${state.source}-${state.start}-${state.end}.json`,'application/json',JSON.stringify({schemaVersion:1,source:state.source,host:state.host,start:state.start,end:state.end,days},null,2));});
  if(window.MIGHTORA_OFFLINE){$('offline-banner').hidden=false;document.querySelectorAll('[data-online-only]').forEach(e=>e.hidden=true);}
  const updateNetwork=()=>{const entries=performance.getEntriesByType('resource');const domains=[...new Set(entries.map(x=>{try{return new URL(x.name).hostname;}catch{return '';}}))].filter(Boolean);$('network-summary').textContent=window.MIGHTORA_OFFLINE?'Offline edition: application data and branding are embedded. No application network requests are required.':`${entries.length} resource entries visible in this browser session. Domains: ${domains.join(', ')||'none recorded yet'}.`;};updateNetwork();window.addEventListener('load',updateNetwork);
}
function navigation(){
  const header=document.querySelector('mightora-header');const nav=document.querySelector('.quick-jump-nav');
  const resize=()=>{document.documentElement.style.setProperty('--header-height',header.getBoundingClientRect().height+'px');document.documentElement.style.setProperty('--nav-height',nav.getBoundingClientRect().height+'px');};
  new ResizeObserver(resize).observe(header);new ResizeObserver(resize).observe(nav);resize();
  const enhance=()=>{const button=header.querySelector('.mobile-menu-btn');const links=header.querySelector('.header-nav');if(!button||button.dataset.enhanced)return;button.dataset.enhanced='true';button.setAttribute('aria-controls','header-nav');button.setAttribute('aria-expanded','false');button.addEventListener('click',()=>{const open=links.classList.contains('open');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');});header.addEventListener('keydown',event=>{if(event.key==='Escape'){links.classList.remove('open');button.setAttribute('aria-expanded','false');button.focus();}});links.addEventListener('click',event=>{if(event.target.closest('a')){links.classList.remove('open');button.setAttribute('aria-expanded','false');}});};
  new MutationObserver(enhance).observe(header,{childList:true,subtree:true});enhance();
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){document.querySelectorAll('.quick-jump-nav a').forEach(a=>{a.classList.toggle('active',a.hash==='#'+entry.target.id);});}},{rootMargin:'-25% 0px -65% 0px'});document.querySelectorAll('main [id]').forEach(s=>{if(document.querySelector(`.quick-jump-nav a[href="#${s.id}"]`))observer.observe(s);});
}
navigation();init().catch(error=>{$('notice').hidden=false;$('notice').textContent=`Unable to load the analytics archive: ${error.message}. The source files remain available on GitHub.`;console.error(error);});
