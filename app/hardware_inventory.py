"""Compare a reviewed manual inventory with source labels and actual plan coverage."""

def hardware_audit(reference, manual, plan):
    for name in ('model.glb', 'manual.pdf'):
        key = 'model_sha256' if name == 'model.glb' else 'manual_sha256'
        if manual[key] != reference['files'][name]['sha256']:
            raise ValueError('Manual hardware inventory does not match the source assets')
    families = []
    for item in manual['parts']:
        ids = [part['node_index'] for part in reference['parts'] if part['category'] == 'hardware' and part['node_name'].split('_')[0] == item['part_number']]
        visible = [step.printed_step or index+1 for index,step in enumerate(plan.steps) if set(ids) & set(step.visible_node_ids)]
        moving = [step.printed_step or index+1 for index,step in enumerate(plan.steps) if set(ids) & {track.node_index for track in step.tracks}]
        families.append({**item, 'source_node_ids':ids, 'source_quantity':len(ids), 'quantity_matches':len(ids)==item['quantity'],
                         'first_visible_step':min(visible) if visible else None, 'animated_in_steps':moving})
    matched = {index for family in families for index in family['source_node_ids']}
    return {'origin':'source-label audit against assistant-transcribed manual page 7', 'families':families,
            'manual_loose_piece_count':sum(item['quantity'] for item in manual['parts']),
            'matched_source_piece_count':len(matched),
            'unmatched_source_hardware_ids':[part['node_index'] for part in reference['parts'] if part['category']=='hardware' and part['node_index'] not in matched],
            'limitations':['A matching named-node inventory does not validate fitting engagement or physical completeness.',
                          'Unnumbered panel-joint features are not separate named hardware nodes and are not independently animated.',
                          'Wall screws, drill/tools and optional supports are not modelled.']}
