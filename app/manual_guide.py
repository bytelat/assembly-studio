"""Small server-rendered manual navigation, independent of JavaScript and WebGL."""
from html import escape

from fastapi import HTTPException
from fastapi.responses import HTMLResponse

from app.animation_api import saved_guide


def manual_guide_page(step=1):
    guide = saved_guide('eket-70332124')
    steps = guide['plan']['steps']
    if not 1 <= step <= len(steps):
        raise HTTPException(422, 'Step must be between 1 and 11')
    current = steps[step - 1]
    page = current['source_pages'][0]
    nav = ''.join(f'<a href="/eket-steps?step={i}"' + (' aria-current="step"' if i == step else '') + f'>{i}</a>' for i in range(1, len(steps) + 1))
    previous = f'<a href="/eket-steps?step={step - 1}">← Previous</a>' if step > 1 else '<span>First step</span>'
    following = f'<a href="/eket-steps?step={step + 1}">Next →</a>' if step < len(steps) else '<span>Last step</span>'
    # Use the source-diagram summary even where an unverified AI motion exists.
    from app.eket_manual_steps import MANUAL_STEPS
    summary = MANUAL_STEPS[step - 1]
    return HTMLResponse(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EKET — Step {step} of 11</title>
<style>body{{font:17px/1.6 system-ui,sans-serif;color:#25372f;background:#f7f6f2;margin:0}}main{{max-width:850px;margin:25px auto;padding:20px}}h1{{line-height:1.2}}nav,.actions{{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}}a{{color:#304b3c}}nav a,.actions a{{padding:10px 16px;background:white;border:1px solid #b9c3b6;border-radius:6px;text-decoration:none}}nav [aria-current]{{color:white;background:#304b3c}}img{{display:block;width:100%;max-height:900px;object-fit:contain;background:white}}small{{display:block}}.actions{{justify-content:space-between}}</style></head><body><main>
<a href="/eket.html">← Back to 3D experiment</a><h1>EKET: step {step} of 11</h1><p>Original manual navigator. This view works without JavaScript or a 3D viewer.</p><nav aria-label="Manual steps">{nav}</nav>
<h2>{escape(summary[2])}</h2><p>{escape(summary[3])}</p><p>Read printed step {step} on PDF page {page}. Some pages contain more than one numbered step.</p>
<div class="actions">{previous}{following}</div>
<a href="/assets/eket/manual-page-{page}.png" target="_blank" rel="noopener"><img src="/assets/eket/manual-page-{page}.png" alt="Original manual page {page}, printed step {step}"></a>
<p><a href="/assets/eket/manual.pdf#page={page}" target="_blank" rel="noopener">Open original PDF at page {page} ↗</a></p><p>Support and mounting choices: <a href="/assets/eket/manual.pdf#page=12">pages 12–13</a> and <a href="/assets/eket/manual.pdf#page=18">page 18</a>. Follow the original warnings and separate accessory instructions.</p>
<div class="actions">{previous}{following}</div><small>Original model/manual © Inter IKEA Systems B.V. · <a href="/assets/eket/LICENSE.md">CC BY-NC-SA 4.0</a> · Assistant-authored summaries; original diagrams remain the source. This is not a complete animated guide.</small>
</main></body></html>''')
