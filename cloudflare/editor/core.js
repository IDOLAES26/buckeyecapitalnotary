(function(root){
'use strict';
const SCREENS={desktop:'(min-width:1025px)',tablet:'(min-width:701px) and (max-width:1024px)',mobile:'(min-width:351px) and (max-width:700px)',small:'(max-width:350px)'};
const PROTECTED='input,select,textarea,form,script,style,[id],.wizard-page,.form-grid';
function elements(doc){return [...doc.body.querySelectorAll('*')].filter(el=>!el.closest('script,style,noscript')&&!['BR','OPTION'].includes(el.tagName));}
function tag(doc){const used=new Set(elements(doc).map(el=>el.getAttribute('data-bcn-id')).filter(Boolean));let i=0;elements(doc).filter(el=>!el.hasAttribute('data-bcn-copy')).forEach(el=>{if(el.hasAttribute('data-bcn-id'))return;while(used.has('e'+i))i++;el.setAttribute('data-bcn-id','e'+i);used.add('e'+i++);});return doc;}
function find(doc,id){return [...doc.querySelectorAll('[data-bcn-id]')].find(el=>el.getAttribute('data-bcn-id')===id);}
function selectionRoots(doc,ids){const els=[...ids].map(id=>find(doc,id)).filter(Boolean);return els.filter(el=>!els.some(other=>other!==el&&other.contains(el)));}
function textEditable(el){return !!el&&!el.matches('input,textarea,select,form,svg,img,video,iframe')&&![...el.children].some(c=>!['BR','EM','STRONG','SMALL','SPAN','B','I','U'].includes(c.tagName))&&!el.querySelector('input,select,textarea,button,a,[id]');}
function safeURL(value,image=false){if(value==='')return true;try{if(value.startsWith('#'))return !image;const u=new URL(value);return image?u.protocol==='https:'||/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value):['https:','http:','mailto:','tel:'].includes(u.protocol);}catch{return false;}}
function setText(el,text){el.replaceChildren();String(text).split('\n').forEach((line,i)=>{if(i)el.append(el.ownerDocument.createElement('br'));el.append(el.ownerDocument.createTextNode(line));});}
function newProject(source,sourceSha=''){return {schema:1,source,sourceSha,text:{all:{},desktop:{},tablet:{},mobile:{},small:{}},styles:{all:{},desktop:{},tablet:{},mobile:{},small:{}},attrs:{},added:[],moves:[]};}
const allowedStyles=new Set(['font-size','font-family','font-weight','line-height','letter-spacing','text-align','color','background-color','border-width','border-style','border-color','border-radius','padding','margin','width','height','min-height','max-width','display','translate','gap','box-shadow','opacity','object-fit','justify-content','align-items','grid-template-columns']);
function normalizeStyle(key,value){const text=String(value).trim();return ['font-size','letter-spacing','width','height','min-height','max-width','gap','border-width','border-radius','padding','margin'].includes(key)&&/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)?text+'px':text;}
function cssValue(value){return String(value).length<300&&!/[{}<>;]|url\s*\(|expression\s*\(|@import/i.test(value);}
function styleRule(id,values){if(!/^[ea][a-zA-Z0-9_-]+$/.test(id))return '';const declarations=Object.entries(values).filter(([k,v])=>allowedStyles.has(k)&&cssValue(v)).map(([k,v])=>k+':'+normalizeStyle(k,v)+'!important').join(';');return declarations?'[data-bcn-id="'+id+'"]{'+declarations+'}':'';}
function css(project){return Object.entries(project.styles).map(([screen,items])=>{const rules=Object.entries(items).map(([id,v])=>styleRule(id,v)).join('');return screen==='all'?rules:SCREENS[screen]?'@media '+SCREENS[screen]+'{'+rules+'}':'';}).join('\n');}
function structure(doc,project){
 for(const a of project.added){if(!/^a[a-zA-Z0-9_-]+$/.test(a.id)||find(doc,a.id))continue;const parent=find(doc,a.parent);if(!parent)continue;const el=doc.createElement(['p','h2','h3','a','img','hr','div'].includes(a.tag)?a.tag:'p');el.setAttribute('data-bcn-id',a.id);if(a.tag==='img'){if(safeURL(a.src,true))el.setAttribute('src',a.src);el.setAttribute('alt',a.alt||'');}else {setText(el,a.text||'');if(a.tag==='a'){el.className='button';el.setAttribute('href',safeURL(a.href||'#')?a.href||'#':'#');}}const sibling=find(doc,a.after);if(sibling&&sibling.parentElement===parent)sibling.after(el);else parent.append(el);}
 for(const m of project.moves){const el=find(doc,m.id),target=find(doc,m.target);if(el&&target&&el!==target&&!el.contains(target)){if(m.where==='before')target.before(el);else target.after(el);}}
 for(const [id,attrs] of Object.entries(project.attrs)){const el=find(doc,id);if(!el)continue;for(const [key,value] of Object.entries(attrs)){if(key==='href'&&el.tagName==='A'&&safeURL(value))el.setAttribute(key,value);if(key==='src'&&el.tagName==='IMG'&&safeURL(value,true))el.setAttribute(key,value);if(['alt','title','aria-label'].includes(key))el.setAttribute(key,value);}}
}
function applyText(doc,project,screen,exporting){
 const ids=new Set(Object.values(project.text).flatMap(x=>Object.keys(x)));
 for(const id of ids){const el=find(doc,id);if(!el||!textEditable(el))continue;const inherited=key=>{const copy=[...el.children].find(c=>c.getAttribute('data-bcn-copy')===key);return copy?copy.innerText??copy.textContent:el.innerText??el.textContent;};const base=project.text.all[id]??inherited(screen);
  if(!exporting){setText(el,project.text[screen]?.[id]??base);continue;}
  const variants=Object.entries(SCREENS).map(([key])=>[key,project.text[key]?.[id]??project.text.all[id]??inherited(key)]);
  if(variants.every(([,v])=>v===base)){setText(el,base);continue;}
  el.replaceChildren();for(const [key,value]of variants){const span=doc.createElement('span');span.setAttribute('data-bcn-copy',key);setText(span,value);el.append(span);}
 }
}
function documentFor(project,screen,exporting=false){
 const doc=new DOMParser().parseFromString(project.source,'text/html');tag(doc);structure(doc,project);applyText(doc,project,screen,exporting);
 const style=doc.createElement('style');style.id='bcn-editor-design';style.textContent=css(project)+(exporting?'[data-bcn-copy]{display:none}'+Object.entries(SCREENS).map(([key,range])=>'@media '+range+'{[data-bcn-copy="'+key+'"]{display:inline}}').join(''):'');doc.querySelectorAll('#bcn-editor-design').forEach(old=>old.removeAttribute('id'));doc.head.append(style);if(!exporting){doc.querySelectorAll('[data-bcn-copy]').forEach(span=>{const parent=span.parentElement;if(!parent)return;const copy=[...parent.children].find(c=>c.getAttribute('data-bcn-copy')===screen);if(copy)setText(parent,copy.innerText??copy.textContent);});}
 return doc;
}
function exportHTML(project){return '<!doctype html>\n'+documentFor(project,'desktop',true).documentElement.outerHTML;}
root.BuckeyeEditorCore={SCREENS,PROTECTED,newProject,tag,find,textEditable,safeURL,setText,css,documentFor,exportHTML,styleRule,normalizeStyle,selectionRoots};
})(globalThis);
