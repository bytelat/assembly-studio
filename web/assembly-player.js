// One controller for every product. Geometry, phases, views and motion come from data.
const $ = id => document.getElementById(id);
const guide = JSON.parse($('product-guide-data').textContent);
const { plan, product } = guide;
const parts = new Map(guide.reference.parts.map(part => [part.node_index, part]));
let viewer, ready = false, index = 0, progress = 0, playing = false;
let diagramURL = "";
let continuous = false, source = false, inspectNode = null, lastDescription = -1;
const lastIndex = plan.steps.length - 1;
const checkpoint = () => guide.inspection_steps?.[String(index + 1)];
const overview = () => guide.overview_steps?.includes(index + 1);
const motion = () => plan.steps[index].kind === 'motion';
const referenceOnly = () => !motion() && !checkpoint() && !overview();
const element = (tag, value) => { const item = document.createElement(tag); item.textContent = value; return item; };

$('assembly-name').textContent = product.name;
document.title = `${product.name} — Assembly Studio`;
$('assembly-summary').textContent = `${plan.steps.length} steps · ${parts.size} source components · same player for every product`;
$('assembly-article').textContent = `ARTICLE ${product.article}`;
$('assembly-notice').textContent = guide.notice || 'Unverified assembly visualization. Compare every action with the original manual.';
$('assembly-reference').href = guide.provenance_url || `${product.asset_base}/reference.json`;
$('assembly-license').href = `${product.asset_base}/LICENSE.md`;
$('assembly-manual').href = product.manual_url;
if (product.advanced) { $('assembly-advanced').hidden = false; $('assembly-advanced').href = product.advanced; }
$('assembly-products').replaceChildren();
for (const option of guide.products) {
  const link = element('a', option.name); link.href = option.url;
  if (option.slug === product.slug) link.setAttribute('aria-current', 'page');
  $('assembly-products').append(link);
}
$('product-step').replaceChildren(...plan.steps.map((step, i) => {
  const option = element('option', `${i + 1} of ${plan.steps.length} — ${step.title}`); option.value = i; return option;
}));
for (const part of parts.values()) {
  const option = element('option', part.display_name || part.node_name); option.value = part.node_index; $('product-part').append(option);
}
function activeNode() {
  const check = checkpoint();
  if (check) return check.node_ids[Math.min(check.node_ids.length - 1, Math.floor(progress * check.node_ids.length))];
  const tracks = plan.steps[index].tracks;
  const active = tracks.filter(track => progress >= (track.keyframes?.[0]?.fraction ?? track.start_fraction ?? 0) && progress < (track.keyframes?.at(-1)?.fraction ?? track.end_fraction ?? 1));
  const current = active[Math.min(active.length - 1, Math.floor(progress * active.length))];
  return (current || tracks.find(track => progress < (track.keyframes?.[0]?.fraction ?? track.start_fraction ?? 0)) || tracks.at(-1))?.node_index ?? null;
}
function liveDetail() {
  const node = activeNode();
  const cue = guide.playback_cues?.[String(plan.steps[index].printed_step || index + 1)]?.some(value => progress >= value.start && progress < value.end);
  if (!$('product-live-detail').checked || source || inspectNode !== null || overview() || cue) return null;
  return checkpoint() || guide.detail_node_ids?.includes(node) ? node : null;
}
function description() {
  const step = plan.steps[index];
  if (lastDescription === index) return;
  lastDescription = index;
  $('assembly-step-count').textContent = `STEP ${index + 1} OF ${plan.steps.length}`;
  $('product-title').textContent = step.title;
  $('product-instruction').textContent = checkpoint()?.instruction || step.instruction;
  const notices = [...step.warnings];
  const omitted = guide.unanimated_operations?.[String(step.printed_step || index + 1)];
  if (omitted) notices.unshift(`Not animated: ${omitted}`);
  $('assembly-warnings').replaceChildren(...notices.map(value => element('li', value)));
}
// Decode before showing a new diagram; never leave the previous step on screen.
function syncDiagram(url, label) {
  if (diagramURL === url) return;
  diagramURL = url;
  const target = $('product-image');
  target.hidden = true;
  target.setAttribute('aria-busy', 'true');
  $('product-phase').textContent = `${label} · loading matching diagram…`;
  const image = new Image();
  let timer = setTimeout(() => failed(), 20000);
  function failed() {
    clearTimeout(timer);
    if (diagramURL !== url) return;
    $('product-phase').textContent = `${label} · diagram unavailable. Animation continues; open the original manual for reference.`;
    target.setAttribute('aria-busy', 'false');
  }
  image.onload = async () => {
    try { await image.decode(); } catch { failed(); return; }
    clearTimeout(timer);
    if (diagramURL !== url) return;
    target.src = url; target.alt = label; target.hidden = false;
    target.setAttribute('aria-busy', 'false');
    $('product-phase').textContent = label;
  };
  image.onerror = failed;
  image.src = url;
}
function update() {
  description();
  const inspecting = inspectNode !== null;
  const check = checkpoint();
  $('product-step').value = index;
  $('product-previous').disabled = index === 0;
  $('product-next').disabled = index === lastIndex;
  $('product-play').disabled = $('product-scrub').disabled = !ready || source || inspecting;
  $('product-all').disabled = !ready || inspecting;
  $('product-pause').disabled = !playing;
  $('product-all').setAttribute('aria-pressed', String(continuous && playing));
  $('product-play').setAttribute('aria-pressed', String(playing && !continuous));
  for (const id of ['product-source', 'product-reset', 'product-part']) $(id).disabled = !ready;
  $('product-source').textContent = source ? 'Return to steps' : 'Assembled model';
  $('product-scrub').value = Math.round(progress * 1000);
  const mode = inspecting ? 'SOURCE PART INSPECTION' : source ? 'ORIGINAL ASSEMBLED MODEL' : check ? '3D BOLT-CHECK WALKTHROUGH' : overview() ? 'SOURCE OVERVIEW' : motion() ? 'UNVERIFIED MOTION DRAFT' : 'MANUAL REFERENCE · NO MOTION';
  $('product-mode').textContent = mode;
  $('product-omissions').textContent = check ? '3D checkpoint walkthrough. Turning and tightening force are not simulated.' : referenceOnly() ? 'This operation has no animation yet. The 3D assembly context stays visible; use the original diagram for the operation.' : overview() ? 'Assembled source reference. Physical turning and fastening are not demonstrated here.' : 'Unverified motion draft. Distances and timing are illustrative; fitting and tightening are not physically verified.';
  const step = plan.steps[index];
  const phase = guide.manual_phases?.[String(index + 1)]?.find(value => progress >= value.start && progress < value.end);
  const image = phase?.image || guide.step_diagrams?.[index] || `${product.asset_base}/manual-page-${step.source_pages[0]}.png`;
  const label = phase?.label || guide.step_labels?.[index] || `Original printed step ${step.printed_step || index + 1} · PDF page ${step.source_pages[0]}`;
  syncDiagram(image, label); $('product-diagram').href = image;
  const node = !source && !inspecting ? activeNode() : null;
  const cue = guide.playback_cues?.[String(step.printed_step || index + 1)]?.find(value => progress >= value.start && progress < value.end);
  $('product-action').textContent = cue ? `${cue.title}: ${cue.detail}` : node !== null ? `Watch source part ${parts.get(node).display_name || parts.get(node).node_name}` : '';
  const detail = liveDetail();
  $('product-detail').hidden = detail === null;
  $('product-detail-region').hidden = detail === null;
  $('viewer').classList.toggle('has-part-detail', detail !== null);
  if (detail !== null) $('product-detail').textContent = check ? `CHECK ${check.node_ids.indexOf(detail) + 1} OF ${check.node_ids.length} · ${parts.get(detail).node_name}` : `LIVE CLOSE-UP · ${parts.get(detail).node_name}`;
  $('product-status').textContent = inspecting ? `Inspecting ${parts.get(inspectNode).node_name}` : source ? 'Original assembled source model' : `Step ${index + 1} of ${plan.steps.length} · ${referenceOnly() ? 'no motion; read the diagram' : check ? '3D checkpoints' : overview() ? 'source overview' : 'motion draft'}${playing ? continuous ? ' · playing all steps' : ' · playing this step' : progress === 1 ? ' · finished' : ' · paused'}`;
}
function stop() { playing = false; continuous = false; }
function frame() { viewer?.renderScene(); viewer?.frameAssembly(); }
function selectStep(value) {
  stop(); source = false; inspectNode = null; $('product-part').value = '';
  index = Math.max(0, Math.min(lastIndex, value)); progress = 0; update(); frame();
}
$('product-live-detail').onchange = () => { update(); viewer?.renderScene(); };
$('product-step').onchange = event => selectStep(Number(event.target.value));
$('product-previous').onclick = () => selectStep(index - 1);
$('product-next').onclick = () => selectStep(index + 1);
$('product-play').onclick = () => { if (progress === 1) progress = 0; continuous = false; playing = true; update(); };
$('product-pause').onclick = () => { playing = false; update(); };
$('product-all').onclick = () => {
  source = false; inspectNode = null; $('product-part').value = '';
  if (index === lastIndex && progress === 1) { index = 0; progress = 0; }
  continuous = true; playing = true; update(); frame();
};
$('product-scrub').oninput = event => { stop(); progress = Number(event.target.value) / 1000; update(); viewer?.renderScene(); };
$('product-source').onclick = () => { stop(); source = !source; inspectNode = null; $('product-part').value = ''; update(); frame(); };
$('product-reset').onclick = () => inspectNode !== null ? viewer?.focusPart(inspectNode) : frame();
$('product-part').onchange = event => {
  stop(); source = false; inspectNode = event.target.value ? Number(event.target.value) : null; update();
  viewer?.renderScene(); if (inspectNode !== null) viewer?.focusPart(inspectNode); else frame();
};
update();
try {
  let timer, module;
  try { module = await Promise.race([import('/viewer.bundle.js?v=shared-player-1'), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The 3D viewer download timed out. Retry loading.')), 60000); })]); }
  finally { clearTimeout(timer); }
  viewer = await module.createViewer($('viewer'), {
    model_url: product.model_url, model_bytes: product.model_bytes, chunk_bytes: product.chunk_bytes, chunk_url: product.chunk_url,
    detail_layout: 'floating', model_size_label: `${(product.model_bytes / 1000000).toFixed(1)} MB`, reference: guide.reference, connections: [],
  }, () => ({ stage: 'review', assembled: true, plan: source || overview() ? null : plan, planStep: index, progress, inspectNode, neutralParts: guide.neutral_parts,
    detailNode: liveDetail(),
    detailDirection: guide.detail_directions?.[String(liveDetail())],
    presentationRotationDeg: guide.presentation_rotations?.[String(index + 1)],
  }), message => { $('viewer-error').textContent = message; });
  ready = true; $('viewer-error').hidden = true; update(); frame();
  let previous = performance.now();
  document.addEventListener('visibilitychange', () => { previous = performance.now(); });
  function tick(now) {
    const elapsed = Math.max(0, (now - previous) / 1000); previous = now;
    if (playing) {
      const duration = referenceOnly() ? 10 : plan.steps[index].duration_seconds;
      progress = Math.min(1, progress + elapsed / duration);
      if (progress === 1) {
        if (continuous && index < lastIndex) { index++; progress = 0; update(); frame(); }
        else { playing = false; continuous = false; }
      }
      update();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
} catch (error) {
  $('viewer-error').hidden = false; $('viewer-error').textContent = error.message;
  const retry = element('button', 'Retry loading'); retry.onclick = () => location.reload(); $('viewer-error').append(document.createElement('br'), retry);
  const manual = element('a', 'Open original manual'); manual.href = product.manual_url; $('viewer-error').append(document.createElement('br'), manual);
  fetch('/api/viewer-diagnostics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: error.stage || 'module', message: (error.message || 'Loading failed').replace(/https?:\/\/\S+/g, '[URL]').slice(0, 600) }) }).catch(() => {});
}
