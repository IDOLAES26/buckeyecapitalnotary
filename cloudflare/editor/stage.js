let viewportWidth=1200,viewportHeight=900,stageScale=1;
function viewForWidth(w){return w<=350?'small':w<=700?'mobile':w<=1024?'tablet':'desktop';}
function applyStage(){
 const area=$('stage-scroll'),box=$('stage-footprint'),canvas=$('canvas');
 const chosen=$('stage-zoom').value;
 stageScale=chosen==='fit'?Math.max(.1,Math.min(1,(area.clientWidth-48)/viewportWidth,(area.clientHeight-48)/viewportHeight)):Number(chosen);
 canvas.style.width=viewportWidth+'px';canvas.style.height=viewportHeight+'px';canvas.style.transform='scale('+stageScale+')';
 box.style.width=viewportWidth*stageScale+'px';box.style.height=viewportHeight*stageScale+'px';
 $('viewport-width').value=viewportWidth;$('viewport-height').value=viewportHeight;
 $('zoom-readout').textContent=Math.round(stageScale*100)+'%';
 $('canvas-caption').textContent=screen()[0].toUpperCase()+screen().slice(1)+' · '+viewportWidth+' × '+viewportHeight+' CSS px';
 const match=[...$('device-preset').options].find(o=>o.value===viewportWidth+','+viewportHeight);$('device-preset').value=match?.value||'custom';
}
function setViewport(w,h){
 viewportWidth=Math.max(320,Math.min(2560,Math.round(Number(w)||1200)));viewportHeight=Math.max(240,Math.min(2160,Math.round(Number(h)||900)));
 const next=viewForWidth(viewportWidth),changed=next!==screen();$('screen').value=next;
 if(changed)render(true);else applyStage();
 if(selectedId&&!changed)select(selectedId,false);
}
$('viewport-width').onchange=()=>setViewport($('viewport-width').value,viewportHeight);
$('viewport-height').onchange=()=>setViewport(viewportWidth,$('viewport-height').value);
$('device-preset').onchange=()=>{if($('device-preset').value!=='custom')setViewport(...$('device-preset').value.split(',').map(Number));};
$('rotate-viewport').onclick=()=>setViewport(viewportHeight,viewportWidth);
$('stage-zoom').onchange=applyStage;
new ResizeObserver(()=>applyStage()).observe($('stage-scroll'));
for(const handle of document.querySelectorAll('.stage-handle')){
 let drag=null;
 handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();drag={x:e.clientX,y:e.clientY,w:viewportWidth,h:viewportHeight,scale:stageScale};handle.setPointerCapture(e.pointerId);$('stage-footprint').classList.add('resizing');};
 handle.onpointermove=e=>{if(!drag)return;const axis=handle.dataset.axis;setViewport(axis==='y'?drag.w:drag.w+(e.clientX-drag.x)/drag.scale,axis==='x'?drag.h:drag.h+(e.clientY-drag.y)/drag.scale);};
 const end=()=>{drag=null;$('stage-footprint').classList.remove('resizing');};handle.onpointerup=end;handle.onpointercancel=end;handle.onlostpointercapture=end;
 handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey?10:1;setViewport(viewportWidth+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),viewportHeight+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));};
}
