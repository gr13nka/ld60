# Sources of the body mesh

`man.glb` is the body of the player, dressed in `src/man.js`. Prepared 2026-10-06.

- **Author:** Quaternius, "Ultimate Modular Men" pack.
- **Licence:** CC0 1.0 (public domain dedication), so no attribution is required. https://creativecommons.org/publicdomain/zero/1.0/
- **Listed at:** https://poly.pizza/m/gKLBoRsyKe (the hoodie variant) and the pack's casual variant on the same site.

Two files of the pack were used. Both carry the same 62-joint skeleton in a T-pose (the
inverse bind matrices differ by under 1e-4), which is what lets their meshes share one skin.

| File | Taken | Dropped |
|---|---|---|
| https://static.poly.pizza/bcd66ec5-5e81-4901-a222-47abc875fe2a.glb (hoodie) | `Casual_Body` as `Body`: the hoodie (`Purple`) and the hands (`Skin`), and the skeleton | `Casual_Legs` (shorts, bare legs), `Casual_Feet`, `Casual_Head`, the idle animation |
| https://static.poly.pizza/90a9e2d4-053f-42f1-99a2-8f5e1180ea7f.glb (casual) | `Casual2_Legs` as `Legs`: full-length trousers (`LightBlue`); `Casual2_Feet` as `Feet`: soles (`White`) and the upper (`Red_Dark`) | `Casual2_Body`, `Casual2_Head`, its skeleton and animations |

Also dropped from what was kept: texture coordinates, vertex colours and every material but the
five named above. `man.js` repaints those five (blue suit, skin, white soles, pale canvas upper)
and lays the white stripes and the laces on afterwards; the head is the game's own.
