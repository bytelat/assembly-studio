import copy
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.animation_api import context, fixture, validate_source
from app.animation_schema import AnimationPlan
from app.main import app
from app.geometry_checks import geometry_review

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_provider_audit(monkeypatch, tmp_path):
    monkeypatch.setattr('app.animation_api.PROVIDER_DIRECTORY', tmp_path / 'provider-responses')


def plan():
    return copy.deepcopy(fixture()['plan'])


def test_fixture_is_explicit_and_source_bound():
    response = client.get('/api/animation/fixture')
    assert response.status_code == 200
    assert response.json()['origin'] == 'hand_authored_test_fixture'
    assert response.json()['human_edits']
    assert response.json()['review_status'] == 'unreviewed'
    data = response.json()['plan']
    assert validate_source(AnimationPlan.model_validate(data), context(data['product_id']))


@pytest.mark.parametrize('mutation', [
    lambda p: p['steps'][0]['tracks'][0].update(node_index=999),
    lambda p: p['steps'][0].update(source_pages=[21]),
    lambda p: p.update(model_sha256='0' * 64),
    lambda p: p.update(source_document='wrong-revision'),
    lambda p: p['steps'][0]['tracks'][0].update(from_offset_m=[float('nan'), 0, 0]),
    lambda p: p['steps'][0]['tracks'][0].update(to_offset_m=[1, 0, 0]),
    lambda p: p['steps'][0]['tracks'][0].update(start_fraction=.8, end_fraction=.5),
    lambda p: p['steps'][0]['tracks'][0].update(script='arbitrary code'),
    lambda p: p['steps'][0]['tracks'].append(p['steps'][0]['tracks'][0].copy()),
])
def test_bad_plans_never_reach_player(mutation):
    data = plan()
    mutation(data)
    # Raw body allows non-finite JSON to exercise the server's finite-value checks.
    response = client.post('/api/animation/validate', content=json.dumps(data), headers={'Content-Type': 'application/json'})
    assert response.status_code == 422


def test_imported_json_never_inherits_ai_authorship():
    response = client.post('/api/animation/validate', json=plan())
    assert response.status_code == 200
    assert response.json()['origin'] == 'imported_json'
    assert response.json()['human_edits']


def test_generation_requires_key_without_substituting_fixture(monkeypatch):
    monkeypatch.delenv('DEEPSEEK_API_KEY', raising=False)
    response = client.post('/api/animation/generate', json={'product_id': 'eket-70332124', 'source_page': 8})
    assert response.status_code == 503
    assert 'No AI animation has been generated' in response.json()['detail']
    assert 'plan' not in response.json()


def test_source_page_endpoint_and_schema():
    response = client.get('/api/animation/manual-page?product_id=eket-70332124&page=8')
    assert response.status_code == 200
    assert response.content.startswith(b'\x89PNG')
    assert client.get('/api/animation/manual-page?product_id=eket-70332124&page=21').status_code == 422
    assert client.get('/api/animation/manual-page?product_id=../../etc&page=1').status_code == 404
    assert client.get('/api/animation/schema').json()['additionalProperties'] is False


def test_noncontacting_panels_are_flagged_even_when_structure_is_valid():
    data = plan()
    data['steps'][0]['visible_node_ids'] = [3, 21]
    data['steps'][0]['tracks'][0]['node_index'] = 3
    validated = AnimationPlan.model_validate(data)
    review = geometry_review(validated, context('eket-70332124')['inventory'])
    assert review['issues']
    assert review['checks'][0]['final_bounds_gap_m'] > .3


def test_saved_result_loads_without_a_generation_call_and_keeps_review_separate(monkeypatch, tmp_path):
    monkeypatch.setattr('app.animation_api.RUNS_DIRECTORY', tmp_path)
    data = fixture()
    data['origin'] = 'deepseek'
    data['model'] = 'mocked-provider-test-only'
    data['human_edits'] = []
    path = tmp_path / '20261021T100000000001Z.json'
    path.write_text(json.dumps(data))
    original = path.read_bytes()
    path.with_suffix('.review.json').write_text(json.dumps({'decision': 'not_accepted', 'reasons': ['Mocked review']}))
    response = client.get('/api/animation/saved-result?product_id=eket-70332124')
    assert response.status_code == 200
    assert response.json()['separate_review']['decision'] == 'not_accepted'
    assert response.json()['human_edits'] == []
    assert path.read_bytes() == original
    assert client.get('/api/animation/saved-result?product_id=lack-30449908').status_code == 404


