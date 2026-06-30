# Werewolf Full-Cast Avatar Prompts — English (Gemini-optimized)

English version of the avatar prompts, tuned for Gemini image models (Imagen / "Nano Banana").
Chinese source: [avatar-generation-prompts.md](avatar-generation-prompts.md). Background removal: https://rmbg.fun/

## How to use with Gemini

- Gemini image models have **no CFG Scale / sampler / step-count controls** — those Doubao settings are intentionally dropped here. Just paste the prompt.
- Set the **aspect ratio to 1:1** in the Gemini image options.
- Each block below is a **complete standalone prompt** (shared style + character subject + negatives folded in). Copy one block and generate.
- If a checkerboard/transparent or busy background still appears, append: `isolated on pure white background, studio product shot, flat solid white backdrop, no shadows, crisp subject edges, no scene whatsoever`.

## Shared style (already embedded in every block)

> Official Werewolf (Mafia) trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, human characters keep a normal face shape with balanced features (rounded chin, no pointed chin, no elongated or distorted face), dramatic expression and body language, coarse hand-drawn hatching for shadows, dark eerie yet playful mood, high detail, rich hand-drawn texture. Isolated on a pure white background, clean flat solid white backdrop, no scene, no environment, no texture, crisp subject edges for easy cut-out. 1:1 square format, centered composition, tight half-body bust crop, single subject filling ~80% of the frame, consistent figure scale across all characters.

## Universal negative prompt

```
text, watermark, logo, signature, extra borders, picture frame, blur, low quality, low resolution, deformed, bad proportions, distorted features, pointed chin, long face, wedge-shaped face, extra limbs, missing fingers, extra fingers, chibi, cute moe style, anime, photorealistic photo, 3D render, smooth digital painting, cel shading, neon colors, cyberpunk, oversaturated fluorescent colors, transparent background, checkerboard background, checkerboard pattern, mosaic transparency, gradient background, paper background, scene background, environment background, textured background, busy background, black background, dark background, colored background, any visible scene, image noise specks, overly glossy render, vector art, stiff lines, overexposed, underexposed, cluttered elements
```

---

## I. Villager Faction

### 1. Villager (villager)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A lowly medieval peasant man wearing a coarse brown belted tunic and a patched cloak, empty hands clutching the cloak tightly, cowering in fear, frightened eyes darting around in terror, shoulders hunched and shrinking, a weathered plain face frozen in dread, dirt smudged on the cheeks, straw caught in the hair. Color palette: earthy brown, dark ochre, dark green.
```

### 2. Mirror Seer (mirrorSeer)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A mysterious seer holding an ornate magic mirror, the mirror glowing an eerie pale blue and reflecting a twisted inverted image opposite to reality, wearing a seer's robe with a subtle asymmetrical design, a confused suspicious expression, one eye refracting a different reflection in the mirror. Color palette: dark blue, grey-brown.
```

### 3. Drunk Seer (drunkSeer)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A tipsy fortune-teller, disheveled, wearing a wine-stained purple seer's robe, one hand raising a flickering unstable crystal ball, the other gripping a wine cup, hazy unfocused eyes struggling to concentrate, flushed cheeks, a crooked pointed hat tilted askew. Color palette: deep purple, wine red, amber.
```

---

## II. God / Special Faction

### 4. Seer (seer)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A hooded wise prophet draped in robes, the deep hood casting shadow over a weathered face, both hands cradling a bright crystal ball glowing blue-violet, a faintly glowing third-eye mark on the forehead, a sharp all-seeing gaze that pierces all deception, flowing dark robes painted with arcane runes. Color palette: deep blue-violet with gold accents.
```

### 5. Witch (witch)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. An elegant dark witch alchemist, beautiful but cold and aloof, wearing a dark hooded cloak and corset, one hand holding a vial of green glowing antidote, the other holding a vial of purple smoking poison, a sharp calculating gaze, golden long hair falling from the hood. Color palette: deep red, burnt orange, with green and purple potion accents.
```

### 6. Hunter (hunter)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A rugged wilderness ranger hunter, a scarred tough man wearing leather armor and a fur-lined cloak, a heavy crossbow strapped to his back, one hand gripping a hunting knife, a battle scar across the bridge of his nose and cheek, fierce determined eyes, a hawk perched on his shoulder. Color palette: earthy brown, deep green, rust.
```

