const $ = id => document.getElementById(id);
let assembled=false, viewerReady=false;
let demo, index = 0, progress = 0, playing = false, renderScene = () => {}, resetCamera = () => {}, draft;
let completed = new Set();
function loadProgress(){try{const saved=JSON.parse(localStorage.getItem(demo.id)||'[]');if(Array.isArray(saved))completed=new Set(saved.filter(n=>Number.isInteger(n)&&n>=0&&n<demo.steps.length));}catch{}}
function saveProgress(){try{localStorage.setItem(demo.id,JSON.stringify([...completed]));}catch{}}
function showStep(){
  playing=false; progress=0; assembled=false;
  $('inspect-model').setAttribute('aria-pressed','false');$('inspect-model').textContent='Inspect assembled model';
  const step=demo.steps[index];
  const picker=$('lack-step-picker');
  if(!picker.options.length) picker.replaceChildren(...demo.steps.map((step,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1} of ${demo.steps.length} — ${step.title}`;return option;}));
  picker.value=String(index);
  $('step-number').textContent=String(index+1).padStart(2,'0');
  $('step-total').textContent=`/ ${String(demo.steps.length).padStart(2,'0')}`;
  $('step-title').textContent=step.title; $('instruction').textContent=step.instruction;
  $('part').textContent=step.part; $('hint').textContent=step.hint;
  $('previous').disabled=index===0; $('next').disabled=index===demo.steps.length-1;
  $('complete').textContent=index===demo.steps.length-1?'Mark preview complete ✓':'Mark complete & continue ↗';
  $('step-dots').replaceChildren(...demo.steps.map((s,i)=>{const b=document.createElement('button');b.title=s.title;b.setAttribute('aria-label',`Step ${i+1}: ${s.title}`);b.className=[i===index?'current':'',completed.has(i)?'done':''].join(' ');if(i===index)b.setAttribute('aria-current','step');b.onclick=()=>{index=i;showStep();};return b;}));
  $('progress-text').textContent=`${completed.size} of ${demo.steps.length} preview stages completed`;
  updatePlayback(); renderScene(); resetCamera();
}
function updatePlayback(){ const disabled=!viewerReady||assembled||demo.steps[index].focus==='review';$('play').disabled=disabled;$('scrub').disabled=disabled||demo.steps[index].focus==='inventory'; $('scrub').value=String(Math.round(progress*1000));$('play').textContent=playing?'Ⅱ Pause':'▶ Play step';$('play-state').textContent=assembled?'Inspection mode':demo.steps[index].focus==='review'?'All four legs shown':demo.steps[index].focus==='inventory'?'Play to begin assembly':progress>=1?'Stage animation complete':playing?'Take a closer look':'Ready when you are'; }
$('lack-step-picker').onchange=event=>{index=Number(event.target.value);showStep();};
$('previous').onclick=()=>{if(index>0){index--;showStep();}};
$('next').onclick=()=>{if(index<demo.steps.length-1){index++;showStep();}};
$('play').onclick=()=>{if(demo.steps[index].focus==='inventory'){completed.add(index);saveProgress();index++;showStep();playing=true;}else{if(progress>=1)progress=0;playing=!playing;}updatePlayback();};
$('scrub').oninput=e=>{playing=false;progress=Number(e.target.value)/1000;updatePlayback();renderScene();};
$('reset').onclick=()=>resetCamera();
$('inspect-model').onclick=()=>{assembled=!assembled;playing=false;$('inspect-model').setAttribute('aria-pressed',String(assembled));$('inspect-model').textContent=assembled?'Return to preview':'Inspect assembled model';updatePlayback();renderScene();resetCamera();};
$('complete').onclick=()=>{completed.add(index);saveProgress();if(index<demo.steps.length-1)index++;showStep();};
for(const name of ['demo','manual'])$(name+'-tab').onclick=()=>{for(const item of ['demo','manual']){$(item+'-panel').hidden=item!==name;$(item+'-tab').setAttribute('aria-selected',String(item===name));}window.dispatchEvent(new Event('resize'));};
async function initViewer(){
  try {
    $('viewer-error').textContent='Loading the 3D viewer…';
    let timeout;
    let module;
    try {
      module = await Promise.race([import('/viewer.bundle.js?v=lack-bundle-1'), new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('The 3D viewer download timed out. Retry loading the page.')),20000);})]);
    } finally { clearTimeout(timeout); }
    const {createViewer} = module;
    const viewer = await createViewer($('viewer'), demo, () => ({stage:demo.steps[index].focus, corner:demo.steps[index].corner, progress, assembled}), message => {$('viewer-error').textContent=message;});
    renderScene=viewer.renderScene; resetCamera=viewer.resetCamera;
    $('focus-connection').onclick=viewer.focusConnection;
    $('viewer-error').hidden=true;
    viewerReady=true;
    updatePlayback();
    let last=performance.now();
    function tick(now){
      const dt=Math.min((now-last)/1000,.1);last=now;
      if(playing){
        progress=Math.min(1,progress+dt/4);
        if(progress===1){
          playing=false;
          if($('auto-advance').checked){
            completed.add(index);saveProgress();
            if(index<demo.steps.length-1){index++;showStep();playing=demo.steps[index].focus!=='review';}
          }
        }
        updatePlayback();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  } catch(error) {
    $('viewer-error').hidden=false;
    const message=error.message||'Unknown browser error';
    $('viewer-error').textContent=message;
    const help=document.createElement('a');help.href='/assets/lack/manual.pdf';help.target='_blank';help.rel='noopener';help.textContent='Open the original assembly manual ↗';$('viewer-error').append(document.createElement('br'),help);
    $('viewer').replaceChildren();
    const fallback=document.createElement('img');fallback.src='/assets/lack/manual-page-1.png';fallback.alt='Original assembly diagram, available while interactive 3D is unavailable';fallback.className='viewer-fallback';$('viewer').append(fallback);
    const stage=error.stage||'module';
    fetch('/api/viewer-diagnostics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage,message:message.replace(/https?:\/\/\S+/g,'[URL]').slice(0,600)})}).catch(()=>{});
    const retry=document.createElement('button');retry.type='button';retry.textContent='Retry loading';retry.onclick=()=>location.reload();$('viewer-error').append(document.createElement('br'),retry);
    $('play').disabled=true;$('scrub').disabled=true;$('inspect-model').disabled=true;$('focus-connection').disabled=true;
    console.error('Viewer initialization failed',error);
  }
}
async function getJSON(url){const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Could not load '+url);return response.json();}
try{const embedded=$('lack-demo-data');demo=embedded?JSON.parse(embedded.textContent):await getJSON('/api/demo');loadProgress();$('reference-inventory').replaceChildren(...demo.parts.map(p=>{const row=document.createElement('tr');for(const value of [p.name,p.quantity,p.identifier]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}return row;}));showStep();await initViewer();}catch(error){$('instruction').textContent='Could not load the sample: '+error.message;$('viewer-error').textContent='The sample data could not load. Refresh to retry.';}
try{const h=await getJSON('/api/health');$('api-status').textContent=h.deepseek_configured?`DeepSeek configured · ${h.model}`:'API key not configured. Add DEEPSEEK_API_KEY to the server’s .env file, then restart.';}catch{$('api-status').textContent='Could not reach the Python backend.';}
function el(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
$('upload-form').onsubmit=async e=>{e.preventDefault();const file=$('manual-file').files[0];if(!file)return;if(file.size>12*1024*1024){$('upload-status').textContent='Choose a PDF smaller than 12 MB.';return;}$('analyze').disabled=true;$('analysis-results').hidden=true;$('upload-status').textContent='Reading pages and requesting a DeepSeek draft. This may take up to two minutes…';const data=new FormData();data.append('file',file);try{const response=await fetch('/api/analyze',{method:'POST',body:data});const body=await response.json();if(!response.ok)throw new Error(typeof body.detail==='string'?body.detail:'Could not analyze this manual.');draft=body;const a=body.analysis;$('result-name').textContent=a.product_name;$('parts-body').replaceChildren(...a.parts.map(p=>{const tr=document.createElement('tr');for(const text of [`${p.name} (${p.id})`,p.quantity,p.source_page,p.uncertainty||'—'])tr.append(el('td',text));return tr;}));$('uncertainties').replaceChildren();if(a.uncertainties.length)$('uncertainties').append(el('p','Needs review:\n'+a.uncertainties.join('\n'),'warning'));$('result-steps').replaceChildren(...a.steps.map(s=>{const d=document.createElement('article');d.className='result-step';d.append(el('strong',`Step ${s.number}`),el('p',s.instruction),el('small',`Manual page ${s.source_page} · Parts: ${s.part_ids.join(', ')}`));if(s.warnings.length)d.append(el('p','Warnings: '+s.warnings.join(' · '),'warning'));if(s.uncertainties.length)d.append(el('p','Needs review: '+s.uncertainties.join(' · '),'warning'));return d;}));$('analysis-results').hidden=false;$('upload-status').textContent=`Draft ready · ${body.page_count} pages inspected. No tutorial published.`;}catch(error){$('upload-status').textContent=error.message;}finally{$('analyze').disabled=false;}};
$('download').onclick=()=>{if(!draft)return;const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='unreviewed-assembly-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