@pytest.mark.parametrize('decision_kind', ['draft', 'abstain', 'unknown_node', 'wrong_page', 'provider_error'])
def test_generation_provider_contract(monkeypatch, decision_kind):
    monkeypatch.setenv('DEEPSEEK_API_KEY', 'test-private-key')
    data = plan()
    data['steps'][0]['source_pages'] = [8]
    if decision_kind == 'unknown_node':
        data['steps'][0]['visible_node_ids'].append(999)
    if decision_kind == 'wrong_page':
        data['steps'][0]['source_pages'] = [9]
    decision = {'can_propose': decision_kind != 'abstain', 'reason': 'Mocked provider result for contract testing', 'plan': None if decision_kind == 'abstain' else data}
    monkeypatch.setattr('app.animation_api.page_png', lambda *_: b'test-image')

    class Provider:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, *, headers, json):
            assert headers['Authorization'] == 'Bearer test-private-key'
            assert url == 'https://api.deepseek.com/chat/completions'
            content = json['messages'][0]['content']
            assert sum(item['type'] == 'image_url' for item in content) == 3
            assert 'SOURCE MODEL INVENTORY' in content[0]['text']
            return httpx.Response(402 if decision_kind == 'provider_error' else 200, request=httpx.Request('POST', url), json={'choices': [{'message': {'content': __import__('json').dumps(decision)}}]})

    monkeypatch.setattr('app.animation_api.httpx.AsyncClient', Provider)
    response = client.post('/api/animation/generate', json={'product_id': 'eket-70332124', 'source_page': 8})
    assert 'test-private-key' not in response.text
    if decision_kind in ('draft', 'abstain'):
        assert response.status_code == 200
        assert response.json()['origin'] == 'deepseek'
        if decision_kind == 'abstain':
            assert response.json()['plan'] is None
            assert response.json()['review_status'] == 'needs_more_information'
        else:
            assert response.json()['plan']['steps'][0]['source_pages'] == [8]
            assert response.json()['human_edits'] == []
    else:
        assert response.status_code == 502


def test_composition_retains_context_and_rejects_redocking():
    previous = plan()
    following = plan()
    following['steps'] = following['steps'][:1]
    old = set(previous['steps'][-1]['visible_node_ids'])
    new = next(i for i in range(1, 22) if i not in old)
    following['steps'][0]['visible_node_ids'] = sorted(old | {new})
    following['steps'][0]['tracks'] = [{**following['steps'][0]['tracks'][0], 'node_index': new}]
    response = client.post('/api/animation/compose', json={'previous_plan': previous, 'next_plan': following})
    assert response.status_code == 200
    assert response.json()['origin'] == 'composed_draft'
    assert len(response.json()['plan']['steps']) == len(previous['steps']) + 1
    following['steps'][0]['visible_node_ids'].remove(next(iter(old)))
    assert client.post('/api/animation/compose', json={'previous_plan': previous, 'next_plan': following}).status_code == 422
    following['steps'][0]['visible_node_ids'] = sorted(old | {new})
    following['steps'][0]['tracks'][0]['node_index'] = next(iter(old))
    assert client.post('/api/animation/compose', json={'previous_plan': previous, 'next_plan': following}).status_code == 422


def test_invalid_previous_context_rejected_before_provider(monkeypatch):
    previous = plan()
    previous['manual_sha256'] = '0' * 64
    monkeypatch.delenv('DEEPSEEK_API_KEY', raising=False)
    response = client.post('/api/animation/generate', json={'product_id': previous['product_id'], 'source_page': 9,
        'printed_step': '2', 'previous_plan': previous})
    assert response.status_code == 422


