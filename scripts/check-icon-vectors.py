"""Check XML and drawable vector content in every catalog SVG on disk."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
failures=[]
files=sorted((ROOT/'src/assets/gtnh').glob('*.svg'))+sorted((ROOT/'src/assets/ui').glob('*.svg'))
for file in files:
    try:
        tree=ET.parse(file)
        tags=[element.tag.rsplit('}',1)[-1] for element in tree.iter()]
        if tags[0]!='svg':raise ValueError('not an SVG document')
        if 'image' in tags:raise ValueError('embedded bitmap')
        if not any(tag in tags for tag in ['path','rect','circle','ellipse','polygon','polyline','line']):
            raise ValueError('no vector artwork')
    except (ET.ParseError,ValueError) as error:
        failures.append({'file':file.name,'error':str(error)})
print(json.dumps({'checked':len(files),'failures':failures}))
raise SystemExit(bool(failures))
