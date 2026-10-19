"""Packs the grain of three CC0 materials into one picture: src/textures/grain.jpg.

Each material's height (its Displacement map, the real relief; its Color map's brightness where
it has none) is taken with the slow changes out (so that a tile repeated over a wall shows no
blotch twice) and spread evenly about mid-grey: only the fine relief of the surface is kept,
never its colour. `shading.js` darkens and lightens a paint by it and, in a look with `relief`,
lights it as relief. Red is limewash, green concrete, blue painted plaster (`shading.js`'s
`GRAIN`). Saved without chroma subsampling, or each channel bleeds into the others at half size.
The sources are listed in src/textures/SOURCES.md.

    python3 -E scripts/textures/pack.py <folder with the three unpacked materials> <out.jpg> [size]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

MATERIALS = ['Plaster001', 'Concrete036', 'PaintedPlaster017'] # red, green, blue
SIZE = 1024 # unless said; the first grain was 512, from the 1K colour maps
SLOW = 1 / 12 # changes slower than this share of the tile are taken out
SPREAD = 0.16 # how far one standard deviation of the relief stands from mid-grey, of the whole range


def relief(path, size):
    image = Image.open(path).convert('L').resize((size, size), Image.LANCZOS)
    light = np.asarray(image, dtype=np.float64) / 255
    # A Gaussian blur through the Fourier transform, which wraps round as the tile does.
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.fftfreq(size)[None, :]
    sigma = SLOW * size
    kernel = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    slow = np.real(np.fft.ifft2(np.fft.fft2(light) * kernel))
    fine = light - slow
    return np.clip(0.5 + fine / fine.std() * SPREAD, 0, 1)


def main(folder, out, size=SIZE):
    folder = Path(folder)
    channels = []
    for name in MATERIALS:
        found = []
        for kind in ('Displacement', 'Color'):
            found = sorted(folder.glob(f'{name}*/*_{kind}.jpg')) or sorted(folder.glob(f'**/{name}*_{kind}.jpg'))
            if found:
                break
        if not found:
            sys.exit(f'no height or colour map for {name} under {folder}')
        channels.append(relief(found[0], int(size)))
        print(name, found[0].name)
    packed = np.stack(channels, axis=-1)
    Image.fromarray(np.round(packed * 255).astype(np.uint8)).save(out, quality=82, subsampling=0) # 92 was twice the size for no difference seen
    print(out, [round(float(c.mean()), 3) for c in channels])


if __name__ == '__main__':
    main(*sys.argv[1:4])