### 7. Guard (guard)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A vigilant night watchman, a sturdy cloaked guard standing watch in the dark, one hand gripping a heavy iron door-bar, the other holding a lantern glowing with warm protective light, alert eyes scanning the night for danger, a leather armor vest over a plain tunic, a ring of iron keys on the belt. Color palette: warm lantern amber, deep brown, iron grey.
```

### 8. Idiot (idiot)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. The village idiot, a dull-witted peasant man with a blank vacant grin and empty eyes staring into nothing, mouth slightly open, straw tangled in messy matted hair, wearing an oversized ill-fitting tunic full of patches slipping off the shoulder, one hand holding a wooden stick mistaking it for a sword, utterly oblivious to surrounding danger. Color palette: muted brown, faded yellow, dull grey.
```

### 9. Knight (knight)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A valiant paladin duelist wearing ornate silver full plate armor with a flowing crimson cape, one hand pointing a gleaming longsword forward in a dueling-challenge stance, a noble solemn face revealed through an open visor, intricate carved engravings on the breastplate, the blade faintly radiating holy light. Color palette: silver, crimson, gold accents.
```

### 10. Magician (magician)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. An elegant stage magician illusionist wearing a top hat, a formal vest with a dramatic cape and white gloves, one hand making a magical gesture with glowing particles (symbolizing swap and substitution) spinning between the fingers, the other holding a slender wand, a mysterious charming smile, a monocle on one eye. Color palette: deep burgundy, black, gold accents.
```

### 11. Witcher (witcher)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A silver-haired witcher monster-hunter, a cold ruthless assassin-type killer with white hair and cat-like vertical pupils, wearing black studded leather armor, gripping a rune-etched silver sword faintly glowing, a monster-trophy medallion around the neck, anti-venom rune tattoos on neck and arms, multiple scars on the body. Color palette: black, dark silver, with faint blue rune glow.
```

### 12. Psychic (psychic)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A medium psychic, a mysterious figure with face veiled in translucent gauze, multiple eye symbols on the forehead and open palms, surrounded by ghostly wisps of soul-fire and spectral aura, a tattered ethereal robe, glowing eye markings. Color palette: deep indigo, ghostly pale green, purple.
```

### 13. Dreamcatcher (dreamcatcher)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A dreamcatcher dream-guardian, an otherworldly ethereal figure wearing a robe decorated with stars and crescent moons, holding a woven dreamcatcher emitting soft light, serene half-closed eyes, a dreamy transcendent aura, dream bubbles and stardust particles floating around, a moon-adorned celestial headdress. Color palette: midnight blue, silver, lavender.
```

### 14. Graveyard Keeper (graveyardKeeper)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A graveyard keeper, a gaunt weathered old man wearing a tattered hooded cloak, holding a lantern burning with eerie blue-green ghost flame, deep-set eyes, a worn shovel resting on his shoulder, a weary aged face carrying the secrets of the dead. Color palette: deep grey, moss green, ghostly blue-green lantern light.
```

### 15. Pure White Maiden (pureWhite)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A holy white-robed purifying priestess, a serene yet dangerous saintly maiden wearing a flowing white gown and a silver crown, radiating white-gold holy light all around, seemingly gentle and harmless yet her eyes holding the firm resolve of purifying judgment, one hand stretched forward releasing a beam of holy light. Predominantly white and silver in stark contrast with dark shadows, with pale gold and white accents.
```

### 16. Dancer (dancer)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A captivating dark dancer witch, a seductive woman wearing a flowing translucent crimson and dark purple dance dress, frozen mid-spin, magical light ribbons trailing from her fingertips, a beautiful yet dangerous alluring face, spinning arcane runes encircling her body. Color palette: deep red, dark purple, golden light ribbons.
```

### 17. Silence Elder (silenceElder)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A silent ancient elder sage, a venerable old man with white hair and beard wearing an ancient wizard hat, one finger firmly pressed to his lips in a hush gesture, sealing-magic light glimmering at fingertip and lips, holding a gnarled wooden staff carved with a silence-rune crystal, an inherently awe-inspiring dignified aura. Color palette: aged brown, dark purple, faint blue sealing glow.
```

### 18. Voteban Elder (votebanElder)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A stern decree-judging elder, a serious authoritative elderly council head, one hand holding a decree scroll stamped with a red wax seal, the other holding an iron gavel, a stern judgmental expression, ban-sealing runes inscribed on the robe, a glowing red prohibition symbol floating beside the hand. Color palette: deep red, iron grey, aged parchment tones.
```

