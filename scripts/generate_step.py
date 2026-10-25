"""Make one explicit generation request and preserve its returned envelope unchanged."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import urllib.error
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--product', default='eket-70332124')
parser.add_argument('--page', type=int, default=8)
parser.add_argument('--server', default='http://127.0.0.1:8000')
parser.add_argument('--printed-step', default='1')
parser.add_argument('--previous-run', type=Path)
parser.add_argument('--motion-version', type=int, choices=[1,2], default=1)
args = parser.parse_args()
previous = json.loads(args.previous_run.read_text())['plan'] if args.previous_run else None
request = urllib.request.Request(args.server.rstrip('/') + '/api/animation/generate',
    data=json.dumps({'product_id': args.product, 'source_page': args.page, 'printed_step': args.printed_step, 'previous_plan': previous, 'motion_version': args.motion_version}).encode(),
    headers={'Content-Type': 'application/json'}, method='POST')
try:
    with urllib.request.urlopen(request, timeout=135) as response:
        payload = response.read()
except urllib.error.HTTPError as error:
    raise SystemExit(f'Generation returned HTTP {error.code}: {error.read().decode()}')
output = Path(__file__).resolve().parent.parent / 'data/animation-runs'
output.mkdir(parents=True, exist_ok=True)
path = output / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
path.write_bytes(payload)
result = json.loads(payload)
print('Preserved response:', path)
print('Origin:', result['origin'], '| Status:', result['review_status'])
print('Reason:', result.get('reason', ''))
if result.get('plan'):
    step = result['plan']['steps'][0]
    print('Step:', step['title'])
    print('Moving nodes:', [track['node_index'] for track in step['tracks']])
    print('Uncertainties:', len(step['uncertainties']))
