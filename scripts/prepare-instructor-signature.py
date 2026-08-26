#!/usr/bin/env python3
"""Gera instructor-signature.png (fundo preto -> transparente) para certificados."""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print('Instale Pillow: pip install pillow')
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SRC = ROOT / 'apps' / 'api' / 'src' / 'training' / 'bundled' / 'instructor-signature-source.png'
DST = ROOT / 'apps' / 'api' / 'src' / 'training' / 'bundled' / 'instructor-signature.png'


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.is_file():
        print(f'Arquivo nao encontrado: {src}')
        print('Salve a assinatura escaneada como instructor-signature-source.png ou passe o caminho.')
        return 1
    img = Image.open(src).convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r < 55 and g < 55 and b < 55:
                px[x, y] = (r, g, b, 0)
    DST.parent.mkdir(parents=True, exist_ok=True)
    img.save(DST)
    print(f'OK: {DST} ({DST.stat().st_size} bytes)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