### 19. Sequence Prince (sequencePrince)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A haughty young prince and time-manipulator wearing a deep blue and dark silver royal uniform, an exquisite hourglass emblem on the chest, one hand raising a pocket watch glowing with counterclockwise blue light, its hands spinning in reverse, the other wearing an iron gauntlet engraved with a royal crest making a halting gesture, a cold young face with undeniable authority in the brow, reversed spinning time-gear phantoms faintly appearing behind. Color palette: deep blue, dark silver, cold gold, with pale blue time-magic glow.
```

---

## III. Werewolf Faction

### 20. Werewolf (wolf)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A horrifying half-man half-wolf werewolf with a bristling mane, bared fangs, splayed razor claws, eyes glowing dark red, a muscled sinewy beast silhouetted in faint moonlight, the menacing aura of a ferocious predator, fur rendered with coarse hand-drawn hatching. Color palette: black, dark red, silver moonlight highlights.
```

### 21. Wolf Queen (wolfQueen)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A seductive wolf queen dark siren, a stunning woman wearing an ornate deep red and dark purple noble gown, a flawless human face hiding subtle fangs and beastly vertical pupils, thorny rose vines and dark roses adorning her body, an alluring deadly aura. Color palette: deep red, dark purple, black, with rose accents.
```

### 22. White Wolf King (wolfKing)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. The werewolf king and chieftain, a massive mighty half-man half-wolf with a corrupted golden crown embedded on the wolf's head, larger and stronger than ordinary wolves, dark gold armor fragments on shoulders and chest, radiating savage authority and dominance. Color palette: dark gold, blood red, black.
```

### 23. Dark Wolf King (darkWolfKing)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A shadow wolf king assassin-sniper, a sinister werewolf wearing all-black armor and a black hooded cloak, holding a dark crossbow wreathed in black shadow energy, only a single red glowing eye visible under the hood, black energy tendrils coiling around the weapon. Color palette: pure black, deep grey, with red eye accent.
```

### 24. Nightmare (nightmare)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic proportions, dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A nightmare entity, the embodiment of living fear, a smoke-like body condensed from dark mist, a twisted distorted face emerging from the mist with hollow eyes and a gaping mouth, disproportionately huge hands reaching forward, deep purple and black nightmare energy swirling and coiling. Color palette: deep purple, black, sickly pale highlights.
```

### 25. Gargoyle (gargoyle)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic proportions, dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A stone-disguised gargoyle lurker, a creature with grey stone-textured skin in the classic cathedral-gargoyle crouching pose, bat wings half-folded, body appearing as carved stone yet the eyes alive and sinister, glowing red, motionlessly watching and waiting, cracks on the stone surface. Color palette: limestone grey, dark shadows, with red glowing-eye accents.
```

### 26. Awakened Gargoyle (awakenedGargoyle)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic proportions, dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. An awakened gargoyle bursting with power, standing upright with wings fully spread, stone skin cracking and shattering apart, lava and fiery glow shining through the cracks, flames pouring from eye sockets and mouth, full of aggression and explosive energy. Color palette: limestone grey with fiery orange-red bursting through the cracks.
```

### 27. Blood Moon Apostle (bloodMoon)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A blood-moon cult fanatic priest, a fervent dark priest wearing a deep red sacrificial robe, blood-red ritual runes and marks painted all over skin and cloth, a huge blood-red moon floating behind like a halo, both hands cradling a bleeding chalice with blood dripping, eyes devout to the point of madness. Color palette: blood red, deep crimson, black.
```

### 28. Wolf Robot (wolfRobot)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic proportions, dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A steampunk mechanical-wolf hybrid, a half-machine half-wolf creature, exposed metal skeleton and gears fused with wolf anatomy, one eye a red mechanical scanning lens, the other a beastly wolf eye, steam pipes and clockwork gear mechanisms visible on the body, dark iron and brass construction, dark steampunk mechanical aesthetic. Color palette: dark iron, brass, rust, with red mechanical-eye glow.
```

### 29. Wolf Witch (wolfWitch)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A corrupted male dark-sorcerer wolf-witch, a twisted dark male warlock holding sinister dark red and venomous green potion vials, face partly obscured by a tattered half-mask and hood, wolf-totem tattoos and wolf-clan markings on the corrupted robe, a sinister vicious aura. Color palette: dark red, venomous green, black.
```

### 30. Spirit Knight (spiritKnight)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic proportions, dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A spirit knight undead rider, a phantom knight consumed by blue-green ghost soul-fire, void darkness beneath the broken shattered armor, only flickering ghost flame in the eye sockets, an ethereal translucent form, spectral energy dripping from the armor seams. Color palette: ghostly blue-green, deep black, ghostly pale highlights.
```

