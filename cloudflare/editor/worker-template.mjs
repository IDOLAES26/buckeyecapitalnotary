// Private Buckeye Studio. Never put tokens, home addresses, or API keys in this file.
const EDITOR_HTML = __EDITOR_HTML__;
const REPO='IDOLAES26/buckeyecapitalnotary';
let certCache=null;
function bytes(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
function payload(value){return JSON.parse(new TextDecoder().decode(bytes(value)));}
function encode(value){const data=new TextEncoder().encode(value);let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(binary);}
function decode(value){return new TextDecoder().decode(bytes(value.replace(/\s/g,'')));}
async function identity(request,env){
 if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD||!env.EDITOR_EMAIL)throw Object.assign(Error('Private editor setup is incomplete. Configure Cloudflare Access, ACCESS_TEAM_DOMAIN, ACCESS_AUD, and EDITOR_EMAIL.'),{status:503});
 const domain=env.ACCESS_TEAM_DOMAIN.replace(/^https:\/\//,'').replace(/\/$/,'');
 if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain))throw Object.assign(Error('Invalid Access team domain configuration.'),{status:503});
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!token||token.length>20000)throw Object.assign(Error('Sign in through Cloudflare Access to open this private editor.'),{status:401});
 try{
  const parts=token.split('.');if(parts.length!==3)throw Error();const header=payload(parts[0]),claims=payload(parts[1]);
  const now=Date.now()/1000;if(header.alg!=='RS256'||claims.iss!=='https://'+domain||!Array.isArray(claims.aud)||!claims.aud.includes(env.ACCESS_AUD)||!Number.isFinite(claims.exp)||claims.exp<=now||claims.nbf&&claims.nbf>now+30||!claims.sub||typeof claims.email!=='string'||claims.email.toLowerCase()!==env.EDITOR_EMAIL.trim().toLowerCase())throw Error();
  if(!certCache||certCache.domain!==domain||certCache.expires<Date.now()||!certCache.keys.some(k=>k.kid===header.kid)){
   const response=await fetch('https://'+domain+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const json=await response.json();certCache={domain,keys:json.keys||[],expires:Date.now()+300000};
  }
  const jwk=certCache.keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw Error();
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error();
  return {email:claims.email,sub:claims.sub};
 }catch{throw Object.assign(Error('Your editor login is missing, expired, or not authorized.'),{status:401});}
}
async function github(env,method='GET',data){
 const response=await fetch('https://api.github.com/repos/'+REPO+'/contents/index.html',{method,headers:{'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Buckeye-Studio',...(env.GITHUB_TOKEN?{Authorization:'Bearer '+env.GITHUB_TOKEN}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(20000)});
 if(response.status===409||response.status===422)throw Object.assign(Error('The live file changed. Export your project and reload the latest source before publishing.'),{status:409});
 if(!response.ok)throw Object.assign(Error('GitHub could not complete the request. Check the editor token permissions and try again.'),{status:502});return response.json();
}
async function readJSON(request){if(!request.headers.get('Content-Type')?.includes('application/json'))throw Object.assign(Error('JSON is required.'),{status:415});if(Number(request.headers.get('Content-Length')||0)>6000000)throw Object.assign(Error('Project exceeds the 6 MB limit. Use smaller images.'),{status:413});const text=await request.text();if(text.length>6000000)throw Object.assign(Error('Project exceeds the 6 MB limit.'),{status:413});try{return JSON.parse(text);}catch{throw Object.assign(Error('Invalid JSON.'),{status:400});}}
function scripts(html){return [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(m=>m[0]);}
function protectedForm(html){const form=html.match(/<form\b[^>]*id=["']inquiry["'][\s\S]*?<\/form>/i)?.[0];if(!form)return null;const action=form.match(/\baction=["']([^"']*)/i)?.[1];const fields=[...form.matchAll(/<(?:input|select|textarea)\b[^>]*\bname=["']([^"']*)/gi)].map(m=>m[1]).sort();return JSON.stringify({action,fields});}
export function validatePublishedHTML(html,original){
 if(typeof html!=='string'||html.length<1000||html.length>5000000)throw Object.assign(Error('Exported page is invalid or too large.'),{status:400});
 if(JSON.stringify(scripts(html))!==JSON.stringify(scripts(original)))throw Object.assign(Error('Publishing stopped: the website scripts changed. Export for a code review instead.'),{status:400});
 if(!protectedForm(original)||protectedForm(html)!==protectedForm(original))throw Object.assign(Error('Publishing stopped: the appointment form connection or fields changed.'),{status:400});
 const required=['inquiry','service','document-type','find-meetings','meeting-results','selected-place-id','meeting-location','fee-estimator','calculate-fees','fee-result','wizard-progress','wizard-next','wizard-back'];
 for(const id of required){const token=new RegExp('\\bid=["\']'+id+'["\']','g');if((html.match(token)||[]).length!==1)throw Object.assign(Error('Publishing stopped: a required element is missing or duplicated: '+id),{status:400});}
 return true;
}
export default {async fetch(request,env){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json'}});
 try{
  const user=await identity(request,env),url=new URL(request.url),path=url.pathname;
  if(request.method==='GET'&&path==='/')return new Response(EDITOR_HTML,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
  if(request.method!=='GET'&&(request.headers.get('Origin')!==url.origin||request.headers.get('X-Buckeye-Editor')!=='1'))return json({error:'Cross-site editor requests are not permitted.'},403);
  if(path==='/api/source'&&request.method==='GET'){const source=await github(env);return json({source:decode(source.content),sha:source.sha,email:user.email,publishEnabled:env.ENABLE_PUBLISH==='true'&&!!env.GITHUB_TOKEN});}
  if(path==='/api/drafts'&&request.method==='GET'){
   if(!env.EDITOR_DRAFTS)return json({error:'Add the EDITOR_DRAFTS Workers KV binding to save private drafts.'},503);
   const list=await env.EDITOR_DRAFTS.list({prefix:'draft/',limit:1000});return json({drafts:list.keys.map(k=>k.metadata).filter(Boolean).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)),truncated:!list.list_complete});
  }
  if(path==='/api/drafts'&&request.method==='POST'){
   if(!env.EDITOR_DRAFTS)return json({error:'Draft storage is not configured.'},503);const {project}=await readJSON(request);
   if(project?.schema!==1||typeof project.source!=='string'||!project.styles||!project.text)return json({error:'Invalid editor project.'},400);
   const id=crypto.randomUUID(),savedAt=new Date().toISOString();await env.EDITOR_DRAFTS.put('draft/'+id,JSON.stringify({project,savedAt,owner:user.email}),{metadata:{id,savedAt}});return json({id,savedAt});
  }
  if(path.startsWith('/api/drafts/')&&request.method==='GET'){
   if(!env.EDITOR_DRAFTS)return json({error:'Draft storage is not configured.'},503);const id=path.slice('/api/drafts/'.length);if(!/^[a-f0-9-]{36}$/.test(id))return json({error:'Invalid draft.'},400);const data=await env.EDITOR_DRAFTS.get('draft/'+id,'json');if(!data)return json({error:'Draft not found.'},404);if(data.owner.toLowerCase()!==user.email.toLowerCase())return json({error:'Draft not authorized.'},403);return json(data);
  }
  if(path==='/api/publish'&&request.method==='POST'){
   if(env.ENABLE_PUBLISH!=='true'||!env.GITHUB_TOKEN)return json({error:'Publishing is disabled. Export HTML for review, or connect a repository-scoped token and enable publishing.'},403);
   const body=await readJSON(request);if(body.confirmed!==true||typeof body.sourceSha!=='string')return json({error:'Explicit publish confirmation and source version are required.'},400);
   const current=await github(env);if(current.sha!==body.sourceSha)return json({error:'The live source has changed since this draft started. Export your project for review before updating to the latest source.'},409);
   validatePublishedHTML(body.html,decode(current.content));
   const result=await github(env,'PUT',{message:'Publish reviewed Buckeye Studio website edits',content:encode(body.html),sha:current.sha,branch:'main'});
   return json({sha:result.content.sha,commit:result.commit.sha});
  }
  return json({error:'Not found.'},404);
 }catch(error){return json({error:error.status?error.message:'The editor could not complete this request. Please retry.'},error.status||500);}
}};
