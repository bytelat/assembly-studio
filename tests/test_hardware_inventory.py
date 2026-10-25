import copy
import json
from pathlib import Path

import pytest

from app.animation_api import context
from app.animation_schema import AnimationPlan
from app.hardware_inventory import hardware_audit


def inputs():
    source = context('eket-70332124')
    manual = json.loads((source['directory']/'manual-hardware.json').read_text())
    steps = []
    for number in range(1,12):
        steps.append({'kind':'manual_reference','printed_step':number,'title':'audit fixture','instruction':'audit only','source_pages':[7],
            'duration_seconds':1,'visible_node_ids':[1]+[p['node_index'] for p in source['reference']['parts'] if p['category']=='hardware' and number>=6],
            'tracks':[],'warnings':[],'uncertainties':[]})
    from app.animation_api import fixture
    identity = fixture()['plan']; identity['steps']=steps
    return source['reference'],manual,AnimationPlan.model_validate(identity)


def test_all_manual_loose_hardware_has_named_source_geometry():
    ref, manual, plan = inputs()
    audit = hardware_audit(ref,manual,plan)
    assert audit['manual_loose_piece_count']==audit['matched_source_piece_count']==16
    assert len(audit['families'])==6
    assert all(item['quantity_matches'] for item in audit['families'])
    assert not audit['unmatched_source_hardware_ids']
    assert {item['part_number'] for item in audit['families'] if item['manual_step']==11}=={'152650','152651'}
    assert all(not item['animated_in_steps'] for item in audit['families'])


def test_inventory_mismatches_are_reported_and_wrong_sources_rejected():
    ref,manual,plan=inputs()
    manual=copy.deepcopy(manual);manual['parts'][0]['quantity']=5
    assert not hardware_audit(ref,manual,plan)['families'][0]['quantity_matches']
    manual['manual_sha256']='0'*64
    with pytest.raises(ValueError,match='source assets'):
        hardware_audit(ref,manual,plan)
