'use strict';
(() => {
  const ui=id=>document.getElementById(id);
  let enabled=false,configured=false,token='',selectedModel='',pending=null,generation=0,previousFrame=null,result=null,nextAt=0,failures=0,totalCalls=0,lastSourceTime=0,receivedAt=0;
  const capture=document.createElement('canvas');capture.width=512;capture.height=342;const cc=capture.getContext('2d');
  function state(message){ui('aiStatus').textContent=message}
  const localService=['127.0.0.1','localhost','[::1]'].includes(location.hostname)&&location.protocol!=='file:';
  function clearResult(){result=null;receivedAt=0;ui('sceneReading').textContent='Model-generated scene notes appear here when AI is connected.';ui('sceneObjects').textContent='';ui('aiMeta').textContent='No model result yet';if(!localService){ui('sceneReading').textContent='Poetry and scores respond to light and motion locally. AI scene understanding is available in the local server edition.';ui('aiMeta').textContent='Local visual analysis · No frames uploaded'}pausedDirty=true}
  function invalidate(){generation++;pending?.abort();previousFrame=null;nextAt=0;clearResult()}
  function stop(message='AI stopped · No frames are being sent'){enabled=false;invalidate();ui('aiToggle').textContent='Start AI';ui('aiToggle').setAttribute('aria-pressed','false');ui('aiOnce').disabled=true;state(message)}
  async function request(path,data,signal){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Afterimage-Token':token},body:JSON.stringify(data),signal});let json;try{json=await response.json()}catch{throw new Error('AI service unavailable. Restart the local service.')}if(!response.ok){const error=new Error(json.error||'AI request failed');error.status=response.status;throw error}return json}
  async function status(){if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname)||location.protocol==='file:'){state('Public edition · Local visual analysis is active. Vision AI requires the local server edition.');ui('sceneReading').textContent='Poetry and scores respond to light and motion locally. AI scene understanding is available in the local server edition.';ui('aiMeta').textContent='Local visual analysis · No frames uploaded';for(const id of ['aiToggle','aiOnce','aiSave','aiClear','aiInterval'])ui(id).disabled=true;ui('aiSettings').hidden=true;return}try{const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw new Error();const s=await r.json();if(s.service!=='afterimage-ai')throw new Error();token=s.token;configured=s.configured;selectedModel=s.model;ui('aiModel').value=s.model;state(configured?'Key configured · Press Start AI to send frames':'No API key · Open local connection settings');ui('aiToggle').disabled=false}catch{state('AI service unavailable. Start the local edition using its launcher.');ui('aiToggle').disabled=true}}
  function getFrame(){
    const media=mode==='image'?sourceImage:mode==='video'||mode==='camera'?video:null;
    if(!media)return null;const mw=media.videoWidth||media.naturalWidth,mh=media.videoHeight||media.naturalHeight;if(!mw||!mh||(media===video&&video.readyState<2))return null;
    const s=Math.min(1,512/Math.max(mw,mh));capture.width=Math.max(1,Math.round(mw*s));capture.height=Math.max(1,Math.round(mh*s));
    cc.drawImage(media,0,0,capture.width,capture.height);
    return {image:capture.toDataURL('image/jpeg',.72),time:mode==='video'?video.currentTime:mode==='camera'?elapsed:0};
  }
  async function analyzeOnce(manual=false){
    if(!enabled||pending||document.hidden||(!manual&&!running)||(!manual&&performance.now()<nextAt))return;
    if(mode==='demo'){state('Import footage or use your camera. The synthetic demo does not call AI.');return}
    if(mode==='image'&&result&&!manual)return;
    const frameData=getFrame();if(!frameData){state('Waiting for the footage to load…');return}
    if(previousFrame&&frameData.time<previousFrame.time)previousFrame=null;
    const controller=new AbortController(),id=generation;pending=controller;lastSourceTime=frameData.time;
    const timer=setTimeout(()=>controller.abort(),28000);ui('aiOnce').disabled=true;state('Reading the original image… Live annotations continue.');
    try{
      const packet=await request('/api/analyze',{frames:previousFrame&&mode!=='image'?[previousFrame,frameData]:[frameData]},controller.signal);
      if(id!==generation||!enabled)return;
      result=packet.scene;receivedAt=performance.now();previousFrame=frameData;failures=0;totalCalls++;
      ui('sceneReading').textContent=result.scene+' '+result.activity;
      ui('sceneObjects').textContent=[...result.objects,result.atmosphere].filter(Boolean).join(' / ');
      ui('aiMeta').textContent=`${packet.model} · Source time ${formatTime(lastSourceTime)} · ${totalCalls} readings`;
      state(mode==='image'?'Image read · Use Read a frame to try again':'AI updated · Waiting for the next sample');pausedDirty=true;
    }catch(e){if(id!==generation)return;failures++;clearResult();if(e.name==='AbortError')state('Reading timed out. Please try again.');else state(e.message);if([401,403,404,429,503].includes(e.status)||failures>=3)stop(`${e.message||'Repeated readings failed'} AI paused. Check the connection before restarting.`)}
    finally{clearTimeout(timer);if(pending===controller)pending=null;nextAt=performance.now()+Math.max(5000,Number(ui('aiInterval').value)*1000)*(failures?Math.min(4,failures+1):1);ui('aiOnce').disabled=!enabled}
  }
  window.AfterimageAI={onSourceChange:invalidate,onPause(){generation++;pending?.abort();if(enabled)state('Playback paused · Automatic readings paused')},label(i,lang){if(!enabled||!result||(mode!=='image'&&running&&performance.now()-receivedAt>Math.max(20000,Number(ui('aiInterval').value)*3000)))return null;let values;if(lang==='numeric'||lang==='roman')return null;if(lang==='poetry')values=result.poetry||[];else if(lang==='music')values=result.music||[];else if(lang==='code')values=result.code;else if(lang==='glyph')values=result.glyphs;else if(lang==='poetic')values=[...result.objects,result.activity,result.atmosphere];else {const poems=result.poetry||[],music=result.music||[];values=poems.flatMap((line,n)=>[line,music[n]||result.code[n%Math.max(1,result.code.length)]||line]);if(!values.length)values=[...result.objects,...result.code,...result.glyphs]}values=values.filter(s=>/^[\x20-\x7E]+$/.test(s));return values.length?values[i%values.length]:null}};
  ui('aiToggle').onclick=()=>{if(enabled){stop();return}if(!configured){ui('aiSettings').open=true;ui('aiKey').focus();state('Enter your API key locally before starting AI.');return}enabled=true;failures=0;nextAt=0;ui('aiToggle').textContent='Stop AI';ui('aiToggle').setAttribute('aria-pressed','true');ui('aiOnce').disabled=false;analyzeOnce(true)};
  ui('aiOnce').onclick=()=>{if(performance.now()<nextAt){state('Please wait before requesting another reading.');return}analyzeOnce(true)};
  ui('aiSave').onclick=async()=>{stop();ui('aiSave').disabled=true;const key=ui('aiKey').value.trim();ui('aiKey').value='';try{const s=await request('/api/config',{...(key?{key}:{}),model:ui('aiModel').value.trim()});configured=s.configured;selectedModel=s.model;state(configured?'Settings saved in local server memory · Press Start AI':'Enter an API key.');if(configured)ui('aiSettings').open=false}catch(e){state(e.message)}finally{ui('aiSave').disabled=false}};
  ui('aiClear').onclick=async()=>{stop();try{await request('/api/config',{clear:true});configured=false;ui('aiKey').value='';state('Session key cleared. Restarting reloads the configured local environment file.')}catch(e){state(e.message)}};
  ui('aiInterval').onchange=()=>{nextAt=performance.now()+Number(ui('aiInterval').value)*1000};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;pending?.abort()}else nextAt=performance.now()+1000});
  video.addEventListener('seeking',invalidate);
  window.addEventListener('pagehide',()=>{enabled=false;pending?.abort()});
  setInterval(()=>analyzeOnce(),700);status();
})();