### 31. Masquerade (masquerade)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A mysterious masquerade figure wearing an exquisite ornate masquerade mask covering half the face, the mask one half beautiful and one half twisted and ugly (symbolizing faction reversal), wearing elegant dark formal attire, fingers delicately holding another floating mask, an unsettling ambiguous aura. Color palette: deep gold, dark purple, black, with mask-detail accents.
```

### 32. Warden (warden)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A sinister prison warden jailer, a dungeon keeper with a cold cruel face, wearing a heavy warden's uniform studded with iron nails and buckles, one hand gripping a large ring of heavy iron keys, the other holding thick iron chains and shackles, iron bars and chain elements surrounding him, an oppressive intimidating authority. Color palette: iron grey, deep brown, rust, with cold steel highlights.
```

### 33. Eclipse Wolf Queen (eclipseWolfQueen)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A dark eclipse wolf-consort and night protector, a noble cold and elegant woman wearing an ornate gown woven of deep blue and pitch black, the hem fading into a starry sky and eclipse pattern, a dark silver crown shaped like a waning crescent, one hand stretched forward unfolding a translucent protective barrier condensed from dark blue moonlight, the other hand gracefully drawn to her chest, the barrier refracting faint blue-violet light, a stunning face with wolf-clan vertical pupils and faintly bared fangs, eyes like a moon devoured by eclipse radiating dim blue light. Color palette: deep blue, pitch black, dark silver, with eclipse blue-violet glow.
```

### 34. Hidden Wolf (hiddenWolf)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A perfectly disguised lone-wolf spy, outwardly a gentle refined young traveler wearing a plain greyish-brown traveling cloak and tunic, a handsome harmless face with a kind smile, but beastly claws and a tail tip faintly showing beneath the cloak, one pupil flashing a vertical slit for an instant in the shadows, three faint wolf-shadow phantoms hovering behind, an overall aura of lonely wildness hidden under a perfect disguise. Color palette: greyish-brown, dark brown, cold grey, with faint amber wolf-eye accents.
```

---

## IV. Third-Party Faction

### 35. Slacker (slacker)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A lazy good-for-nothing drifter, a listless indifferent vagrant leaning against an invisible wall, eyes half-open half-closed and full of drowsiness, sloppy messy clothes, tousled hair, one hand lazily spinning a die, an utterly careless attitude, no faction allegiance. Color palette: amber, dark earthy brown, dark olive.
```

### 36. Wild Child (wildChild)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A wild child raised by wolves, a young untamed boy wearing animal hides and fur garments, barefoot, wild tangled hair, one hand playing with a small wolf-cub companion, innocent big eyes flickering with a dangerous wildness that could turn ferocious at any moment. Color palette: wild green, earthy brown, wolf-grey fur tones.
```

### 37. Piper (piper)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A sinister pied-piper hypnotist, a dark bard playing an ornate magic flute, golden and purple musical notes and hypnotic spiral sound-waves flowing from the instrument, wearing a dark version of a colorful bard-jester costume, eyes radiating hypnotic spiral patterns. Color palette: deep purple, dark gold, amber, with hypnotic spiral accents.
```

### 38. Shadow (shadow)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic proportions, dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. An eerie shadow mimic, a mysterious figure with a blurred indistinct form, face hidden in the shadow of a deep black hood with only a pair of peering eyes visible, draped in an ink-black cloak whose edges dissolve into flowing shadow smoke, one hand reaching out in a mimicking gesture, shadowy black threads trailing from the fingertips, the body outline faint like a living shadow. Color palette: pure black, deep grey, dark purple shadow.
```

### 39. Avenger (avenger)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. An enraged vengeful warrior, a scarred lone fighter wearing broken tattered dark red leather armor and bloodstained bandages, one hand gripping a serrated short sword inscribed with vows of vengeance, the other clenched into a fist, fierce determined eyes burning with an undying flame of revenge, a deep scar across the corner of the eye, dark red threads of fated bonds coiling around the body. Color palette: dark red, charred black, rust, with fiery orange-red highlights.
```

### 40. Crow (crow)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A gloomy crow messenger curser, a gaunt somber dark messenger draped in a black feather cloak woven of real crow feathers, a large crow perched on the shoulder, all black with eyes glowing eerie purple, one hand raising a crow-quill pen radiating dark purple curse light, ink-black curse runes dripping from the tip, a pale gaunt face, a sinister gaze in deep-set eye sockets, a hooked nose like a beak. Color palette: pitch black, dark purple, crow blue-black sheen.
```

