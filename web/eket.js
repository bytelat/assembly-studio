window.eketEntryStarted = true;
const $ = id => document.getElementById(id);
let viewer, viewerReady = false, proposal = null, activePlan = null;
let progress = 0, stepIndex = 0, playing = false, playAll = false, inspectNode = null;
const inspectionParts = new Map();
let hardwareStep = null, hardwareTracks = [], hardwareFocus = [], detailNode = null, preferredHardwareNode = null;
const trackStart = track => track.keyframes?.[0]?.fraction ?? track.start_fraction ?? 0;
const trackEnd = track => track.keyframes?.at(-1)?.fraction ?? track.end_fraction ?? 1;
function updateHardwarePlayback() {
  const step = activePlan?.steps[stepIndex];
  const tracks = step?.tracks.filter(track => inspectionParts.get(track.node_index)?.part.category === 'hardware') || [];
  $('hardware-playback').hidden = !tracks.length || inspectNode !== null;
  detailNode = null; $('hardware-detail-label').hidden = true;
  if (!tracks.length || inspectNode !== null) return;
  const label = track => {
    const {family, instance, part} = inspectionParts.get(track.node_index);
    return family ? `${family.display_name || 'Part'} ${family.part_number} · ${instance} of ${family.source_quantity}` : part.node_name;
  };
  if (hardwareStep !== step) {
    hardwareStep = step; hardwareTracks = tracks; preferredHardwareNode = null;
    $('hardware-action-list').replaceChildren(...tracks.map(track => {
      const button = text('button', label(track));
      button.type = 'button'; button.dataset.node = String(track.node_index);
      button.onclick = () => {
        preferredHardwareNode = track.node_index;
        playing = false; playAll = false; progress = trackStart(track); updatePlayback();
        viewer?.renderScene(); viewer?.focusPlanStep([track.node_index]);
      };
      return button;
    }));
  }
  let current = tracks.filter(track => progress >= trackStart(track) && progress < trackEnd(track));
  if (!current.length) current = [tracks.find(track => trackStart(track) > progress) || tracks.at(-1)];
  // Show each simultaneous fitting in turn without altering its actual motion.
  current = [current.find(track => track.node_index === preferredHardwareNode) || current[Math.min(current.length - 1, Math.floor(progress * current.length))]];
  hardwareFocus = current.map(track => track.node_index);
  const cue = proposal.playback_cues?.[String(step.printed_step || stepIndex + 1)]?.find(cue => progress >= cue.start && progress < cue.end);
  const done = progress >= Math.max(...tracks.map(trackEnd));
  if (!cue && $('hardware-live-closeup').checked) {
    detailNode = current[0].node_index;
    $('hardware-detail-label').textContent = `LIVE CLOSE-UP · ${label(current[0])}`;
    $('hardware-detail-label').hidden = false;
  }
  $('hardware-action-title').textContent = cue ? cue.title : `${done ? 'Motion finished' : 'Watch'}: ${current.map(label).join(' + ')}`;
  $('hardware-action-detail').textContent = cue ? cue.detail : [...new Set(current.map(track => inspectionParts.get(track.node_index).family?.playback_instruction || step.instruction))].join(' ');
  $('hardware-closeup').disabled = !viewerReady || Boolean(cue);
  $('hardware-wide').disabled = !viewerReady;
  for (const button of $('hardware-action-list').children) {
    const track = hardwareTracks.find(track => track.node_index === Number(button.dataset.node));
    const active = !cue && hardwareFocus.includes(track.node_index);
    button.setAttribute('aria-current', active ? 'true' : 'false');
    button.classList.toggle('is-complete', progress >= trackEnd(track));
    button.disabled = !viewerReady;
  }
}

