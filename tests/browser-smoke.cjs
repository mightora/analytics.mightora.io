// CI browser QA. Managed interactive sessions use the Sites preview and CUA browser.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
(async()=>{
  const browser=await chromium.launch({headless:true});
  const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'});
  try{
    for(let i=0;i<30;i++){try{await fetch('http://127.0.0.1:8765');break;}catch{await new Promise(r=>setTimeout(r,100));}}
    const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8765/');await page.locator('.metric-value').first().waitFor();
    await page.getByRole('button',{name:'1 year',exact:true}).click();
    assert.ok((await page.locator('#traffic-table tbody tr').count())>=300,'Annual archive should show a full retained year');
    await page.getByLabel('Data source').selectOption('rum');
    await page.getByLabel('Data source').selectOption('edge');
    await page.getByRole('button',{name:'30 days',exact:true}).click();
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();
    const download=await downloadPromise;const csv=await fs.readFile(await download.path(),'utf8');assert.match(csv,/date_utc/);
    await page.setViewportSize({width:390,height:844});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);assert.equal(overflow,false,'Mobile page should not overflow horizontally');
    await page.getByRole('button',{name:'Open navigation menu',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Close navigation menu',exact:true}).getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Escape');
    await page.getByRole('link',{name:'Archive & coverage',exact:true}).click();
    assert.equal(await page.locator('mightora-header').evaluate(el=>getComputedStyle(el).position),'sticky');
    const offline=await browser.newPage({viewport:{width:1440,height:1000}});const network=[];offline.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});offline.on('pageerror',e=>errors.push(e.message));
    await offline.goto(pathToFileURL(path.resolve('downloads/mightora-analytics-offline.html')).href);await offline.locator('.metric-value').first().waitFor();
    await offline.getByRole('button',{name:'7 days',exact:true}).click();await offline.getByRole('button',{name:'1 year',exact:true}).click();
    assert.equal(await offline.locator('#offline-banner').isVisible(),true);assert.deepEqual(network,[],'Offline file must make no application network requests');
    assert.deepEqual(errors,[],'No JavaScript errors');console.log('Browser QA passed: desktop, mobile, navigation, filters, CSV, file-URL offline and zero offline network requests.');
  }finally{server.kill();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