### 41. Masked Man (maskedMan)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A mysterious masked warrior guardian, a burly resolute man wearing a dark silver iron mask covering the entire face, ancient guardian runes carved on the mask, only a pair of calm steady eyes visible through the mask slits radiating faint silver light, wearing heavy dark leather armor with a deep grey long cape, an old healed dark scar faintly visible on the chest, one hand resting on the chest scar, the other holding a small iron shield engraved with thorn patterns, an overall steady mountain-like posture. Color palette: dark silver, deep grey, rust red, with faint blue rune glow.
```

### 42. Poisoner (poisoner)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A cold dark poison-master, a gaunt male alchemist wearing a leather gas mask covering half the face, revealing a pair of calm calculating eyes, wearing a deep grey robe covered in chemical stains and burn marks, one hand carefully raising a skull-marked poison vial fuming with venomous green smoke, the other wearing corroded blackened leather gloves, vials and grinding tools of various sizes hanging at the waist, poison smoke curling up from the vial mouth. Color palette: venomous green, dark grey, charred black, with skull-white accents.
```

### 43. Treasure Master (treasureMaster)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A cunning master-thief treasure hunter, an agile phantom thief wearing a black eye-mask covering the upper face, revealing a confident sly smile, wearing tight dark leather armor with a flowing dark red cape, one hand deftly flipping three glowing mysterious identity cards between the fingers, the cards radiating golden and purple magic light, the other hand hidden under the cape, exquisite lockpicking tools and a gem pouch at the waist. Color palette: dark gold, deep red, black, with jewel-like purple and emerald green accents.
```

### 44. Thief (thief)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A sneaky night thief, a lean agile masked pickpocket wearing a dark face cloth covering the lower face, revealing only a pair of sly alert eyes, wearing tight dark grey leather armor with a short cape, one hand deftly drawing two glowing identity cards from the shadows while hesitating to choose, the other hand hidden behind holding a curved blade, lockpicking tools and a small grappling hook at the waist, moving lightly like a cat. Color palette: dark grey, deep brown, moonlight silver, with faint golden card-magic glow.
```

### 45. Cupid (cupid)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A dark version of Cupid the love god, a mischievous yet dangerous little-angel figure with a pair of broken tattered dark wings, wearing a worn classical short tunic, one hand drawing a delicate small bow and arrow, the arrowhead radiating deep red fate-light, the other hand with dark red threads symbolizing lovers' bonds coiling between the fingers, an innocent yet scheming smile, messy curly hair, a crooked little halo faintly flickering above the head. Color palette: deep red, dark pink, dark gold, with rose-red glow of fate threads.
```

### 46. Cursed Fox (cursedFox)

```
Official Werewolf trading-card illustration, Tim Burton-style dark whimsical fairytale aesthetic, vintage American hand-drawn illustration, loose pencil linework, watercolor wash coloring, distressed rough paper texture, fine film-grain noise, naturalistic realistic proportions, normal balanced human features (rounded chin, no pointed/elongated face), dramatic expression, coarse hand-drawn hatching, dark eerie yet playful mood, high detail. Isolated on a pure white background, clean flat solid white backdrop, no scene, no texture, crisp edges for cut-out. 1:1 square, centered, tight half-body bust crop, subject fills ~80% of frame. A cunning curse-fox spirit (victory-stealer), a half-human half-fox eerie creature with erect pointed ears and a fluffy dark red fox tail showing beneath the cloak, wearing a deep red and dark gold Eastern-style robe, a charming yet sinister face, a malicious smile at the corner of the mouth, vertical pupils radiating amber demonic light, one palm hovering a fox-fire orb encircled by dark red curse runes, the other hand gracefully tucked in a wide sleeve, faint curse characters and fox-fire floating around the body. Color palette: dark red, amber gold, deep purple, with orange-red fox-fire glow.
```

---

### Fallback tip (if a checkerboard / busy background still appears)

Append this to the end of the affected character's prompt: `isolated on pure white background, studio product shot, flat solid white backdrop, no shadows, crisp subject edges, absolutely no scene or environment`. Also make sure the universal negative prompt is fully applied.

```

```