async function requestJSON(url, options = {}) {
  const get = !options.method || options.method === 'GET';
  const attempts = get ? 2 : 1; // Never automatically retry a paid generation POST.
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const address = new URL(url, location.href);
    if (get) address.searchParams.set('_request', `${Date.now()}-${attempt}`);
    try {
      const response = await fetch(address, { ...options, cache: 'no-store', signal: AbortSignal.timeout(get ? 15000 : 135000) });
      const raw = await response.text();
      if (!raw.trim()) throw new Error(`Empty response from ${address.pathname}`);
      let body;
      try { body = JSON.parse(raw); }
      catch { throw new Error(`Incomplete or invalid JSON from ${address.pathname}`); }
      if (!response.ok) {
        const error = new Error(typeof body.detail === 'string' ? body.detail : 'The plan did not pass validation. Check its structure and source references.');
        error.responseReceived = true;
        throw error;
      }
      return body;
    } catch (error) {
      lastError = ['TimeoutError', 'AbortError'].includes(error.name) ? new Error(`Timed out reading ${address.pathname}. The remote tunnel did not finish responding.`) : error;
      if (!get || error.responseReceived || attempt === attempts - 1) throw lastError;
      if (address.pathname.endsWith('/reference.json')) $('viewer-error').textContent = 'Retrying the EKET parts metadata request…';
    }
  }
  throw lastError;
}
const post = (url, data) => requestJSON(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const text = (tag, value) => { const item = document.createElement(tag); item.textContent = value; return item; };

function updatePlayback() {
  updateHardwarePlayback();
  const ready = activePlan !== null;
  const motion = ready && activePlan.steps[stepIndex].kind !== 'manual_reference';
  const inspectionLabel = inspectionParts.get(inspectNode)?.family?.part_number || inspectionParts.get(inspectNode)?.part.node_name || '';
  $('viewer-mode').textContent = inspectNode !== null ? `SOURCE PART INSPECTION · ${inspectionLabel} · NOT AN ASSEMBLY STEP` : ready ? proposal.origin === 'hand_authored_test_fixture' ? 'FIXTURE PLAYBACK' : motion ? 'UNREVIEWED DRAFT MOTION' : 'ORIGINAL MANUAL · DIAGRAM ONLY' : 'ORIGINAL 3D MODEL';
  $('active-step-panel').hidden = !ready;
  $('viewer-playback').hidden = !ready;
  $('source-model-summary').hidden = ready;
  $('plan-play').disabled = $('plan-scrub').disabled = !ready || !motion || !viewerReady || inspectNode !== null;
  $('plan-previous').disabled = inspectNode !== null || !ready || stepIndex === 0;
  $('plan-next').disabled = inspectNode !== null || !ready || stepIndex === activePlan.steps.length - 1;
  $('start-all-steps').disabled = !viewerReady;
  $('plan-play-all').disabled = !ready || !viewerReady || inspectNode !== null || activePlan.steps.length < 2;
  $('plan-play-all').textContent = playAll && playing ? 'Ⅱ Pause all steps' : '▶ Play all steps';
  $('plan-play-all').setAttribute('aria-pressed', String(playAll && playing));
  $('plan-play-all').classList.toggle('is-active', playAll && playing);
  $('sequence-status').hidden = !playAll;
  if (playAll) $('sequence-status').textContent = `Playing step ${stepIndex + 1} of ${activePlan.steps.length} · ${motion ? 'motion draft' : 'diagram only — read the original page for 10 seconds; no animation'} · advances automatically`;
  $('plan-play').classList.toggle('is-active', playing);
  $('plan-play').setAttribute('aria-pressed', String(playing));
  $('preview-plan').classList.toggle('is-loaded', ready);
  $('plan-play').textContent = ready && !motion ? 'Diagram only' : playing ? 'Ⅱ Pause' : '▶ Play';
  $('plan-scrub').value = String(Math.round(progress * 1000));
  if (ready) $('player-status').textContent = `${proposal.origin === 'hand_authored_test_fixture' ? 'HAND-AUTHORED FIXTURE' : 'UNREVIEWED DRAFT'} · Step ${stepIndex + 1} of ${activePlan.steps.length}: ${activePlan.steps[stepIndex].title}${!motion ? ' · original diagram; no animation' : ''}${progress === 1 ? ' · playback finished' : ''}`;
}
function describeStep() {
  const step = proposal.plan.steps[stepIndex];
  $('draft-title').textContent = $('active-step-title').textContent = step.title;
  $('active-plan-origin').textContent = $('draft-origin').textContent;
  $('active-step-instruction').textContent = step.instruction;
  const diagramOnly = step.kind === 'manual_reference';
  $('active-step-source').textContent = `Manual ${proposal.plan.source_document}, PDF page ${step.source_pages.join(', ')} · ${diagramOnly ? 'Original diagram · no animation' : 'Unverified animation draft'}`;
  $('guide-step-picker').value = String(stepIndex);
  const sourceURL = `/assets/eket/manual-page-${step.source_pages[0]}.png`;
  $('active-manual-link').href = sourceURL;
  $('active-manual-image').src = sourceURL;
  $('active-manual-image').alt = `Original manual PDF page ${step.source_pages[0]}, printed step ${step.printed_step || stepIndex + 1}`;
  $('active-step-notices').replaceChildren(...step.warnings.map(warning => text('li', warning)));
  const omitted = proposal.coverage?.unanimated_operations?.[String(step.printed_step || stepIndex + 1)];
  if (omitted) $('active-step-notices').prepend(text('li', `Not animated: ${omitted}`));
  if (!diagramOnly) $('active-step-notices').append(text('li', 'Panel mapping and motion remain unverified. Compare this draft with the original diagram.'));
  $('generation-page').value = String(step.source_pages[0]);
  $('generation-action').value = String(step.printed_step || stepIndex + 1);
  $('generation-page').dispatchEvent(new Event('change'));
  $('draft-instruction').textContent = step.instruction;
  $('draft-source').textContent = `Manual ${proposal.plan.source_document} · PDF pages ${step.source_pages.join(', ')} · ${step.tracks.length} part track(s)${step.assembly_keyframes?.length ? ' · whole-assembly rotation/translation' : ''}`;
  $('draft-warnings').replaceChildren(...step.warnings.map(warning => text('li', `Warning: ${warning}`)));
  $('draft-uncertainties').replaceChildren(...step.uncertainties.map(item => text('li', `Uncertainty: ${item}`)));
  for (const issue of proposal.geometry_review?.issues || []) $('draft-uncertainties').prepend(text('li', `GEOMETRY FLAG: ${issue}`));
  for (const issue of proposal.separate_review?.reasons || proposal.separate_review?.review?.issues || []) $('draft-uncertainties').prepend(text('li', `SAVED REVIEW: ${issue}`));
}
function showProposal(result) {
  clearLoadedButtons();
  stopInspection(false);
  playing = false; playAll = false; activePlan = null; proposal = result; progress = 0; stepIndex = 0;
  $('draft-details').hidden = true;
  $('plan-json').value = '';
  $('player-status').textContent = 'Viewing the original model. Nothing new has been played.';
  updatePlayback(); viewer?.renderScene();
  if (!result.plan) { $('generation-status').textContent = `No animation proposed: ${result.reason}`; return; }
  const rejected = result.separate_review?.decision === 'not_accepted';
  const origin = result.origin === 'deepseek' ? `AI-GENERATED DRAFT · ${result.model} · ${rejected ? 'REVIEW REJECTED — inspect only' : result.review_status === 'geometry_flagged' ? 'GEOMETRY FLAGGED — not accepted' : 'unreviewed'}` : result.origin === 'hand_authored_test_fixture' ? 'HAND-AUTHORED PLAYER FIXTURE · not AI-generated · not verified assembly guidance' : result.origin === 'composed_manual_guide' ? 'COMPLETE MANUAL NAVIGATOR · animation drafts remain unverified' : result.origin === 'composed_draft' ? 'COMPOSED UNREVIEWED DRAFT · source actions remain unverified' : 'IMPORTED JSON · authorship and prior edits not independently verified';
  $('draft-origin').textContent = origin;
  $('draft-edits').textContent = result.human_edits.length ? `Human input: ${result.human_edits.join(' ')}` : 'No human edits have been applied by this application. Structural checks do not establish physical accuracy.';
  if (result.embedded_provenance) $('draft-edits').textContent += ` ${result.embedded_provenance}`;
  if (result.input_evidence) $('draft-edits').textContent += ' Generation used separately recorded assistant-reviewed part-mapping evidence; see the downloaded input_evidence.';
  $('draft-validation').textContent = result.validation + (result.reason ? ` Provider rationale: ${result.reason}` : '');
  $('plan-json').value = JSON.stringify(result.plan, null, 2);
  $('preview-plan').disabled = false;
  $('preview-plan').textContent = rejected || result.review_status === 'geometry_flagged' ? 'Inspect rejected proposal (not guidance)' : 'Preview this unreviewed plan';
  $('draft-details').hidden = false;
  $('guide-step-picker').replaceChildren(...result.plan.steps.map((step, index) => {
    const option = text('option', `${step.printed_step || index + 1}. ${step.title}${step.kind === 'manual_reference' ? ' (diagram)' : ' (motion draft)'}`);
    option.value = String(index); return option;
  }));
  describeStep();
  $('generation-page').value = String(result.plan.steps[0].source_pages[0]);
  $('generation-page').dispatchEvent(new Event('change'));
  $('generation-status').textContent = `${origin}. Review the source page and uncertainties, then choose Preview to load it.`;
}
function preview() {
  if (!proposal?.plan) return;
  stopInspection(false);
  activePlan = proposal.plan; progress = 0; stepIndex = 0; playing = false; playAll = false;
  describeStep(); updatePlayback(); viewer?.renderScene(); viewer?.focusPlanStep();
  $('viewer').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
const draftLoadButtons = ['load-fixture', 'load-saved-sequence', 'load-saved-plan', 'load-full-guide', 'load-v2-fixture'].map($);
const draftLoadLabels = new Map(draftLoadButtons.map(button => [button, button.textContent]));
function clearLoadedButtons() {
  for (const button of draftLoadButtons) {
    button.classList.remove('is-loaded');
    button.textContent = draftLoadLabels.get(button);
  }
}
async function loadDraft(button, url) {
  clearLoadedButtons();
  for (const item of draftLoadButtons) item.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = 'Loading…';
  if (button.id === 'load-full-guide') $('guide-load-status').textContent = 'Opening the manual steps…';
  $('generation-status').textContent = 'Loading the saved draft. No generation API call is being made…';
  try {
    const embedded = button.id === 'load-full-guide' ? $('saved-guide-data') : button.id === 'load-saved-sequence' ? $('saved-sequence-data') : null;
    const bundledDraft = embedded ? JSON.parse(embedded.textContent) : null;
    const result = bundledDraft || await requestJSON(url);
    showProposal(result);
    button.classList.add('is-loaded');
    button.textContent = `✓ Loaded — ${draftLoadLabels.get(button)}`;
    if (button.id === 'load-full-guide') {
      const motions = result.plan.steps.filter(step => step.kind !== 'manual_reference').length;
      $('guide-coverage').textContent = `${result.plan.steps.length} manual steps · ${motions} experimental motion drafts · ${result.plan.steps.length - motions} diagram-only steps`;
      $('guide-load-status').textContent = 'Use Next → beside the cabinet, or choose any step from the list.';
      preview();
    }
    return true;
  } catch (error) {
    button.textContent = `Retry — ${draftLoadLabels.get(button)}`;
    $('generation-status').textContent = error.message;
    if (button.id === 'load-full-guide') $('guide-load-status').textContent = error.message;
    return false;
  } finally {
    button.removeAttribute('aria-busy');
    for (const item of draftLoadButtons) item.disabled = false;
  }
}
$('load-v2-fixture').onclick = event => loadDraft(event.currentTarget, '/api/animation/fixture?version=2');
$('load-full-guide').onclick = event => loadDraft(event.currentTarget, '/api/animation/saved-guide?product_id=eket-70332124');
$('start-all-steps').onclick = async () => {
  if (!viewerReady) return;
  const opened = await loadDraft($('load-full-guide'), '/api/animation/saved-guide?product_id=eket-70332124');
  if (!opened) return;
  $('plan-play-all').click();
  $('viewer').scrollIntoView({behavior:'smooth', block:'start'});
};
$('load-fixture').onclick = event => loadDraft(event.currentTarget, '/api/animation/fixture');
$('load-saved-sequence').onclick = event => loadDraft(event.currentTarget, '/api/animation/saved-sequence?product_id=eket-70332124');
$('load-saved-plan').onclick = event => loadDraft(event.currentTarget, '/api/animation/saved-result?product_id=eket-70332124');
$('generate-plan').onclick = async () => {
  $('generate-plan').disabled = true;
  $('generation-status').textContent = 'Sending the selected manual page and source inventory to DeepSeek. Waiting for one draft or an explanation of missing information…';
  try {
    const previous = $('use-previous-plan').checked ? proposal : null;
    if ($('use-previous-plan').checked && !previous?.plan) throw new Error('Load a prior draft before continuing.');
    const result = await post('/api/animation/generate', { product_id: 'eket-70332124', source_page: Number($('generation-page').value), printed_step: $('generation-action').value, motion_version: 2,
      previous_plan: previous?.plan || null });
    if (previous && result.plan) {
      const composed = await post('/api/animation/compose', { previous_plan: previous.plan, next_plan: result.plan });
      composed.source_results = [previous, result];
      composed.separate_review = previous.separate_review;
      composed.human_edits.push('Previous source reviews and uncertainties still apply; source envelopes are included in the download.');
      showProposal(composed);
    } else showProposal(result);
  }
  catch (error) { $('generation-status').textContent = error.message; }
  finally { $('generate-plan').disabled = false; }
};
$('preview-plan').onclick = preview;
$('validate-plan').onclick = async () => {
  try {
    if ($('plan-json').value.length > 200000) throw new Error('Keep this experiment’s plan below 200 KB.');
    const plan = JSON.parse($('plan-json').value);
    if (plan.product_id !== 'eket-70332124') throw new Error('Select a plan for the EKET model on this page.');
    showProposal(await post('/api/animation/validate', plan)); preview();
  } catch (error) { $('generation-status').textContent = error.message; }
};
$('download-plan').onclick = () => {
  if (!proposal?.plan) return;
  if (proposal.provenance_download_url) {
    const link = document.createElement('a'); link.href = proposal.provenance_download_url;
    link.download = 'animation-plan-with-provenance.json'; link.click(); return;
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(proposal, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'animation-plan-with-provenance.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function stopInspection(render = true) {
  inspectNode = null;
  $('inspect-part').value = '';
  $('exit-inspection').hidden = true;
  $('hardware-status').textContent = 'Choose a part to see it alone at a larger zoom. No new geometry or generation call is used.';
  $('hardware-manual-link').href = '/assets/eket/manual.pdf#page=7';
  $('hardware-manual-link').textContent = 'Open original hardware inventory ↗';
  viewer?.resetCamera();
  if (render) {
    updatePlayback(); viewer?.renderScene();
    if (activePlan) viewer?.focusPlanStep(); else viewer?.resetCamera();
  }
}
$('exit-inspection').onclick = () => stopInspection();
$('inspect-part').onchange = event => {
  if (!event.target.value) { stopInspection(); return; }
  const info = inspectionParts.get(Number(event.target.value));
  if (!viewerReady || !info) return;
  inspectNode = info.part.node_index; playing = false; playAll = false;
  $('exit-inspection').hidden = false;
  const family = info.family;
  $('hardware-status').textContent = family ? `Part ${family.part_number} · source instance ${info.instance} of ${family.source_quantity} · ${family.animated_in_steps.length ? `motion draft in step ${family.animated_in_steps.join(', ')}` : `not animated; shown in the manual at step ${family.manual_step}`}. Drag to rotate and scroll to zoom. Neutral inspection shading; source geometry is unchanged. This does not show installation.` : info.part.category === 'hardware' ? `${info.part.node_name} · original source hardware. Manual-step coverage is unavailable. Neutral inspection shading; geometry is unchanged.` : `${info.part.node_name} · panel geometry only. Joint features are not separately labelled or independently animated.`;
  $('hardware-manual-link').href = `/assets/eket/manual.pdf#page=${family?.manual_page || (info.part.category === 'hardware' ? 7 : 8)}`;
  $('hardware-manual-link').textContent = family ? `Open original step ${family.manual_step} diagram ↗` : info.part.category === 'hardware' ? 'Open original hardware inventory ↗' : 'Open original panel-joint diagram ↗';
  updatePlayback(); viewer.focusPart(inspectNode);
  $('viewer').scrollIntoView({ behavior: 'smooth', block: 'center' });
};
$('plan-play-all').onclick = () => {
  if (!activePlan || !viewerReady) return;
  if (playAll && playing) { playing = false; playAll = false; updatePlayback(); return; }
  if (stepIndex === activePlan.steps.length - 1 && progress === 1) { stepIndex = 0; progress = 0; }
  playAll = true; playing = true;
  describeStep(); updatePlayback(); viewer?.renderScene(); viewer?.focusPlanStep();
};
$('plan-play').onclick = () => { playAll = false; if (progress === 1) progress = 0; playing = !playing; updatePlayback(); };
$('hardware-live-closeup').onchange = () => { updatePlayback(); viewer?.renderScene(); };
$('hardware-closeup').onclick = () => { playing = false; playAll = false; updatePlayback(); viewer?.focusPlanStep(hardwareFocus); };
$('hardware-wide').onclick = () => viewer?.focusPlanStep();
$('plan-scrub').oninput = event => { playing = false; playAll = false; progress = Number(event.target.value) / 1000; updatePlayback(); viewer?.renderScene(); };
for (const [id, direction] of [['plan-previous', -1], ['plan-next', 1]]) $(id).onclick = () => {
  if (!activePlan) return;
  stepIndex = Math.max(0, Math.min(activePlan.steps.length - 1, stepIndex + direction)); progress = 0; playing = false; playAll = false;
  describeStep(); updatePlayback(); viewer?.renderScene(); viewer?.focusPlanStep();
};
$('guide-step-picker').onchange = event => {
  if (!activePlan) return;
  stopInspection(false);
  stepIndex = Number(event.target.value); progress = 0; playing = false; playAll = false;
  describeStep(); updatePlayback(); viewer?.renderScene(); viewer?.focusPlanStep();
};
$('plan-assembled').onclick = () => {
  stopInspection(false);
  activePlan = null; playing = false; playAll = false; progress = 0; updatePlayback();
  $('player-status').textContent = 'Viewing the original assembled model. No animation plan loaded.';
  viewer?.renderScene(); viewer?.focusPlanStep();
};
$('generation-page').onchange = () => {
  const page = Number($('generation-page').value);
  if (!Number.isInteger(page) || page < 1 || page > 20) return;
  const url = page >= 7 && page <= 19 ? `/assets/eket/manual-page-${page}.png` : `/api/animation/manual-page?product_id=eket-70332124&page=${page}`;
  $('selected-page-image').src = $('selected-page-link').href = url;
  $('selected-page-image').alt = `Selected original manual page ${page}`;
  $('selected-page-number').textContent = String(page);
};

requestJSON('/api/health').then(health => {
  $('generate-plan').disabled = !health.deepseek_configured;
  $('generation-status').textContent = health.deepseek_configured ? `DeepSeek configured (${health.model}). Generation uses API balance and produces an unreviewed draft.` : 'DeepSeek is not connected. Configure the server API key and restart to generate an AI draft. The hand-authored fixture only tests playback.';
}).catch(error => { $('generation-status').textContent = error.message; });

try {
  $('viewer-error').textContent = 'Reading EKET source metadata…';
  const bundledReference = $('eket-reference-data');
  const reference = bundledReference ? JSON.parse(bundledReference.textContent) : await requestJSON('/assets/eket/reference.json');
  const families = reference.hardware_audit?.families || [];
  const hardware = reference.parts.filter(part => part.category === 'hardware');
  $('hardware-summary').textContent = reference.hardware_audit ? `Manual inventory: ${reference.hardware_audit.manual_loose_piece_count} loose pieces · source model: ${reference.hardware_audit.matched_source_piece_count} matching named pieces. Parts have motion drafts where listed; wall fastening and panel-connector engagement remain incomplete.` : `${hardware.length} named hardware pieces in the source model; manual coverage has not loaded.`;
  $('hardware-coverage-list').replaceChildren(...families.map(family => {
    const row = document.createElement('tr');
    for (const value of [family.part_number, `${family.quantity} / ${family.source_quantity}`, family.animated_in_steps.length ? `Motion draft: step ${family.animated_in_steps.join(', ')}` : `Not animated: step ${family.manual_step} diagram`]) row.append(text('td', value));
    return row;
  }));
  for (const [category, label] of [['hardware', 'Loose hardware'], ['panel', 'Panels — joint features not separately labelled']]) {
    const group = document.createElement('optgroup'); group.label = label;
    for (const part of reference.parts.filter(part => part.category === category)) {
      const family = families.find(family => family.source_node_ids.includes(part.node_index));
      const instance = family ? family.source_node_ids.indexOf(part.node_index)+1 : 1;
      inspectionParts.set(part.node_index, { part, family, instance });
      const option = text('option', family ? `${family.part_number} — ${instance} of ${family.source_quantity}${family.animated_in_steps.length ? '' : ' (not animated)'}` : part.node_name);
      option.value = String(part.node_index); group.append(option);
    }
    $('inspect-part').append(group);
  }
  $('component-count').textContent = `${reference.summary.panel_nodes} panels · ${reference.summary.hardware_nodes} hardware components`;
  const labels = new Map();
  for (const part of reference.parts) {
    const name = part.node_name.replace(/_\d+$/, '').replace(/ \(\d+\)$/, '');
    labels.set(name, (labels.get(name) || 0) + 1);
  }
  for (const [name, count] of labels) {
    const row = document.createElement('tr'); for (const value of [name, count]) row.append(text('td', value)); $('component-list').append(row);
  }
  $('viewer-error').textContent = 'Loading browser 3D scripts…';
  let moduleTimer;
  let createViewer;
  try {
    ({ createViewer } = await Promise.race([
      import('./viewer.bundle.js?v=motion-v2-1'),
      new Promise((_, reject) => { moduleTimer = setTimeout(() => reject(new Error('The browser 3D scripts did not finish loading through the forwarded connection. Click Retry loading.')), 25000); }),
    ]));
  } finally { clearTimeout(moduleTimer); }
  viewer = await createViewer($('viewer'), {
    model_url: '/assets/eket/model.glb', model_size_label: '15.1 MB', reference, connections: [],
    camera: { position: [.75, .6, .85], target: [0, .175, 0] },
  }, () => ({ stage: 'review', progress, corner: null, assembled: true, plan: activePlan, planStep: stepIndex, inspectNode, detailNode }), message => { $('viewer-error').textContent = message; });
  viewerReady = true;
  $('inspect-part').disabled = false;
  $('viewer-error').hidden = true;
  $('preview-plan').disabled = false;
  $('reset').onclick = () => inspectNode !== null ? viewer.focusPart(inspectNode) : activePlan?.steps[stepIndex].tracks.length ? viewer.focusPlanStep() : viewer.resetCamera();
  updatePlayback();
  if (activePlan) viewer.focusPlanStep();
  let previous = performance.now();
  function tick(now) {
    const elapsed = Math.min((now - previous) / 1000, .1); previous = now;
    if (playing && activePlan) {
      const current = activePlan.steps[stepIndex];
      const duration = playAll && current.kind === 'manual_reference' ? 10 : current.duration_seconds;
      progress = Math.min(1, progress + elapsed / duration);
      if (progress === 1) {
        if (playAll && stepIndex < activePlan.steps.length - 1) {
          stepIndex++; progress = 0;
          describeStep(); viewer?.renderScene(); viewer?.focusPlanStep();
        } else { playing = false; playAll = false; }
      }
      updatePlayback();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
} catch (error) {
  $('viewer-error').textContent = error.message;
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry loading'; retry.onclick = () => location.reload();
  $('viewer-error').append(document.createElement('br'), retry);
  fetch('/api/viewer-diagnostics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: error.stage || 'module', message: (error.message || 'Unknown error').replace(/https?:\/\/\S+/g, '[URL]').slice(0, 600) }) }).catch(() => {});
  $('reset').disabled = true; $('preview-plan').disabled = !proposal?.plan;
}
