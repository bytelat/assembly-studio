import json
import re
from html.parser import HTMLParser

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.product_catalog import product_guide
from app.animation_schema import AnimationPlan

class Controls(HTMLParser):
    def __init__(self):super().__init__();self.controls=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag in ('button','select','input'):self.controls.append((tag,attrs.get('id'),attrs.get('type')))


def test_every_product_uses_identical_template_controls_and_controller():
    client=TestClient(app);controls=[];scripts=[]
    for url in ['/','/eket.html','/dalfred.html']:
        response=client.get(url);assert response.status_code==200
        parser=Controls();parser.feed(response.text);controls.append(parser.controls)
        scripts.append(re.search(r'<script type="module" id="assembly-entry">(.*?)</script>',response.text,re.S).group(1))
        guide=json.loads(re.search(r'<script id="product-guide-data" type="application/json">(.*?)</script>',response.text,re.S).group(1))
        AnimationPlan.model_validate(guide['plan'])
        assert '▶ Play all steps' in response.text and 'Ⅱ Pause' in response.text
        assert len(guide['products'])==3
    assert controls[0]==controls[1]==controls[2]
    assert scripts[0]==scripts[1]==scripts[2]


@pytest.mark.parametrize('slug,count',[('lack',10),('eket',11),('dalfred',9)])
def test_registered_products_supply_data_to_shared_model_and_player_routes(slug,count):
    guide=product_guide(slug);plan=AnimationPlan.model_validate(guide['plan'])
    assert len(plan.steps)==count
    assert guide['product']['chunk_bytes']<=262144
    client=TestClient(app)
    assert client.get(f'/assembly/{slug}').status_code==200
    response=client.get(guide['product']['model_url'],headers={'Range':'bytes=0-15'})
    assert response.status_code==206 and response.content[:4]==b'glTF'
    assert response.headers['Content-Length']=='16'


def test_lack_adapter_preserves_all_four_connector_leg_pairs():
    guide=product_guide('lack');plan=AnimationPlan.model_validate(guide['plan'])
    from app.demo import DEMO
    for i,connection in enumerate(DEMO['connections']):
        assert plan.steps[1+i*2].tracks[0].node_index==connection['connector_node']
        assert plan.steps[2+i*2].tracks[0].node_index==connection['leg_node']
    assert len(plan.steps[-1].visible_node_ids)==9
    assert guide['overview_steps']==[1,10]


def test_unknown_product_cannot_access_model_or_player():
    client=TestClient(app)
    assert client.get('/assembly/unknown').status_code==404
    assert client.get('/models/unknown.glb').status_code==404


def test_another_registered_guide_uses_shared_ui_without_new_frontend(tmp_path,monkeypatch):
    import app.product_catalog as catalog
    from pathlib import Path
    source=catalog.ROOT/'web/assets/dalfred'
    directory=tmp_path/'web/assets/new-fixture';directory.mkdir(parents=True)
    guide=json.loads((source/'guide.json').read_text())
    guide['plan']['steps']=guide['plan']['steps'][:3]
    guide['plan']['product_id']='new-fixture'
    (directory/'guide.json').write_text(json.dumps(guide))
    (directory/'reference.json').write_bytes((source/'reference.json').read_bytes())
    (directory/'model.glb').symlink_to(source/'model.glb')
    (directory/'manual.pdf').symlink_to(source/'manual.pdf')
    monkeypatch.setattr(catalog,'ROOT',tmp_path)
    monkeypatch.setitem(catalog.PRODUCTS,'new-fixture',{'name':'New fixture','article':'test','url':'/assembly/new-fixture','advanced':None})
    response=TestClient(app).get('/assembly/new-fixture')
    assert response.status_code==200
    payload=json.loads(re.search(r'<script id="product-guide-data" type="application/json">(.*?)</script>',response.text,re.S).group(1))
    assert len(payload['plan']['steps'])==3
    assert len(payload['products'])==4
    assert payload['product']['model_url'].startswith('/models/new-fixture.glb?v=')
    assert 'id="assembly-entry"' in response.text


@pytest.mark.parametrize('slug',['lack','eket','dalfred'])
def test_model_json_parts_are_normal_200_responses_with_exact_original_bytes(slug):
    import base64
    from app.product_catalog import model_path
    client=TestClient(app)
    response=client.get(f'/model-data/{slug}/0')
    assert response.status_code==200
    assert 'Content-Encoding' not in response.headers
    body=response.json()
    assert body['offset']==0 and body['total']==model_path(slug).stat().st_size
    with model_path(slug).open('rb') as handle:expected=handle.read(65536)
    assert base64.b64decode(body['data'])==expected
    assert int(response.headers['Content-Length'])<90000
    assert client.get(f'/model-data/{slug}/1').status_code==416
