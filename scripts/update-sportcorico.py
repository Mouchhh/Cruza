"""Fetch the public U17 table. Fail closed and preserve the last valid snapshot."""
import json, re, urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE = 'https://www.sportcorico.com/clubs/st-mayennais-fc/mayenne-stade-fc-17'
OUTPUT = Path(__file__).resolve().parents[1] / 'data/sportcorico-u17.json'

def parse_page(html):
    match = re.search(r'<script\b[^>]*\bid="__NUXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not match:
        raise ValueError('Sportcorico: Nuxt data absent')
    nodes = json.loads(match[1])
    if not isinstance(nodes, list) or len(nodes) > 100000:
        raise ValueError('Sportcorico: invalid payload')
    def decode(index, depth=0):
        if depth > 40 or not isinstance(index, int):
            raise ValueError('Sportcorico: invalid reference')
        if index < 0:
            return None
        value = nodes[index]
        if isinstance(value, dict):
            return {key: decode(ref, depth + 1) for key, ref in value.items()}
        if isinstance(value, list):
            if value and isinstance(value[0], str):
                if value[0] not in ('Reactive', 'ShallowReactive', 'Ref', 'ShallowRef', 'Set'):
                    raise ValueError('Sportcorico: unknown Nuxt wrapper')
                return decode(value[1], depth + 1) if len(value) > 1 else []
            return [decode(ref, depth + 1) for ref in value]
        return value
    root = nodes[1]  # Standard Nuxt root object, referenced by ShallowReactive.
    if nodes[0] != ['ShallowReactive', 1] or not isinstance(root, dict):
        raise ValueError('Sportcorico: unexpected root')
    data = decode(root['data'])
    team_data = data['team-mayenne-stade-fc-17']
    team = team_data['team']
    if team['slug'] != 'mayenne-stade-fc-17' or team['category']['name'] != 'U17':
        raise ValueError('Sportcorico: unexpected team')
    tables = [table for table in team_data['rankings'] if any(line.get('team_id') == team['id'] for line in table['lines'])]
    if len(tables) != 1:
        raise ValueError('Sportcorico: missing or ambiguous championship')
    table = tables[0]
    rows = []
    for line in table['lines']:
        row = {key: line[key] for key in ('rank', 'points', 'games_played', 'difference', 'team', 'team_id')}
        if any(type(row[k]) is not int for k in ('rank', 'points', 'games_played', 'difference', 'team_id')):
            raise ValueError('Sportcorico: non-numeric table')
        if not 1 <= row['rank'] <= 100 or not 0 <= row['games_played'] <= 200 or not isinstance(row['team'], str) or not 1 <= len(row['team']) <= 200:
            raise ValueError('Sportcorico: invalid row')
        rows.append(row)
    if not 2 <= len(rows) <= 80 or len({r['rank'] for r in rows}) != len(rows) or len({r['team_id'] for r in rows}) != len(rows):
        raise ValueError('Sportcorico: invalid table')
    return {'version': 1, 'sourceURL': SOURCE, 'teamSlug': team['slug'], 'teamId': team['id'],
            'teamName': team['club_name'] + ' ' + team['name_generated'], 'category': 'U17',
            'season': team_data['current_season']['label'], 'competition': table['championship_name'],
            'pool': table['pool_name'], 'rows': sorted(rows, key=lambda r: r['rank'])}

def main():
    request = urllib.request.Request(SOURCE, headers={'Accept': 'text/html', 'User-Agent': 'CRUZA-ranking/1.0 (public club standings)'})
    with urllib.request.urlopen(request, timeout=25) as response:
        if response.url != SOURCE or response.status != 200:
            raise ValueError('Sportcorico: unexpected response')
        content = response.read(4000001)
    if len(content) > 4000000:
        raise ValueError('Sportcorico: response too large')
    data = parse_page(content.decode('utf-8'))
    data['fetchedAt'] = datetime.now(timezone.utc).isoformat()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(OUTPUT)
    print('Sportcorico: saved validated public table,', len(data['rows']), 'teams')

if __name__ == '__main__':
    main()
