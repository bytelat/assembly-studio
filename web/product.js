// Source-bound product guide; rendering and movement use the shared generic engine.
const $=id=>document.getElementById(id);
const guide=JSON.parse($('product-guide-data').textContent), plan=guide.plan;
let viewer,ready=false,index=0,progress=0,playing=false,continuous=false,source=false,inspectNode=null;
const parts=new Map(guide.reference.parts.map(part=>[part.node_index,part]));
$('product-step').replaceChildren(...plan.steps.map((step,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${i+1} of ${plan.steps.length} — ${step.title}`;return option;}));
for(const part of parts.values()){const option=document.createElement('option');option.value=part.node_index;option.textContent=part.node_name;$('product-part').append(option);}
const inspectionStep=()=>guide.inspection_steps?.[String(index+1)];
function detailDirection(){const check=inspectionStep();return check?.view_directions?.[Math.min(check.node_ids.length-1,Math.floor(progress*check.node_ids.length))];}
function currentHardware(){const check=inspectionStep();if(check)return check.node_ids[Math.min(check.node_ids.length-1,Math.floor(progress*check.node_ids.length))];const tracks=plan.steps[index].tracks;if(!tracks.length)return null;const active=tracks.filter(track=>progress>=track.keyframes[0].fraction&&progress<track.keyframes.at(-1).fraction);return (active.length?active:[tracks.find(track=>progress<track.keyframes[0].fraction)||tracks.at(-1)])[0].node_index;}
function update(){
 const step=plan.steps[index],check=inspectionStep(),motion=step.kind==='motion'||Boolean(check),inspection=inspectNode!==null;
 const diagramOnly=!motion&&!source&&!inspection;
 const changed=$('viewer').hidden!==diagramOnly;
 $('viewer').hidden=diagramOnly;
 $('product-main-diagram').hidden=!diagramOnly;
 const focused=guide.step_diagrams?.[index]||`/assets/dalfred/manual-page-${step.source_pages[0]}.png`;
 if($('product-main-image').getAttribute('src')!==focused)$('product-main-image').src=focused;
 $('product-main-image').alt=`Original DALFRED printed step ${index+1}`;
 $('product-main-diagram').href=focused;
 if(changed)window.dispatchEvent(new Event('resize'));
 $('product-step').value=index;
 $('product-title').textContent=`${index+1}. ${step.title}`;
 $('product-instruction').textContent=check?.instruction||step.instruction;
 $('product-omissions').textContent=check?'3D bolt-check walkthrough. The assembled frame stays visible; bolt turning and tightening force are not simulated.':motion?(guide.presentation_rotations?.[String(index+1)]?'Authored joining motion in a side-on working view. Paths are illustrative; bolt turning and tightening are not demonstrated.':'Partial authored approach motion. Source orientation is retained; turning, tools and exact fitting are not demonstrated.'):'No 3D assembly animation is available for this step. The original manual diagram is shown here instead. Inspect assembled stool is a separate reference view.';
 const phase=guide.manual_phases?.[String(index+1)]?.find(phase=>progress>=phase.start&&progress<phase.end);
 const imageURL=phase?.image||focused;
 $('product-phase').textContent=phase?.label||`Original printed step ${index+1} · PDF page ${step.source_pages[0]}`;
 if($('product-image').getAttribute('src')!==imageURL)$('product-image').src=imageURL;
 $('product-image').alt=phase?.label||`Original DALFRED manual page ${step.source_pages[0]}, printed step ${index+1}`;
 $('product-diagram').href=imageURL;
 $('product-mode').textContent=inspection?'SOURCE PART INSPECTION':source?'ORIGINAL ASSEMBLED MODEL':check?'3D BOLT-CHECK WALKTHROUGH':motion?'AUTHORED PARTIAL MOTION':'ORIGINAL DIAGRAM · NO ANIMATION';
 $('product-previous').disabled=index===0;
 $('product-next').disabled=index===plan.steps.length-1;
 $('product-play').disabled=$('product-scrub').disabled=!ready||!motion||source||inspection;
 $('product-all').disabled=!ready;
 $('product-play').textContent=motion?(playing?'Ⅱ Pause':check?'▶ Play bolt checks':'▶ Play step'):'Diagram only';
 $('product-all').textContent=continuous&&playing?'Ⅱ Pause all steps':'▶ Play all 9 steps';
 $('product-all').setAttribute('aria-pressed',String(continuous&&playing));
 $('product-scrub').value=Math.round(progress*1000);
 const node=!source&&!inspection?currentHardware():null;
 $('product-detail').hidden=!check||source||inspection;
 if(check&&node!==null)$('product-detail').textContent=`CHECK ${Math.min(check.node_ids.length,Math.floor(progress*check.node_ids.length)+1)} OF ${check.node_ids.length} · ${parts.get(node).node_name}`;
 $('product-action').textContent=node!==null?`Watch source part ${parts.get(node).node_name} · original geometry, neutral inspection shading`:'';
 $('product-status').textContent=inspection?`Inspecting ${parts.get(inspectNode).node_name}. Choose “Return to assembly step” to resume.`:source?'Inspecting original assembled stool.':`Step ${index+1} of 9 · ${check?'3D bolt checks':motion?'partial motion draft':'original diagram'}${continuous?' · automatic advance; diagrams remain for 10 seconds':''}`;
}
function selectStep(value){playing=false;continuous=false;source=false;inspectNode=null;$('product-part').value='';index=value;progress=0;update();viewer?.renderScene();viewer?.frameAssembly();}
$('product-step').onchange=event=>selectStep(Number(event.target.value));
$('product-previous').onclick=()=>selectStep(Math.max(0,index-1));
$('product-next').onclick=()=>selectStep(Math.min(plan.steps.length-1,index+1));
$('product-play').onclick=()=>{continuous=false;if(progress===1)progress=0;playing=!playing;update();};
$('product-all').onclick=()=>{if(continuous&&playing){continuous=false;playing=false;}else{source=false;inspectNode=null;$('product-part').value='';if(index===8&&progress===1){index=0;progress=0;}continuous=true;playing=true;viewer?.renderScene();viewer?.frameAssembly();}update();};
$('product-source').onclick=()=>{source=!source;inspectNode=null;$('product-part').value='';playing=false;continuous=false;update();viewer?.renderScene();viewer?.frameAssembly();};
$('product-reset').onclick=()=>inspectNode!==null?viewer.focusPart(inspectNode):source?viewer.frameAssembly():viewer.frameAssembly();
$('product-scrub').oninput=event=>{playing=false;continuous=false;progress=Number(event.target.value)/1000;update();viewer?.renderScene();};
$('product-part').onchange=event=>{inspectNode=event.target.value?Number(event.target.value):null;playing=false;continuous=false;source=false;update();viewer?.renderScene();if(inspectNode!==null)viewer?.focusPart(inspectNode);else viewer?.frameAssembly();};
update();
try{
 let timer;
 let module;
 try{module=await Promise.race([import('/viewer.bundle.js?v=dalfred-1'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The 3D script download timed out. Reload to retry.')),60000);})]);}finally{clearTimeout(timer);}
 viewer=await module.createViewer($('viewer'),{model_url:'/models/dalfred.glb',model_bytes:12800892,chunk_bytes:1048576,model_size_label:'12.8 MB',reference:guide.reference,connections:[],camera:{position:[1.1,.8,1.1],target:[0,.4,0]}},()=>({stage:'review',assembled:true,plan:source?null:plan,planStep:index,progress,inspectNode,neutralParts:true,detailNode:inspectionStep()&&!source&&inspectNode===null?currentHardware():null,detailDirection:detailDirection(),presentationRotationDeg:guide.presentation_rotations?.[String(index+1)]}),message=>{$('viewer-error').textContent=message; if(!$('product-main-diagram').hidden)$('viewer-error').hidden=true;});
 ready=true;$('viewer-error').hidden=true;
 for(const id of ['product-source','product-part','product-reset'])$(id).disabled=false;
 update();viewer.frameAssembly();
 let previous=performance.now();
 document.addEventListener('visibilitychange',()=>{previous=performance.now();});
 function tick(now){const elapsed=Math.max(0,(now-previous)/1000);previous=now;if(playing){const step=plan.steps[index];progress=Math.min(1,progress+elapsed/(step.kind==='manual_reference'&&!inspectionStep()?10:step.duration_seconds));if(progress===1){if(continuous&&index<8){index++;progress=0;viewer.renderScene();viewer.frameAssembly();}else{playing=false;continuous=false;}}update();}requestAnimationFrame(tick);}
 requestAnimationFrame(tick);
}catch(error){$('viewer-error').hidden=false;$('viewer-error').textContent=error.message;fetch('/api/viewer-diagnostics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage:error.stage||'module',message:(error.message||'Loading failed').replace(/https?:\/\/\S+/g,'[URL]').slice(0,600)})}).catch(()=>{});const retry=document.createElement('button');retry.textContent='Retry loading';retry.onclick=()=>location.reload();$('viewer-error').append(document.createElement('br'),retry);}
