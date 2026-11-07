"""Fetch the two pinned 1.7.10 source-mirror files used for vanilla dyes.

This mirror is static reference material, not the installed runtime registry.
Content is accepted only after SHA-256 verification against this manifest.
"""
import hashlib
from pathlib import Path
from urllib.request import urlopen

COMMIT = 'c01d23eb05ed83abb4fee00f9bf603b6bc3e2e27'
BASE = 'https://raw.githubusercontent.com/eldariamc/client/' + COMMIT + '/src/main/java/net/minecraft/item/crafting/'
FILES = {
    'RecipesDyes.java': '4ac9446a8f3cc5c87853757d56314f8abbc470479146a65b0999a0bf6c708032',
    'FurnaceRecipes.java': '73afaefa958a8ddb24b248ea93fd4a58d60388ea62015250bfdc28505fba7834',
}


def acquire(root):
    directory = Path(root) / '.local/vanilla-reference'
    directory.mkdir(parents=True, exist_ok=True)
    sources = {}
    for name, expected in FILES.items():
        path = directory / name
        content = path.read_bytes() if path.exists() else urlopen(BASE + name, timeout=30).read()
        if hashlib.sha256(content).hexdigest() != expected:
            raise ValueError('Vanilla reference SHA-256 mismatch: ' + name)
        if not path.exists():path.write_bytes(content)
        sources[BASE + name] = expected
    return sources


if __name__ == '__main__':
    for url, digest in acquire(Path(__file__).resolve().parents[1]).items():
        print(digest, url)
