// Activate only after a real hosted AI response succeeds. No secret keys in this script.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const story=await readFile(root+'/src/story.js','utf8');
const project=story.match(/setup\.supabase\s*=\s*\{[\s\S]*?url:\s*["']([^"']+)/)?.[1];
if(!project)throw Error('Could not find the existing Supabase URL');
const endpoint=project+'/functions/v1/pdr-warden';
const response=await fetch(endpoint,{method:'POST',headers:{Origin:process.env.PDR_TEST_ORIGIN||'http://localhost:8000','Content-Type':'application/json'},body:'{"action":"start"}',signal:AbortSignal.timeout(60000)});
if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Edge Function is not ready; local Warden preserved');
const data=await response.json();
if(!response.ok||data.aiStatus!=='ai'||data.mode!=='ai'||data.state?.party?.length!==2||!data.narration||typeof data.token!=='string')throw Error(data.error||'Live AI verification failed; local Warden preserved');
console.log('Hosted PDR/OpenAI smoke test: PASS (one opening-scene call).');
if(process.argv.includes('--check-only'))process.exit(0);
const path=root+'/src/pdr.js',source=await readFile(path,'utf8');
if(!source.includes("backend: 'local'")&&!source.includes("backend: 'edge'"))throw Error('PDR backend configuration changed; inspect before activation');
const backup=process.env.PDR_BACKUP_DIR||resolve('/tmp','pdr-edge-activation-'+Date.now());await mkdir(backup,{recursive:true});
await copyFile(path,backup+'/pdr.js');await copyFile(root+'/index.html',backup+'/index.html');
try{
  await writeFile(path,source.replace("backend: 'local'","backend: 'edge'"));
  execFileSync(root+'/tools/tweego/tweego',['-o','index.html','src'],{cwd:root,stdio:'pipe'});
}catch(error){await copyFile(backup+'/pdr.js',path);await copyFile(backup+'/index.html',root+'/index.html');throw error;}
console.log('PDR now uses the hosted Edge Warden. Castle rebuilt locally; no GitHub Pages deployment. Backup: '+backup);
