"""Product data adapters for one shared assembly player; no per-product UI."""
import copy
import json
from pathlib import Path

from app.animation_schema import AnimationPlan
from app.animation_api import saved_guide
from app.demo import DEMO

ROOT=Path(__file__).resolve().parent.parent
PRODUCTS={
    'lack':{'name':'LACK side table','article':'30449908','url':'/','advanced':'/lack-lab.html'},
    'eket':{'name':'EKET cabinet','article':'70332124','url':'/eket.html','advanced':'/eket-lab.html'},
    'dalfred':{'name':'DALFRED bar stool','article':'60155602','url':'/dalfred.html','advanced':None},
}


def model_path(slug):
    if slug not in PRODUCTS:raise KeyError(slug)
    return ROOT/'web/assets'/slug/'model.glb'


def lack_guide(reference):
    visible={reference['animation']['top_node']}
    steps=[]
    for index,source in enumerate(DEMO['steps']):
        tracks=[]
        if source['focus'] in ('connector','leg'):
            node=DEMO['connections'][source['corner']][source['focus']+'_node']
            visible.add(node)
            tracks=[dict(node_index=node,keyframes=[dict(fraction=0,offset_m=[0,-.12 if source['focus']=='connector' else -.18,0],rotation_deg=[0,-720,0]),dict(fraction=1,offset_m=[0,0,0],rotation_deg=[0,0,0])])]
        steps.append(dict(printed_step=index+1,kind='motion' if tracks else 'manual_reference',title=source['title'],instruction=source['instruction'],source_pages=[1],duration_seconds=4 if tracks else 3,visible_node_ids=sorted(visible),tracks=tracks,warnings=['Authored illustrative motion. Rotation is not a prescribed turn count or torque; assembly has not been physically tested.'],uncertainties=reference.get('uncertainties',[])))
    identity=dict(schema_version=2,product_id='lack-30449908',source_document=reference['manual_document'],model_sha256=reference['files']['model.glb']['sha256'],manual_sha256=reference['files']['manual.pdf']['sha256'],coordinate_space='source_node_parent_meters')
    plan=AnimationPlan.model_validate({**identity,'steps':steps})
    return dict(reference=reference,plan=plan.model_dump(mode='json'),origin='assistant_authored_demo',complete_animation=False,overview_steps=[1,10],step_labels=['Original connection diagram · PDF page 1']*len(steps),presentation_rotations={str(i):[0,0,180] for i in range(2,10)},notice='Eight illustrative connection motions; inventory and final review use the assembled source model. Physical turning, tightening force and turn counts are not verified.')


def product_guide(slug):
    if slug not in PRODUCTS:raise KeyError(slug)
    directory=ROOT/'web/assets'/slug
    reference=json.loads((directory/'reference.json').read_text())
    if slug=='lack':
        guide=lack_guide(reference)
    elif slug=='eket':
        saved=saved_guide('eket-70332124')
        reference['hardware_audit']=saved.get('hardware_audit',{})
        guide=dict(reference=reference,plan=saved['plan'],origin=saved['origin'],complete_animation=False,playback_cues=saved.get('playback_cues',{}),notice='Unverified motion drafts. Manual-reference steps have no motion; their assembled context stays visible. Remaining operations are listed with each step.',unanimated_operations=saved.get('coverage',{}).get('unanimated_operations',{}),provenance_url='/api/animation/saved-guide?product_id=eket-70332124')
    else:
        guide=json.loads((directory/'guide.json').read_text())
    guide=copy.deepcopy(guide)
    plan=AnimationPlan.model_validate(guide['plan'])
    known={part['node_index'] for part in guide['reference']['parts']}
    for step in plan.steps:
        if set(step.visible_node_ids)-known:raise ValueError('Guide refers to unavailable geometry')
    for name,key in [('model.glb','model_sha256'),('manual.pdf','manual_sha256')]:
        if getattr(plan,key)!=guide['reference']['files'][name]['sha256']:raise ValueError('Guide source assets do not match')
    product={**PRODUCTS[slug],'slug':slug,'asset_base':f'/assets/{slug}','manual_url':f'/assets/{slug}/manual.pdf','model_url':f"/models/{slug}.glb?v={guide['reference']['files']['model.glb']['sha256']}",'model_bytes':model_path(slug).stat().st_size,'chunk_bytes':65536,'chunk_url':f'/model-data/{slug}/{{offset}}'}
    guide.update(product=product,products=[{**value,'slug':key} for key,value in PRODUCTS.items()],neutral_parts=True)
    guide['detail_node_ids']=[part['node_index'] for part in guide['reference']['parts'] if part['category'] in ('hardware','connector')]
    guide['detail_directions']={str(node):direction for check in guide.get('inspection_steps',{}).values() for node,direction in zip(check['node_ids'],check.get('view_directions',[]))}
    guide.setdefault('animated_steps',[step.printed_step for step in plan.steps if step.kind=='motion'])
    return guide
