"""Inspect original DALFRED assets and build disclosed, partial authored playback."""
import hashlib
import json
import struct
from pathlib import Path

import pymupdf
from app.animation_schema import AnimationPlan

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'web/assets/dalfred'
COMMIT = '2c3f453a7ed7e3a056939ecca6a888ccfaf5695c'


def build():
    data = (ASSETS / 'model.glb').read_bytes()
    magic, version, length = struct.unpack_from('<4sII', data)
    assert (magic, version, length) == (b'glTF', 2, len(data))
    size = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20+size])
    parts = [{'node_index':i,'node_name':node['name'],'category':'hardware' if node['name'].split('_')[0].isdigit() else 'structure','mesh_index':node['mesh']} for i,node in enumerate(gltf['nodes']) if 'mesh' in node]
    assert len(parts) == 33
    files = {}
    for name, path in [('model.glb','glTF_glb/DALFRED_60155602.glb'),('manual.pdf','pdf_documentation/AA-399492-11.pdf')]:
        files[name] = {'sha256':hashlib.sha256((ASSETS/name).read_bytes()).hexdigest(),'url':f'https://raw.githubusercontent.com/IKEA/IKEA3DAssemblyDataset/{COMMIT}/Dataset/DALFRED_60155602/{path}'}
    reference = dict(product='IKEA DALFRED bar stool, black',article_number='60155602',manual_document='AA-399492-11',manual_pages=8,upstream_commit=COMMIT,license='CC BY-NC-SA 4.0',copyright='Inter IKEA Systems B.V.',files=files,parts=parts,review_status='Original source geometry; assistant-authored partial motion drafts, not physically verified')
    # Separate subassemblies stay at their original final positions. No working
    # orientation, thread engagement or torque is inferred as verified guidance.
    definitions = [
        (4,'Join the first two legs and support discs',[1,2,3,5,11,12,14,18],{},'With the frame shown on its side, bring both support discs to the first leg, fit the opposite leg, then approach the four long 105251 bolts. This authored draft shows positioning, not thread engagement or tightening.'),
        (4,'Fit the remaining two legs',[4,6,13,15,16,17],{},'Keep the frame on its side. Bring in the two remaining legs, then approach their four long 105251 bolts. Distances and timing are illustrative; bolt turning and tightening are not animated.'),
        (5,'Position the footrest ring and four short bolts',[9,19,20,21,22],{9:[0,-.16,0],19:[.05,0,0],20:[0,0,.05],21:[-.05,0,0],22:[0,0,-.05]},'Position the footrest ring, then approach its four 100212 bolts. The manual shows initial hand fitting; do not use the hex key yet. Paths and distances are illustrative.'),
        (5,'Tighten the footrest bolts',[],{},'Printed step 4 shows tightening all four 100212 bolts with the hex key. Turning, torque and tool motion are not animated.'),
        (6,'Attach the mounting plate to the seat',[8,33,23,24,25,26,27],{8:[0,-.08,0],23:[0,-.045,0],24:[0,-.045,0],25:[0,-.045,0],26:[0,-.045,0],27:[0,-.045,0]},'Separate seat subassembly: bring the plate toward the seat, then approach the five 108443 screws. The seat subassembly is raised above the frame for visibility until step 9. Working orientation and screw turning are not animated.'),
        (6,'Fit the central sleeve to the frame',[10,28,29,30,31],{28:[0,.045,0],29:[0,.045,0],30:[0,.045,0],31:[0,.045,0]},'The source sleeve is shown in place; four 105298 screws approach their recorded positions. Sleeve insertion, exact engagement and tightening remain unanimated.'),
        (7,'Fit the threaded seat spindle',[7],{},'Bring the spindle into the raised seat mounting plate. The seat assembly remains separate from the frame until step 9. This draft shows axial positioning; the hammer action and interference fit are not simulated.'),
        (7,'Fit the end plug',[32],{32:[0,-.05,0]},'Approach the spindle end with plug 107675, following the original orientation. The manual shows tapping it into place; hammering and interference fit are not animated.'),
        (8,'Join the seat assembly to the frame',[],{},'Lower the seat, mounting plate, spindle, plug and fitted screws together toward the frame. This draft shows alignment and axial approach; threaded turning, locking and height adjustment remain unanimated. Follow the original adjustment diagram.')]
    visible=set();steps=[]
    for number,(page,title,added,moves,instruction) in enumerate(definitions,1):
        visible.update(added);tracks=[]
        for order,(node,offset) in enumerate(moves.items()):
            start = 0 if order==0 else min(.65,.2+order*.055)
            end = .42 if number in (3,5) and order==0 else min(.98,start+.3)
            tracks.append(dict(node_index=node,keyframes=[dict(fraction=start,offset_m=offset),dict(fraction=end,offset_m=[0,0,0])]))
        if number in (3,5):
            for track in tracks[1:]:
                track['keyframes'][0]['fraction']=.48
                track['keyframes'][1]['fraction']=.95
        if number in (1,2):
            # Pair legs/bolts by the source attachment positions, not node order.
            # Offsets are parent-space translations; source rotations are retained.
            staged = ([(1,[0,0,.07],0,.22),(2,[0,0,.07],0,.22),
                       (5,[0,0,.18],.27,.5),
                       (11,[0,0,-.06],.53,.7),(18,[0,0,-.06],.53,.7),
                       (12,[0,0,.06],.74,.94),(14,[0,0,.06],.74,.94)] if number==1 else
                      [(4,[-.18,0,0],0,.3),(6,[.18,0,0],.32,.62),
                       (13,[-.06,0,0],.65,.78),(17,[-.06,0,0],.65,.78),
                       (15,[.06,0,0],.81,.96),(16,[.06,0,0],.81,.96)])
            tracks=[dict(node_index=node,keyframes=[dict(fraction=start,offset_m=offset),dict(fraction=end,offset_m=[0,0,0])]) for node,offset,start,end in staged]
        # Keep the seat subassembly raised until the manual joins it to the frame.
        # V2 retains these offsets through intervening steps and direct navigation.
        if number == 5:
            tracks=[dict(node_index=33,keyframes=[dict(fraction=0,offset_m=[0,.42,0]),dict(fraction=.15,offset_m=[0,.35,0])]),
                    dict(node_index=8,keyframes=[dict(fraction=.2,offset_m=[0,.27,0]),dict(fraction=.45,offset_m=[0,.35,0])])]
            tracks += [dict(node_index=node,keyframes=[dict(fraction=.5,offset_m=[0,.305,0]),dict(fraction=.95,offset_m=[0,.35,0])]) for node in range(23,28)]
        if number == 7:
            tracks=[dict(node_index=7,keyframes=[dict(fraction=0,offset_m=[0,.23,0]),dict(fraction=.85,offset_m=[0,.35,0])])]
        if number == 8:
            tracks=[dict(node_index=32,keyframes=[dict(fraction=0,offset_m=[0,.30,0]),dict(fraction=.85,offset_m=[0,.35,0])])]
        if number == 9:
            tracks=[dict(node_index=node,keyframes=[dict(fraction=.1,offset_m=[0,.35,0]),dict(fraction=.9,offset_m=[0,0,0])]) for node in [7,8,23,24,25,26,27,32,33]]
        steps.append(dict(printed_step=number,kind='motion' if tracks else 'manual_reference',title=title,instruction=instruction,source_pages=[page],duration_seconds=8,visible_node_ids=sorted(visible),tracks=tracks,warnings=['Assistant-authored partial visualization; not AI-generated or physically verified. Follow the original manual.'],uncertainties=['Source-node identities are inferred from labels, positions and diagrams. Motion distances/timing are illustrative. Working orientation, engagement, torque and collision freedom are not verified.']))
    plan=AnimationPlan.model_validate(dict(schema_version=2,product_id='dalfred-60155602',source_document='AA-399492-11',model_sha256=files['model.glb']['sha256'],manual_sha256=files['manual.pdf']['sha256'],coordinate_space='source_node_parent_meters',steps=steps))
    assert set(plan.steps[-1].visible_node_ids)=={p['node_index'] for p in parts}
    guide=dict(reference=reference,plan=plan.model_dump(mode='json'),origin='assistant_authored_partial_guide',complete_animation=False,animated_steps=[s.printed_step for s in plan.steps if s.kind=='motion'],step_diagrams=[f'/assets/dalfred/step-{n}.png' for n in range(1,10)],presentation_rotations={'1':[90,0,0],'2':[90,0,0]},manual_phases={'9':[{'start':0,'end':1.01,'image':'/assets/dalfred/step-9-join.png','label':'Step 9 · join the seat assembly to the frame'}]},inspection_steps={'4':{'node_ids':[19,20,21,22],'view_directions':[[-1,0,0],[0,0,-1],[1,0,0],[0,0,1]],'instruction':'Check and tighten each of the four 100212 bolts with the hex key as shown in the manual. This 3D walkthrough identifies the bolts; turning and torque are not simulated.'}},notice='Nine 3D walkthrough steps: eight partial motion drafts and one tightening-check walkthrough. First two steps use a side-on working presentation; later steps retain the source orientation. The seat subassembly is raised for visibility until joining in step 9. Presentation offsets and distances are illustrative. Tools, thread engagement, tightening, hammering and height adjustment are not animated.')
    (ASSETS/'guide.json').write_text(json.dumps(guide,indent=2)+'\n')
    (ASSETS/'reference.json').write_text(json.dumps(reference,indent=2)+'\n')
    for name in ('LICENSE.md','UPSTREAM-README.md'):(ASSETS/name).write_bytes((ROOT/'web/assets/lack'/name).read_bytes())
    with pymupdf.open(ASSETS/'manual.pdf') as doc:
        for i,page in enumerate(doc):page.get_pixmap(matrix=pymupdf.Matrix(1.3,1.3),alpha=False).save(ASSETS/f'manual-page-{i+1}.png')
        page=doc[7]
        for name,clip in [('join',pymupdf.Rect(0,0,page.rect.width,415)),('adjust',pymupdf.Rect(0,415,page.rect.width,page.rect.height))]:
            page.get_pixmap(matrix=pymupdf.Matrix(1.5,1.5),clip=clip,alpha=False).save(ASSETS/f'step-9-{name}.png')
        for number,page_number in enumerate([4,4,5,5,6,6,7,7,8],1):
            page=doc[page_number-1];rect=page.rect
            if number<=6:
                split={4:415,5:455,6:330}[page_number]
                clip=pymupdf.Rect(0,0 if number%2 else split,rect.width,split if number%2 else rect.height)
            elif number in (7,8):
                clip=pymupdf.Rect(0 if number==7 else rect.width/2,0,rect.width/2 if number==7 else rect.width,rect.height)
            else:clip=rect
            page.get_pixmap(matrix=pymupdf.Matrix(1.5,1.5),clip=clip,alpha=False).save(ASSETS/f'step-{number}.png')
    print('DALFRED:33 source nodes;9 manual steps;8 partial motion drafts.')

if __name__=='__main__':build()