def test_manual_reference_steps_are_explicit_and_cannot_claim_motion():
    data = plan()
    step = data['steps'][0]
    step['kind'] = 'manual_reference'
    step['printed_step'] = 5
    step['tracks'] = []
    parsed = AnimationPlan.model_validate(data)
    assert parsed.steps[0].kind == 'manual_reference'
    step['kind'] = 'motion'
    with pytest.raises(ValueError):
        AnimationPlan.model_validate(data)
    step['kind'] = 'manual_reference'
    step['tracks'] = plan()['steps'][0]['tracks']
    with pytest.raises(ValueError):
        AnimationPlan.model_validate(data)


def test_complete_guide_page_bundles_data_safely_without_extra_fetch(monkeypatch):
    from app.main import eket_page
    result = fixture()
    result['origin'] = 'composed_manual_guide'
    result['human_edits'] = ['</script><script>unsafe()</script> & < >']
    monkeypatch.setattr('app.main.saved_guide', lambda *_: result)
    html = eket_page().body.decode()
    marker = '<script id="saved-guide-data" type="application/json">'
    payload = html.split(marker, 1)[1].split('</script>', 1)[0]
    assert '<' not in payload
    bundled = json.loads(payload)
    assert bundled['plan'] == result['plan']
    assert bundled['human_edits'] == result['human_edits']
    assert bundled['provenance_download_url'].startswith('/api/animation/saved-guide')
    assert 'id="eket-reference-data"' in html
    assert 'id="load-full-guide"' in html


def test_eket_shell_paints_before_embedded_data_and_needs_no_external_entry():
    from app.main import eket_page
    html = eket_page().body.decode()
    assert html.index('<body>') < html.index('id="saved-guide-data"')
    assert '<script type="module" id="eket-entry">' in html
    assert 'src="/eket.js?' not in html
    assert '<link rel="stylesheet"' not in html


@pytest.mark.parametrize('moving_node,expected', [(4, 200), (2, 502)])
def test_reviewed_part_evidence_is_enforced_before_playback(monkeypatch, moving_node, expected):
    monkeypatch.setenv('DEEPSEEK_API_KEY', 'test-private-key')
    data = fixture(2)['plan']
    data['steps'] = data['steps'][:1]
    for track in data['steps'][0]['tracks']:
        for key in list(track):
            if key not in ('node_index', 'keyframes', 'interpolation'):
                del track[key]
    data['steps'][0]['tracks'][0]['node_index'] = moving_node
    decision = {'can_propose': True, 'reason': 'Mocked evidence-validation test', 'plan': data}
    monkeypatch.setattr('app.animation_api.page_png', lambda *_: b'test-image')

    class Provider:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, *, headers, json):
            prompt = json['messages'][0]['content'][0]['text']
            assert 'SEPARATE ASSISTANT-REVIEWED ACTION EVIDENCE' in prompt
            assert 'measured_shape_features' in prompt
            assert json['reasoning_effort'] == 'low'
            return httpx.Response(200, request=httpx.Request('POST', url), json={'choices': [{'message': {'content': __import__('json').dumps(decision)}, 'finish_reason': 'stop'}]})

    monkeypatch.setattr('app.animation_api.httpx.AsyncClient', Provider)
    response = client.post('/api/animation/generate', json={'product_id': data['product_id'], 'source_page': 9, 'printed_step': '3', 'motion_version': 2})
    assert response.status_code == expected
    if expected == 200:
        assert response.json()['input_evidence']['required_moving_node_ids'] == [4]
        assert response.json()['human_edits'] == []


def test_precompressed_viewer_has_fixed_length_and_negotiates_gzip():
    import gzip
    from starlette.requests import Request
    from app.main import bundled_viewer
    compressed = bundled_viewer(Request({'type':'http','headers':[(b'accept-encoding',b'gzip')]}))
    plain = bundled_viewer(Request({'type':'http','headers':[(b'accept-encoding',b'identity')]}))
    assert compressed.headers['content-encoding'] == 'gzip'
    assert int(compressed.headers['content-length']) == len(compressed.body)
    assert gzip.decompress(compressed.body) == plain.body
    assert 'content-encoding' not in plain.headers
