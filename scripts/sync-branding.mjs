import {mkdir,writeFile,readFile} from 'node:fs/promises';
await mkdir('assets',{recursive:true});
const sources={
  'assets/shared.css':'https://raw.githubusercontent.com/mightora/shared-ui/main/shared.css',
  'assets/components.js':'https://raw.githubusercontent.com/mightora/shared-ui/main/components.js',
  'footer.yaml':'https://raw.githubusercontent.com/mightora/shared-ui/main/footer.yaml',
  'assets/js-yaml.min.js':'https://cdn.jsdelivr.net/npm/js-yaml@4.1.1/dist/js-yaml.min.js',
  'assets/mightora-logo.png':'https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/mightoraIoLogo4-200x900.png',
  'assets/ian-tweedie.png':'https://raw.githubusercontent.com/mightora/shared-ui/main/ian-tweedie-sq2.png',
  'assets/techtweedie.png':'https://raw.githubusercontent.com/mightora/shared-ui/main/main-logo.png',
  'assets/ian-presenting.png':'https://raw.githubusercontent.com/mightora/shared-ui/main/ian-tweedie-presenting-4.png',
  'assets/techtweedie-bw.png':'https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/TechTweedie_bw.png',
  'assets/tweed-technology.png':'https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/tweedTechnologyLogoLight.png'
};
for(const [path,url]of Object.entries(sources)){
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    await writeFile(path,new Uint8Array(await response.arrayBuffer()));
    console.log(`Updated ${path}`);
  }catch(error){
    try{await readFile(path);console.warn(`Using retained ${path}: ${error.message}`);}catch{throw new Error(`Required branding asset ${path} is unavailable: ${error.message}`);}
  }
}
