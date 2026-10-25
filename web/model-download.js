// Lossless transfer of original GLB bytes over small, ordinary HTTP 200 responses.
export async function downloadModel(demo, onStatus) {
  const result = new Uint8Array(demo.model_bytes);
  const size = demo.chunk_bytes;
  const deadline = performance.now() + 300000;
  let next = 0, completed = 0, stopped = false, cache;
  const bounded = promise => {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Browser cache unavailable')), 1500); })]).finally(() => clearTimeout(timer));
  };
  try { if (globalThis.caches) cache = await bounded(caches.open('assembly-model-chunks-v1')); } catch { cache = null; }
  const report = verb => onStatus(`${verb} source model: ${(completed/1000000).toFixed(2)} MB / ${demo.model_size_label}…`);
  async function chunk(start) {
    const length = Math.min(size, result.length-start);
    const key = new URL(demo.model_url, location.href);
    key.searchParams.set('part', `${start}-${start+length-1}`);
    if (cache) {
      try {
        const saved = await bounded(cache.match(key.href));
        if (saved) {
          const bytes = new Uint8Array(await bounded(saved.arrayBuffer()));
          if (bytes.length === length) { result.set(bytes,start); completed += length; report('Restoring downloaded'); return; }
        }
      } catch { cache = null; }
    }
    for (let attempt=0;attempt<2;attempt++) {
      try {
        const remaining=deadline-performance.now();
        if (remaining<=0) throw new Error('The model download exceeded five minutes');
        const url=new URL(demo.chunk_url.replace('{offset}',String(start)),location.href);
        url.searchParams.set('_request',`${Date.now()}-${attempt}`);
        report(attempt?'Retrying':'Downloading');
        const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(Math.max(1,Math.floor(Math.min(15000,remaining))))});
        if(!response.ok)throw new Error(`Model data HTTP ${response.status}`);
        const body=await response.json();
        if(body.offset!==start||body.total!==result.length||typeof body.data!=='string')throw new Error('Model data did not match the requested part');
        const binary=atob(body.data);
        if(binary.length!==length)throw new Error('Model data was truncated');
        const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
        result.set(bytes,start); completed+=length; report('Downloading');
        if(cache)try{await bounded(cache.put(key.href,new Response(bytes)));}catch{cache=null;}
        return;
      }catch(error){if(attempt===1||performance.now()>=deadline)throw error;}
    }
  }
  const workers=Array.from({length:4},async()=>{
    while(!stopped){const start=next;next+=size;if(start>=result.length)return;try{await chunk(start);}catch(error){stopped=true;throw error;}}
  });
  // Wait for workers to settle so a failed load cannot leave unhandled work behind.
  const outcomes=await Promise.allSettled(workers);
  const failure=outcomes.find(outcome=>outcome.status==='rejected');
  if(failure)throw failure.reason;
  return result.buffer;
}
