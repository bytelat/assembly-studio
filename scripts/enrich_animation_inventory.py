"""Record source transforms and axis-aligned bounds; does not infer assembly motion."""
import itertools
import json
import math
from pathlib import Path

from inspect_lack import read_glb

ASSETS = Path(__file__).resolve().parent.parent / 'web/assets/eket'
gltf = read_glb(ASSETS / 'model.glb')
parents = {child: index for index, node in enumerate(gltf['nodes']) for child in node.get('children', [])}


def rotate(vector, quaternion):
    x, y, z, w = quaternion
    norm = math.sqrt(x*x + y*y + z*z + w*w)
    x, y, z, w = [value / norm for value in quaternion]
    vx, vy, vz = vector
    tx, ty, tz = 2*(y*vz-z*vy), 2*(z*vx-x*vz), 2*(x*vy-y*vx)
    return [vx+w*tx+y*tz-z*ty, vy+w*ty+z*tx-x*tz, vz+w*tz+x*ty-y*tx]


nodes = []
for index, node in enumerate(gltf['nodes']):
    if 'mesh' not in node:
        continue
    accessors = [gltf['accessors'][p['attributes']['POSITION']] for p in gltf['meshes'][node['mesh']]['primitives']]
    minimum = [min(a['min'][axis] for a in accessors) for axis in range(3)]
    maximum = [max(a['max'][axis] for a in accessors) for axis in range(3)]
    position = node.get('translation', [0, 0, 0])
    scale = node.get('scale', [1, 1, 1])
    quaternion = node.get('rotation', [0, 0, 0, 1])
    corners = []
    for corner in itertools.product(*zip(minimum, maximum)):
        rotated = rotate([v*s for v, s in zip(corner, scale)], quaternion)
        corners.append([v+p for v, p in zip(rotated, position)])
    nodes.append({'node_index': index, 'name': node['name'], 'parent_node': parents.get(index), 'translation_m': position,
                  'rotation_xyzw': quaternion, 'scale': scale,
                  'bounds_in_parent_m': {'min': [min(c[a] for c in corners) for a in range(3)], 'max': [max(c[a] for c in corners) for a in range(3)]}})
result = {'product_id': 'eket-70332124', 'coordinate_space': 'source_node_parent_meters',
          'note': 'Offsets are added in each node parent coordinate system, not in camera or mesh-local axes. All bounds are derived from source geometry; no path is inferred.', 'nodes': nodes}
(ASSETS / 'animation-inventory.json').write_text(json.dumps(result, indent=2)+'\n')
print(f'Recorded source transforms and bounds for {len(nodes)} EKET nodes.')
