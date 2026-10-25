import hashlib
import json
import re
from pathlib import Path

from fastapi.testclient import TestClient
from app.main import app
from app.animation_schema import AnimationPlan

ASSETS=Path(__file__).resolve().parent.parent/'web/assets/dalfred'


def test_dalfred_original_assets_and_partial_guide_are_consistent():
    guide=json.loads((ASSETS/'guide.json').read_text())
    reference=guide['reference'];plan=AnimationPlan.model_validate(guide['plan'])
    assert len(reference['parts'])==33
    for name,key in [('model.glb','model_sha256'),('manual.pdf','manual_sha256')]:
        actual=hashlib.sha256((ASSETS/name).read_bytes()).hexdigest()
        assert actual==reference['files'][name]['sha256']==getattr(plan,key)
    assert [s.printed_step for s in plan.steps]==list(range(1,10))
    assert guide['animated_steps']==[1,2,3,5,6,7,8,9]
    assert not guide['complete_animation']
    known={p['node_index'] for p in reference['parts']}
    assert set(plan.steps[-1].visible_node_ids)==known
    assert all(set(s.visible_node_ids)<=known for s in plan.steps)
    assert all((ASSETS/f'manual-page-{s.source_pages[0]}.png').exists() for s in plan.steps)


def test_dalfred_page_embeds_guide_and_is_linked_from_both_products():
    client=TestClient(app)
    response=client.get('/dalfred.html')
    assert response.status_code==200
    data=json.loads(re.search(r'<script id="product-guide-data" type="application/json">(.*?)</script>',response.text,re.S).group(1))
    assert len(data['plan']['steps'])==9
    assert 'src="/product.js"' not in response.text
    assert 'thread engagement' in response.text
    for path in ('/','/eket.html'):
        assert 'href="/dalfred.html"' in client.get(path).text


def test_first_joining_actions_stage_structure_before_the_matching_bolts():
    plan=AnimationPlan.model_validate(json.loads((ASSETS/'guide.json').read_text())['plan'])
    from app.geometry_checks import _track_pose
    tracks={t.node_index:t for t in plan.steps[0].tracks}
    assert set(tracks)=={1,2,5,11,12,14,18}
    assert 3 in plan.steps[0].visible_node_ids and 3 not in tracks
    assert _track_pose(tracks[1],.25)[0]==(0,0,0)
    assert _track_pose(tracks[5],.25)[0][2]>.17
    assert _track_pose(tracks[5],.51)[0]==(0,0,0)
    assert _track_pose(tracks[11],.51)[0][2]<-.05
    assert _track_pose(tracks[12],.71)[0][2]>.05
    assert all(_track_pose(track,1)[0]==(0,0,0) for track in tracks.values())
    assert not {4,6}&set(plan.steps[0].visible_node_ids)
    assert {4,6}<={t.node_index for t in plan.steps[1].tracks}
    assert json.loads((ASSETS/'guide.json').read_text())['presentation_rotations']['1']==[90,0,0]


def test_seat_subassembly_stays_raised_until_rigid_join_in_step_9():
    guide=json.loads((ASSETS/'guide.json').read_text())
    plan=AnimationPlan.model_validate(guide['plan'])
    from app.geometry_checks import _track_pose
    expected={7,8,23,24,25,26,27,32,33}
    for track in plan.steps[4].tracks:
        assert track.keyframes[-1].offset_m==(0,.35,0)
    assert plan.steps[6].kind=='motion'
    assert plan.steps[6].tracks[0].node_index==7
    assert plan.steps[6].tracks[0].keyframes[-1].offset_m==(0,.35,0)
    assert plan.steps[7].tracks[0].keyframes[-1].offset_m==(0,.35,0)
    tracks=plan.steps[8].tracks
    assert {t.node_index for t in tracks}==expected
    for progress in [0,.25,.5,.75,1]:
        assert len({_track_pose(t,progress) for t in tracks})==1
    assert all(t.keyframes[0].offset_m==(0,.35,0) and t.keyframes[-1].offset_m==(0,0,0) for t in tracks)


def test_step_4_checkpoints_reference_four_already_installed_ring_bolts():
    guide=json.loads((ASSETS/'guide.json').read_text())
    checks=guide['inspection_steps']['4']
    assert checks['node_ids']==[19,20,21,22]
    assert set(checks['node_ids'])<=set(guide['plan']['steps'][3]['visible_node_ids'])
    assert 'not simulated' in checks['instruction']
    assert len(set(guide['animated_steps'])|{int(n) for n in guide['inspection_steps']})==9


def test_dalfred_model_ranges_are_exact_and_not_stream_compressed():
    client=TestClient(app)
    response=client.get('/models/dalfred.glb',headers={'Range':'bytes=0-1023','Accept-Encoding':'gzip'})
    assert response.status_code==206
    assert response.content==(ASSETS/'model.glb').read_bytes()[:1024]
    assert response.headers['Content-Range']=='bytes 0-1023/12800892'
    assert response.headers['Content-Length']=='1024'
    assert 'Content-Encoding' not in response.headers
    for requested in ['bytes=5-1','bytes=99999999-99999999','bytes=0-9999999','bytes=-4']:
        assert client.get('/models/dalfred.glb',headers={'Range':requested}).status_code==416
