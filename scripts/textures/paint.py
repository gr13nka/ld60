"""Draws the wear of a surface into one picture: src/textures/wear.jpg.

Made here from noise, nothing taken from anywhere. Each channel is a different wear, laid by
`shading.js` over every grained surface:

- red, lumps: a height of soft round bulges and a few hollows of many sizes pressed into one
  another, as kneaded clay or Vangers' ground. Nothing reads it since the clay look went
  (2026-10-16), and before that it held brush strokes. It is still drawn, and drawn first, so
  that the generator gives the other two as they were: the eggs look wears them;
- green, streaks: dark runs down a wall where rain carried the grime, mostly nothing, gathered
  in groups;
- blue, patches: broad blotches about mid-grey, where the dirt lies thicker or the paint is newer.

Every pattern wraps round, so the tile repeats with no seam. Saved without chroma subsampling,
or each channel would bleed into the others at half size.

    python3 -E scripts/textures/paint.py <out.jpg> [seed]
"""
import sys

import numpy as np
from PIL import Image

SIZE = 1024
WIDE = SIZE / 512 # how much larger the slow patterns are drawn than at the first size, so that they keep their size on a tile
LUMPS = 700 # bulges and hollows pressed into the tile
LUMP_RADIUS = (18, 150) # pixels; at a 6 m tile, 10 cm to 90 cm across: small ones many, big ones few
LUMP_HOLLOW = 0.15 # the share of them pressed in rather than standing out
LUMP_SPREAD = 0.17 # one standard deviation of the height from mid-grey, of the whole range
STREAK_FILL = 0.6 # standard deviations of the run noise below which there is no streak: higher is sparser
PATCH_SPREAD = 0.18


def blurred(rng, sigma_x, sigma_y=None):
    """White noise blurred by a Gaussian through the Fourier transform, which wraps as the tile does; scaled to unit spread."""
    sigma_y = sigma_x if sigma_y is None else sigma_y
    fy = np.fft.fftfreq(SIZE)[:, None]
    fx = np.fft.fftfreq(SIZE)[None, :]
    kernel = np.exp(-2 * np.pi ** 2 * ((sigma_x * fx) ** 2 + (sigma_y * fy) ** 2))
    field = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((SIZE, SIZE))) * kernel))
    return (field - field.mean()) / field.std()


def lumps(rng):
    # The highest dome at each point, not their sum: summed, so many overlapping read as cloud,
    # and taken as the highest they stand as rounded bulges pressed against each other; a few
    # hollows are pressed into them after.
    height = np.zeros((SIZE, SIZE))
    radii = np.exp(rng.uniform(np.log(LUMP_RADIUS[0]), np.log(LUMP_RADIUS[1]), LUMPS)) # small ones many: uniform in the logarithm
    for radius in radii:
        cx, cy = rng.uniform(0, SIZE, 2)
        reach = int(radius) + 1
        ys = np.arange(int(cy) - reach, int(cy) + reach + 1)
        xs = np.arange(int(cx) - reach, int(cx) + reach + 1)
        d2 = ((xs[None, :] - cx) ** 2 + (ys[:, None] - cy) ** 2) / radius ** 2
        dome = np.sqrt(np.clip(1 - d2, 0, 1)) * np.sqrt(radius) * rng.uniform(0.6, 1.0)
        rows, cols = (ys % SIZE)[:, None], (xs % SIZE)[None, :]
        if rng.random() < LUMP_HOLLOW: # pressed in softly: a dome's steep rim cut a ring
            height[rows, cols] -= 0.35 * np.clip(1 - d2, 0, 1) ** 2 * np.sqrt(radius)
        else:
            height[rows, cols] = np.maximum(height[rows, cols], dome)
    return np.clip(0.5 + (height - height.mean()) / height.std() * LUMP_SPREAD, 0, 1)


def streaks(rng):
    runs = blurred(rng, 2.5 * WIDE, 60 * WIDE) # thin across, long down
    groups = np.clip(blurred(rng, 30 * WIDE) * 0.7 + 0.3, 0, 1) # where the runs gather
    return np.clip((runs - STREAK_FILL) / 1.5, 0, 1) * groups


def patches(rng):
    field = blurred(rng, 40 * WIDE) + 0.5 * blurred(rng, 16 * WIDE) + 0.25 * blurred(rng, 6 * WIDE)
    return np.clip(0.5 + (field - field.mean()) / field.std() * PATCH_SPREAD, 0, 1)


def main(out, seed='7'):
    rng = np.random.default_rng(int(seed))
    packed = np.stack([lumps(rng), streaks(rng), patches(rng)], axis=-1)
    Image.fromarray(np.round(packed * 255).astype(np.uint8)).save(out, quality=82, subsampling=0)
    print(out, [round(float(packed[..., c].mean()), 3) for c in range(3)])


if __name__ == '__main__':
    main(*sys.argv[1:3])
