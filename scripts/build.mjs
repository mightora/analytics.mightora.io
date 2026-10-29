import {readFile,writeFile,readdir,mkdir,cp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {dayRange} from '../src/stats.mjs';
import {emptyDay} from './collect.mjs';
import {atomicJson,readJson,exists} from './cloudflare.mjs';
import {zip} from './zip.mjs';
const config=await readJson('config.json');
const read=path=>readFile(path,'utf8');
const sha=data=>createHash('sha256').update(data).digest('hex');
async function files(root){const out=[];for(const e of await readdir(root,{withFileTypes:true})){const p=join(root,e.name);if(e.isDirectory())out.push(...await files(p));else if(e.name.endsWith('.json'))out.push(p);}return out;}
const daily=await exists('data/daily')?await files('data/daily'):[];
const byDate=new Map();for(const path of daily){const d=await readJson(path);byDate.set(d.date,d);}
// Preserve every prior year; never delete old data as the one-year backfill window moves.
const dates=[...byDate.keys()].sort();const start=dates[0],end=dates.at(-1);
const days=start?dayRange(start,end).map(d=>byDate.get(d)||emptyDay(d)):[];
const settings=await exists('data/source-settings.json')?await readJson('data/source-settings.json'):null;
const coverage=await exists('data/coverage.json')?await readJson('data/coverage.json'):null;
const lastRun=await exists('data/last-run.json')?await readJson('data/last-run.json'):null;
const automation=await exists('data/automation.json')?await readJson('data/automation.json'):null;
const dashboard={schemaVersion:1,generatedAt:new Date().toISOString(),name:config.name,timezone:'UTC',settings,coverage,lastRun,automation,days:days.map(d=>({...d,edge:{...d.edge,raw:undefined}}))};
await atomicJson('data/dashboard.json',dashboard);
const entries=[];for(const path of daily.sort()){const data=await readFile(path);const d=JSON.parse(data);entries.push({date:d.date,path,sha256:sha(data),bytes:data.length,edge:d.edge.status,details:d.details.status,rum:d.rum.status});}
await atomicJson('data/index.json',{schemaVersion:1,generatedAt:dashboard.generatedAt,start,end,timezone:'UTC',files:entries});
await mkdir('downloads',{recursive:true});
const stats=(await read('src/stats.mjs')).replace(/^export /gm,'');
const app=`(function(){\n'use strict';\n${stats}\n${await read('src/app.js')}\n})();\n`;
await writeFile('assets/app.js',app);await writeFile('assets/styles.css',await read('src/styles.css'));
const template=await read('src/index.html');
let online=template.replace('<!-- ONLINE_STYLES -->','<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/shared.css"><link rel="stylesheet" href="assets/styles.css">')
  .replace('<!-- ONLINE_SCRIPTS -->','<script defer src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.1/dist/js-yaml.min.js"></script><script defer src="https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/components.js"></script>')
  .replace('<!-- APP_DATA -->','').replace('<!-- APP_SCRIPT -->','<script defer src="assets/app.js"></script>');
await writeFile('index.html',online);
const jsonText=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const imageMap={
 'assets/mightora-logo.png':'https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/mightoraIoLogo4-200x900.png',
 'assets/ian-tweedie.png':'https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/ian-tweedie-sq2.png',
 'assets/techtweedie.png':'https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/main-logo.png',
 'assets/ian-presenting.png':'https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/ian-tweedie-presenting-4.png',
 'assets/techtweedie-bw.png':'https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/TechTweedie_bw.png',
 'assets/tweed-technology.png':'https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/tweedTechnologyLogoLight.png'
};
const replacements=[];for(const [path,url]of Object.entries(imageMap)){const encoded='data:image/png;base64,'+(await readFile(path)).toString('base64');replacements.push([path,encoded],[url,encoded]);}
const localise=value=>{for(const [from,to]of replacements)value=value.split(from).join(to);return value;};
const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
let offline=template.replace('<meta charset="utf-8">',`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">`)
 .replace(/<link rel="icon"[^>]+>/,'')
 .replace('<!-- ONLINE_STYLES -->',`<style>${localise(await read('assets/shared.css'))}\n${await read('src/styles.css')}</style>`)
 .replace(/<script id="footer-yaml-workaround">[\s\S]*?<\/script>/,`<script>window.MIGHTORA_OFFLINE=true;const offlineFooter=${jsonText(localise(await read('footer.yaml')))};window.fetch=async function(input){if(String(input).includes('footer.yaml'))return new Response(offlineFooter,{headers:{'content-type':'text/yaml'}});if(String(input)==='data/config.json')return new Response('{}',{headers:{'content-type':'application/json'}});throw new Error('Offline edition: network disabled');};</script>`)
 .replace('<!-- ONLINE_SCRIPTS -->',`<script>${await read('assets/js-yaml.min.js')}</script><script>${localise(await read('assets/components.js'))}</script>`)
 .replace('<!-- APP_DATA -->',`<script>window.MIGHTORA_DATA=${jsonText(dashboard)};</script>`)
 .replace('<!-- APP_SCRIPT -->',`<script>${app.replace(/<\/script/gi,'<\\/script')}</script>`);
offline=localise(offline);await writeFile('downloads/mightora-analytics-offline.html',offline);
const readme=`Mightora Analytics — Offline Edition\n\nOpen index.html in any modern browser by double-clicking it.\nNo installation, server, Internet connection or API credentials required.\nSnapshot: ${dashboard.generatedAt}\nData dates use UTC. Data already unavailable from Cloudflare is not recreated.\nThis file contains the same charts, filters and complete dashboard data as the online build.\nExternal links only navigate when you choose to follow them.\nSource and updates: ${config.repository}\n\nKeep a separate clone of the repository for an independent backup of the daily JSON files.\n`;
const archiveZip=zip({'index.html':offline,'README.txt':readme,'LICENSE':await read('LICENSE')});
await writeFile('downloads/mightora-analytics-offline.zip',archiveZip);
await atomicJson('downloads/manifest.json',{generatedAt:dashboard.generatedAt,htmlSha256:sha(offline),zipSha256:sha(archiveZip),dataSha256:sha(JSON.stringify(dashboard))});
await writeFile('.nojekyll','');
await writeFile('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${config.url}/sitemap.xml\n`);
await writeFile('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${config.url}/</loc><lastmod>${dashboard.generatedAt.slice(0,10)}</lastmod></url></urlset>`);
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const path of ['index.html','CNAME','.nojekyll','robots.txt','sitemap.xml','footer.yaml','assets','downloads','data','LICENSE'])await cp(path,join('dist',path),{recursive:true});
console.log(`Built ${entries.length} archived days; offline HTML ${(Buffer.byteLength(offline)/1024/1024).toFixed(1)} MB; ZIP ${(archiveZip.length/1024/1024).toFixed(1)} MB.`);
