'use strict';
const $=id=>document.getElementById(id), canvas=$('art'), ctx=canvas.getContext('2d',{alpha:true}), video=$('video');
const sample=document.createElement('canvas'), sc=sample.getContext('2d',{willReadFrequently:true});sample.width=192;sample.height=128;
const trailCanvas=document.createElement('canvas'), tc=trailCanvas.getContext('2d',{alpha:false});
let W=1200,H=810,mode='demo',viewMode='original',palette='amber',running=true,frame=0,elapsed=0,last=0,previous=new Float32Array(192*128),targets=[],sourceImage=null,mediaURL=null,stream=null,recorder=null,recordStream=null,recordChunks=[],recordStart=0,toastTimer,sourceToken=0,frameCount=0,fpsLast=0,pausedDirty=false;
let metrics={brightness:0,motion:0,cx:.5,cy:.5},lastAnalysis=0;
const rand=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200)}
function size(){if(recorder?.state==='recording')return;const r=$('stage').getBoundingClientRect();const scale=Math.min(devicePixelRatio||1,1.5);W=Math.max(1,Math.round(r.width*scale));H=Math.max(1,Math.round(r.height*scale));canvas.width=trailCanvas.width=W;canvas.height=trailCanvas.height=H;tc.fillStyle='#020302';tc.fillRect(0,0,W,H);pausedDirty=true}new ResizeObserver(size).observe($('stage'));
function sourceMedia(){return mode==='image'?sourceImage:mode==='video'||mode==='camera'?video:null}
function contentRect(media=sourceMedia()){
  const mw=media?.videoWidth||media?.naturalWidth,mh=media?.videoHeight||media?.naturalHeight;
  if(!mw||!mh)return {x:0,y:0,w:1,h:1};
  const s=Math.min(W/mw,H/mh),w=mw*s/W,h=mh*s/H;
  return {x:(1-w)/2,y:(1-h)/2,w,h};
}
function sampleSource(media){const r=contentRect(media);sc.fillStyle='#000';sc.fillRect(0,0,192,128);sc.drawImage(media,r.x*192,r.y*128,r.w*192,r.h*128)}
function original(){ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);const media=sourceMedia();if(media){const r=contentRect(media);ctx.drawImage(media,r.x*W,r.y*H,r.w*W,r.h*H)}else ctx.drawImage(sample,0,0,W,H)}
function demo(t){const w=sample.width,h=sample.height;sc.fillStyle='#000';sc.fillRect(0,0,w,h);sc.globalCompositeOperation='lighter';for(let k=0;k<6;k++){sc.beginPath();for(let i=0;i<=100;i++){const u=i/100;const x=w*(.14+k*.145)+Math.sin(u*7+t*.48+k*1.1)*(12+16*Math.sin(t*.17+k)) + Math.sin(u*17-t*.4+k)*3;const y=u*h; i?sc.lineTo(x,y):sc.moveTo(x,y)}sc.strokeStyle=`rgba(${190+k*9},${66+k*14},13,0.52)`;sc.lineWidth=7+Math.sin(t*.3+k)*4;sc.shadowColor='#f58d16';sc.shadowBlur=15;sc.stroke();sc.lineWidth=1.4;sc.strokeStyle="rgba(255,186,55,0.55)";sc.stroke()}sc.shadowBlur=0;sc.globalCompositeOperation='source-over'}
function readFrame(t){if(mode==='demo')demo(t);else if(mode==='image'&&sourceImage)sampleSource(sourceImage);else if(video.readyState>=2)sampleSource(video);else return null;return sc.getImageData(0,0,192,128).data}
function analyze(data){let sum=0,motion=0,sx=0,sy=0;const cells=Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),energy:0,change:0,sx:0,sy:0}));for(let y=1;y<127;y+=2){for(let x=1;x<191;x+=2){const n=y*192+x,p=n*4,b=(data[p]*.299+data[p+1]*.587+data[p+2]*.114)/255,d=Math.abs(b-previous[n]);previous[n]=b;sum+=b;motion+=d;sx+=x*b;sy+=y*b;const edge=Math.abs(b-(data[p-8]*.299+data[p-7]*.587+data[p-6]*.114)/255);const cell=cells[Math.floor(y/16)*12+Math.floor(x/16)];const weight=b*.4+edge*2+d*1.8;cell.energy+=weight;cell.sx+=x*weight;cell.sy+=y*weight;cell.change+=d;}}
metrics={brightness:sum/(95*63),motion:motion/(95*63),cx:sum?sx/sum/192:.5,cy:sum?sy/sum/128:.5};const bounds=contentRect();const best=cells.sort((a,b)=>b.energy-a.energy).slice(0,22).filter(c=>c.energy>1.1);targets=best.map((c,i)=>{const old=targets.find(o=>o.id===c.y*12+c.x);const tx=Math.max(bounds.x,Math.min(bounds.x+bounds.w,c.sx/c.energy/192)),ty=Math.max(bounds.y,Math.min(bounds.y+bounds.h,c.sy/c.energy/128));return {id:c.y*12+c.x,x:old?old.x*.5+tx*.5:tx,y:old?old.y*.5+ty*.5:ty,w:.016+rand(c.y*19+c.x)*.085,h:.03+rand(c.x*7+c.y)*.18,energy:c.energy/64,change:c.change/64}});}
function particleColor(b,p,data){if(palette==='silver')return `rgba(222,224,210,${Math.min(.85,b*1.3)})`;if(palette==='source')return `rgba(${data[p]},${data[p+1]},${data[p+2]},${Math.min(.9,b*1.6)})`;return `rgba(${Math.floor(170+85*b)},${Math.floor(55+165*b)},${Math.floor(12+62*b)},${Math.min(.86,.15+b*1.25)})`}
function particles(data,t){const fade=1-(+$('trail').value/100)*.94;tc.fillStyle=`rgba(1,2,1,${fade})`;tc.fillRect(0,0,W,H);const dens=+$('density').value/100,gain=+$('gain').value/100;const step=dens>.7?1:2;tc.globalCompositeOperation='lighter';for(let y=1;y<127;y+=step){for(let x=1;x<191;x+=step){const n=y*192+x,p=n*4,b=(data[p]*.299+data[p+1]*.587+data[p+2]*.114)/255;const edge=Math.abs(data[p]-data[p-4])/255;const strength=Math.min(1,(b*.8+edge*.9)*gain);if(strength<.045||rand(n+Math.floor(frame/3)*.13)>dens*.45+strength*.5)continue;const j=rand(n*3+frame*.031),j2=rand(n*7+frame*.027);const px=(x+(j-.5)*1.7)/192*W,py=(y+(j2-.5)*1.5)/128*H;tc.fillStyle=particleColor(strength,p,data);const s=.55+strength*.75;tc.fillRect(px,py,s,s);if(strength>.28){tc.fillRect(px+(j-.5)*W*.006,py+(j2-.5)*H*.013,.65,.65)}}}tc.globalCompositeOperation='source-over';ctx.drawImage(trailCanvas,0,0)}
const glyphs=['LUX / LUMEN','aether :: x','TRACE / VITA','NOVA / eta','VOID_SIGNAL','MEMORIA / lux','0101 / OMEGA','VESTIGIUM'];
// Original fragments: visual metaphors, not quotations or object recognition.
function poetry(o,t){
  const verse=Math.floor(t),pick=(o.id+verse)%6;
  const lines=o.change>.02?
    ['the moment slips its frame','a trace becomes a river','time loosens its edges','the light forgets to stay','a margin full of motion','each passing leaves a line']:
    o.energy>.18?
    ['light writes in the margin','a small sun keeps the hour','the dark has left a door','an ember learns to linger','a page held to the light','gold gathers into silence']:
    ['the quiet between chapters','night folds another page','a pause without an ending','the hush beneath the image','a trace too soft to name','time rests in the margin'];
  return lines[pick];
}
function score(o,i,t){
  const notes=['C','D','E','G','A'],step=Math.min(4,Math.floor(o.energy*14)),octave=o.y<.5?'5':'4';
  const note=notes[step]+octave,third=notes[(step+2)%5]+octave,beat=Math.floor(t),bpm=60+Math.round(Math.min(1,metrics.motion*24)*18)*4;
  const dynamics=o.energy>.24?'f':o.energy>.12?'mp':'pp';
  const bars=o.change>.02?['x x . x','x . x x']:['x . . .','x . x .'];
  return [note+' '+third+' | '+dynamics,(bpm>96?'allegro':bpm>72?'andante':'adagio')+' / '+bpm+' bpm','4/4 | '+bars[beat%2],o.change>.02?'crescendo / '+note:'sustain / '+note,'I - vi - IV - V','rest / 1:'+((beat%4)+1)][i%6];
}
function label(o,i,t){
  t*=Number($('refreshRate')?.value)||2;
  i+=Math.floor(t);
  const b=o.energy,m=o.change,id=o.id,lang=$('language').value;
  const semantic=window.AfterimageAI?.label(i,lang);if(semantic&&/^[\x20-\x7E]+$/.test(semantic))return semantic;
  const forms={
    poetry:()=>poetry(o,t),
    music:()=>score(o,i+o.id,t),
    numeric:()=> (b*9).toFixed(7),
    code:()=>['motion['+id+']='+m.toFixed(3),'vec2('+o.x.toFixed(2)+','+o.y.toFixed(2)+')','if(light>'+b.toFixed(2)+')','trace::'+id.toString(16).padStart(4,'0')][i%4],
    glyph:()=>glyphs[(id+Math.floor(t))%glyphs.length],
    poetic:()=>[b>.18?'LIGHT ACCUMULATES':'LOW LUMINANCE',m>.02?'MOTION TRACE':'STILL FIELD',o.x<.5?'LEFT REGION':'RIGHT REGION','LUMA / '+b.toFixed(3)][i%4],
    roman:()=>['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][id%12]+' / '+(b*9).toFixed(4)
  };
  if(lang==='mixed')return [forms.poetry,forms.music,forms.poetry,forms.code,forms.music,forms.roman][i%6]();
  return (forms[lang]||forms.glyph)();
}
function overlays(t,ctx=canvas.getContext('2d')){
  const scale=Math.max(.85,W/1100),isOriginal=viewMode==='original',r=contentRect();
  ctx.save();ctx.beginPath();ctx.rect(r.x*W,r.y*H,r.w*W,r.h*H);ctx.clip();
  function stroke(kind){ctx.strokeStyle=$(kind+'Color').value;ctx.lineWidth=Number($(kind+'Width').value)*scale;const style=$(kind+'Style').value;ctx.setLineDash(style==='dashed'?[6*scale,4*scale]:style==='dotted'?[scale,4*scale]:[]);ctx.lineCap=style==='dotted'?'round':'butt'}
  if($('lines').checked){stroke('line');ctx.beginPath();for(let i=0;i<targets.length;i++){const a=targets[i],b=targets[(i+7)%targets.length];if(!b)continue;ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H)}ctx.stroke()}
  const placed=[];
  targets.forEach((o,i)=>{
    const x=o.x*W,y=o.y*H,w=o.w*W,h=o.h*H;
    if($('boxes').checked){
      stroke('box');
      if($('boxStyle').value==='corners'){
        const d=Math.min(w,h)*.25;ctx.beginPath();
        for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const bx=x+sx*w/2,by=y+sy*h/2;ctx.moveTo(bx-sx*d,by);ctx.lineTo(bx,by);ctx.lineTo(bx,by-sy*d)}ctx.stroke();
      }else ctx.strokeRect(x-w/2,y-h/2,w,h);
    }
    if($('text').checked){
      const font=Number($('textSize').value)*scale,pad=4*scale;
      const style=$('textStyle').value;ctx.font=(style==='italic'?'italic ':'')+$('textWeight').value+' '+font+'px '+(style==='serif'?'Georgia,serif':'Consolas,monospace');
      let s=label(o,i,t);const maxWidth=Math.max(20,r.w*W-2*pad-8);
      while(ctx.measureText(s).width>maxWidth&&s.length>1)s=Array.from(s).slice(0,-2).join('')+'…';
      const tw=ctx.measureText(s).width,bw=tw+pad*2,bh=font+pad*2;
      const lx=Math.max(r.x*W+2,Math.min((r.x+r.w)*W-bw-2,x-w/2)),ly=Math.max(r.y*H+2,Math.min((r.y+r.h)*H-bh-2,y+h/2+3*scale));
      if(isOriginal&&placed.some(p=>lx<p.x+p.w+4&&lx+bw+4>p.x&&ly<p.y+p.h+3&&ly+bh+3>p.y))return;
      placed.push({x:lx,y:ly,w:bw,h:bh});
      
      ctx.fillStyle=$('textColor').value;ctx.textBaseline='top';ctx.fillText(s,lx+pad,ly+pad);
    }
  });ctx.restore();
}
function updateReadout(t){const m=metrics,side=m.cx<.43?'left':m.cx>.57?'right':'center',light=m.brightness>.3?'Bright':m.brightness>.12?'Soft light':'Low light',movement=m.motion>.025?'active motion':m.motion>.007?'slow movement':'nearly still';$('reading').textContent=`${light} · Light centered ${side} · ${movement}`;$('frameLabel').textContent=`FRAME ${String(frame).padStart(6,'0')} / ${targets.length} REGIONS`;$('modeLabel').textContent=`${viewMode==='original'?'ORIGINAL':palette.toUpperCase()} · ${mode==='demo'?'SYNTHETIC STUDY':'LIVE OVERLAY'}`;if(mode==='video'&&Number.isFinite(video.duration)){$('time').textContent=`${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;$('seek').value=video.currentTime/video.duration*100}else $('time').textContent=`${formatTime(t)} / ${mode==='image'?'STILL':'LIVE'}`;if(recorder?.state==='recording')$('recordHint').textContent=`Recording ${formatTime((performance.now()-recordStart)/1000)} · Stop to download`}
function tick(now){requestAnimationFrame(tick);if(document.hidden){last=now;return}const dt=Math.min((now-last)/1000,.1);if(now-last<1000/31&&!pausedDirty)return;last=now;if(!running&&!pausedDirty)return;if(running)elapsed+=dt;const data=readFrame(elapsed);if(!data)return;frame++;if(frame%4===0||!targets.length)analyze(data);if($('hideSource').checked)ctx.clearRect(0,0,W,H);else if(viewMode==='original')original();else particles(data,elapsed);overlays(elapsed);pausedDirty=false;frameCount++;if(now-fpsLast>1000){$('stats').textContent=`${Math.round(frameCount*1000/(now-fpsLast))} FPS / ${W} × ${H}`;fpsLast=now;frameCount=0}if(now-lastAnalysis>600){updateReadout(elapsed);lastAnalysis=now}}
function formatTime(v){return `${Math.floor(v/60).toString().padStart(2,'0')}:${Math.floor(v%60).toString().padStart(2,'0')}`}
function setRunning(v){running=v;if(!v)window.AfterimageAI?.onPause();$('play').setAttribute('aria-label',v?'Pause':'Play');$('play').innerHTML=v?'<svg class="icon" viewBox="0 0 20 20"><path d="M7 4v12M13 4v12"/></svg>':'<svg class="icon" viewBox="0 0 20 20"><path d="m6 3 10 7-10 7z"/></svg>';if(mode==='video'||mode==='camera'){if(v)video.play().catch(()=>toast('Press Play to start your footage'));else video.pause()}}
function clearSource(){window.AfterimageAI?.onSourceChange();if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;video.removeAttribute('src');video.load();if(mediaURL)URL.revokeObjectURL(mediaURL);mediaURL=null;sourceImage=null;$('seek').disabled=true;$('audio').disabled=true;$('camera').textContent='Use camera';previous.fill(0);targets=[];tc.fillStyle='#000';tc.fillRect(0,0,W,H)}
function resetDemo(){sourceToken++;clearSource();mode='demo';$('sourceInfo').textContent='Source: synthetic motion study';$('stageLabel').textContent='AFTERIMAGE / SYNTHETIC STUDY';setRunning(true)}
async function loadFile(file){if(!file)return;if(!file.type.startsWith('video/')&&!file.type.startsWith('image/')){toast('Choose a video or image file');return}const token=++sourceToken;clearSource();mediaURL=URL.createObjectURL(file);$('sourceInfo').textContent='Loading: '+file.name;try{if(file.type.startsWith('image/')){const im=new Image();im.src=mediaURL;await im.decode();if(token!==sourceToken)return;sourceImage=im;mode='image'}else{mode='video';video.src=mediaURL;await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(new Error('decode'))});if(token!==sourceToken)return;$('seek').disabled=false;$('audio').disabled=false;await video.play()}$('sourceInfo').textContent='Source: '+file.name;$('stageLabel').textContent='AFTERIMAGE / LOCAL '+(mode==='image'?'IMAGE':'VIDEO');setRunning(true);toast('Footage loaded. Live annotations are running.')}catch(e){if(token!==sourceToken)return;resetDemo();toast('Could not decode this file. Try MP4, WebM, JPG or PNG.')}}
$('import').onclick=()=>$('file').click();$('file').onchange=e=>{loadFile(e.target.files[0]);e.target.value=''};document.addEventListener('dragover',e=>{e.preventDefault();$('stage').classList.add('dragging')});document.addEventListener('dragleave',e=>{if(!e.relatedTarget)$('stage').classList.remove('dragging')});document.addEventListener('drop',e=>{e.preventDefault();$('stage').classList.remove('dragging');loadFile(e.dataTransfer.files[0])});$('demo').onclick=resetDemo;
$('camera').onclick=async()=>{if(mode==='camera'){resetDemo();return}if(!navigator.mediaDevices?.getUserMedia){toast('Camera access requires HTTPS or localhost.');return}const token=++sourceToken;$('camera').disabled=true;$('camera').textContent='Waiting for access…';try{const incoming=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});if(token!==sourceToken){incoming.getTracks().forEach(t=>t.stop());return}clearSource();stream=incoming;video.srcObject=stream;mode='camera';await video.play();$('sourceInfo').textContent='Source: live camera';$('stageLabel').textContent='AFTERIMAGE / CAMERA';$('camera').textContent='Stop camera';setRunning(true)}catch(e){toast(e.name==='NotAllowedError'?'Camera permission was declined. You can still import footage.':'Camera unavailable. Check your device or import a video.');$('camera').textContent='Use camera'}finally{$('camera').disabled=false}};
$('play').onclick=()=>setRunning(!running);document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON','SUMMARY','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();setRunning(!running)}});$('seek').oninput=()=>{if(Number.isFinite(video.duration))video.currentTime=+$('seek').value/100*video.duration};video.addEventListener('seeked',()=>{tc.fillStyle='#000';tc.fillRect(0,0,W,H);pausedDirty=true});$('audio').onclick=()=>{video.muted=!video.muted;$('audio').style.color=video.muted?'':'var(--accent)';$('audio').setAttribute('aria-label',video.muted?'Unmute original audio':'Mute original audio');toast(video.muted?'Original audio muted':'Original audio on')};
for(const name of ['density','trail','gain'])$(name).oninput=()=>{$(name+'Out').textContent=name==='gain'?(+$(name).value/100).toFixed(1)+'×':$(name).value;pausedDirty=true};for(const id of ['boxes','lines','text','language'])$(id).onchange=()=>pausedDirty=true;document.querySelectorAll('[data-palette]').forEach(b=>b.onclick=()=>{palette=b.dataset.palette;document.querySelectorAll('[data-palette]').forEach(e=>e.setAttribute('aria-pressed',String(e===b)));tc.fillStyle='#000';tc.fillRect(0,0,W,H);pausedDirty=true});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{viewMode=b.dataset.view;document.querySelectorAll('[data-view]').forEach(e=>e.setAttribute('aria-pressed',String(e===b)));$('particleControls').disabled=viewMode==='original';tc.fillStyle='#000';tc.fillRect(0,0,W,H);pausedDirty=true;updateReadout(elapsed)});
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen()}catch{toast('Fullscreen is unavailable in this browser.')}};
function download(blob,ext){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`afterimage-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
$('snapshot').onclick=()=>canvas.toBlob(b=>{if(b){download(b,'png');toast('Image saved')}else toast('Image export failed. Please try again.')},'image/png');
$('record').onclick=()=>{if(recorder?.state==='recording'){recorder.stop();return}if(!window.MediaRecorder||!canvas.captureStream){toast('Recording is unavailable. Try a recent Chrome or Edge browser.');return}try{const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));recordStream=canvas.captureStream(30);recorder=new MediaRecorder(recordStream,mime?{mimeType:mime}:undefined);recordChunks=[];recorder.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data)};recorder.onstop=()=>{const type=recorder.mimeType;download(new Blob(recordChunks,{type}),type.includes('mp4')?'mp4':'webm');recordStream.getTracks().forEach(t=>t.stop());$('record').textContent='Record canvas';$('record').classList.remove('recording');$('recordHint').textContent='Just the artwork. No interface, watermark or audio.';size();toast('Recording exported')};recorder.onerror=()=>toast('Recording failed. Stop and try again.');recorder.start(1000);recordStart=performance.now();setRunning(true);$('record').textContent='Stop recording';$('record').classList.add('recording');toast('Recording started. Press Stop to download.')}catch(e){recordStream?.getTracks().forEach(t=>t.stop());toast('Could not start recording. Please try another browser.')}};
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());recordStream?.getTracks().forEach(t=>t.stop());if(mediaURL)URL.revokeObjectURL(mediaURL)});size();requestAnimationFrame(tick);

for(const id of ['refreshRate','textColor','textSize','textWeight','textStyle','lineColor','lineWidth','lineStyle','boxColor','boxWidth','boxStyle']){
  $(id).addEventListener('input',()=>{const out=$(id+'Out');if(out)out.textContent=$(id).value;pausedDirty=true});
}

function transparentFrame(){
  const output=document.createElement('canvas');output.width=W;output.height=H;
  const outputContext=output.getContext('2d',{alpha:true});
  overlays(elapsed,outputContext);
  return output;
}
$('hideSource').onchange=()=>{
  $('stage').classList.toggle('transparent-preview',$('hideSource').checked);
  pausedDirty=true;
};
$('transparentPng').onclick=()=>{
  if(!targets.length||!['boxes','lines','text'].some(id=>$(id).checked)){
    toast('Enable frames, lines or text and load a visible source before exporting.');return;
  }
  transparentFrame().toBlob(blob=>{
    if(blob){download(blob,'png');toast('Transparent PNG saved · Overlays only')}
    else toast('Image export failed. Please try again.');
  },'image/png');
};
