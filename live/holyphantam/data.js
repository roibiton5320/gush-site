// Static tables from the plugin source (Pantam.h, Theme.h, Layer.h, Shadow.h, GrainCloud.h) and the editor's help texts.
window.PH = (function () {
  const C = { ground: '#E4D8C4', paper: '#F1E7D6', panel: '#F7EFE2', ink: '#2E2720', muted: '#8A7C68', line: '#DDCFB9',
    copper: '#B2622F', copperSoft: '#EED3B8', steel: '#5F574D', glow: '#E0884A', keyWhite: '#FBF4E8' };

  // Steel: [hi, mid, lo, word, name]
  const STEELS = {
    Stainless: ['#D9DADA', '#A9ACAE', '#7E8285', 'bright', 'Stainless'],
    Ember: ['#9C7A63', '#6E4E3C', '#47322A', 'burnished', 'Ember'],
    Brass: ['#D9C08A', '#B08E52', '#7C6234', 'golden', 'Brass'],
    Glass: ['#E3E8EA', '#BCC6CB', '#8E9AA0', 'glassy', 'Glass'],
    Wood: ['#CFA27C', '#A06B45', '#6E442A', 'honeyed', 'Wood'],
    Bronze: ['#B7A46E', '#857245', '#564A2B', 'patina', 'Bronze'],
    Nitrided: ['#8B8279', '#5A534D', '#3A3531', 'warm', 'Nitrided'],
  };

  const INSTRUMENTS = [
    ['Nitrided Warm', 'Nitrided', 'The classic. Warm fundamental, soft fifth, six-second ring.'],
    ['Nitrided Dark', 'Nitrided', 'Rounder and hushed. Highs rolled off, fundamental forward.'],
    ['Stainless Bell', 'Stainless', 'Long sustain and bright partials. Rings like a bell.'],
    ['Stainless Air', 'Stainless', 'High and airy. The octave leads, the fundamental whispers.'],
    ['Ember Low', 'Ember', 'Deep and burnished, built for the lower register.'],
    ['Ember Soft', 'Ember', 'Felt-soft attack, like playing with the pads of the fingers.'],
    ['Brass Gong', 'Brass', 'Inharmonic shimmer over the tuned core. Half gong.'],
    ['Brass Temple', 'Brass', 'Bright, singing partials. Temple-bell attack.'],
    ['Mutant Deep', 'Nitrided', 'Extra bass fields under the ding. Sub weight.'],
    ['Glass Ding', 'Glass', 'Fragile and clear. Short body, crystalline top.'],
    ['Rain Steel', 'Stainless', 'Short and dry. For rhythmic, rain-like patterns.'],
    ['Halo', 'Glass', 'Very long and wide. Almost a pad, still a pantam.'],
    ['Deep Bass', 'Ember', 'A pantam an octave below the floor. Warm, slow, felt in the chest.'],
    ['Tongue Drum', 'Nitrided', "Steel tongues, round and hollow. The pantam's closest cousin."],
    ['Kalimba Tines', 'Wood', 'Thumb-plucked tines on wood. Pure, sweet, a bright tick.'],
    ['Singing Bowl', 'Bronze', 'Bronze bowl, long and wobbling. Its partials beat slowly.'],
    ['Glass Harmonica', 'Glass', 'Wet fingers on glass. A pure tone that swells in.'],
    ['Gamelan Bronze', 'Bronze', 'A bronze key, hard mallet. Clashing shimmer, a slow beat.'],
    ['Bronze Kettle', 'Bronze', 'A small kettle gong. A sung note in a dark ring.'],
    ['Marimba Wood', 'Wood', 'Rosewood bars over pipes. Warm, dry, soft mallets.'],
    ['Hollow Log', 'Wood', 'A slit log drum. A deep, short, woody knock.'],
  ].map(a => ({ name: a[0], steel: a[1], description: a[2] }));

  const SCALES = [
    ['Kurd', [0, 7, 8, 10, 12, 14, 15, 17, 19]], ['Celtic Minor', [0, 7, 10, 12, 14, 15, 17, 19, 22]],
    ['Hijaz', [0, 7, 8, 11, 12, 14, 15, 17, 19]], ['Integral', [0, 7, 8, 10, 12, 14, 15, 19]],
    ['Amara', [0, 7, 10, 12, 14, 15, 19, 22]], ['Pygmy', [0, 3, 5, 7, 10, 12, 14, 15, 19]],
    ['Low Pygmy', [0, 5, 7, 8, 12, 15, 17, 19, 20]], ['Aegean', [0, 4, 7, 11, 12, 16, 18, 19, 23]],
    ['Equinox', [0, 3, 7, 8, 10, 12, 14, 15, 19]], ['Mystic', [0, 7, 10, 12, 14, 17, 19, 22]],
    ['Golden Gate', [0, 4, 7, 9, 11, 12, 14, 16, 19]], ['Annaziska', [0, 7, 8, 12, 14, 15, 17, 19, 20]],
    ['Sabye', [0, 4, 7, 9, 11, 12, 14, 16, 18]], ['La Sirena', [0, 5, 7, 8, 10, 12, 14, 15, 17]],
    ['Magic Voyage', [0, 5, 7, 8, 12, 14, 15, 17, 19]], ['Ysha Savita', [0, 7, 8, 12, 14, 15, 19, 20]],
    ['Oxalis', [0, 5, 7, 9, 12, 14, 16, 17, 19]], ['Akebono', [0, 2, 3, 7, 8, 12, 14, 15, 19]],
    ['Ashakiran', [0, 7, 9, 11, 12, 14, 16, 19, 21]], ['Major', [0, 7, 9, 11, 12, 14, 16, 17, 19]],
  ].map(a => ({ name: a[0], offsets: a[1] }));

  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const TECH = ['Finger', 'Thumb', 'Slap', 'Harmonic', 'Ghost'];
  const DIVS = ['1/1', '1/2', '1/4', '1/4D', '1/8', '1/8T', '1/8D', '1/16'];
  const INTERVALS = ['Octave down', 'Two octaves', 'Fifth down'];
  const GRAINS = ['1/32', '1/16', '1/8', '1/4'];
  const HALOS = ['Cloud', 'Shimmer', 'Reverse', 'Scatter', 'Stutter', 'Freeze'];
  const noteName = m => NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const keyNames = []; for (let k = 21; k <= 108; k++) keyNames.push(noteName(k));
  const fieldNames = ['Ding']; for (let f = 1; f < 10; f++) fieldNames.push('Field ' + f);

  // Where field i of an n-field pantam sits on the unit circle (Pantam.h fieldPosition).
  function fieldPos(i, n) {
    if (i <= 0 || n <= 1) return [0, 0];
    const k = n - 1, j = i - 1, order = [0]; let count = 1;
    for (let s = 1; count < k && count < 16; ++s) { order[count++] = s; if (count < k && count < 16) order[count++] = k - s; }
    const ang = 1.57079633 + order[j < 16 ? j : 15] * 6.28318531 / k;
    return [Math.cos(ang) * 0.64, Math.sin(ang) * 0.64];
  }

  // Help texts, verbatim from PluginEditor.cpp.
  const HELP = {
    layerPrev: 'Previous instrument in the collection, on this layer.',
    layerNext: 'Next instrument in the collection, on this layer.',
    layerRoll: 'Roll this layer: a new instrument, material, envelope, halo and filter. Undo takes it back.',
    mute: 'Mute this layer. Its echo and space tails ring out; the player keeps playing silently.',
    solo: 'Solo: hear this layer alone. Soloing another layer moves the solo there.',
    layerFader: "This layer's level: drag up or down (Shift for fine), or scroll. Double-click: back to where it started. The solid copper is the sound itself.",
    layerTab: 'Click to edit this layer.',
    presetPrev: 'Previous preset: the factory ones, then yours.',
    presetNext: 'Next preset: the factory ones, then yours.',
    presetSave: 'Save this sound as your own preset (kept in this browser).',
    presetName: 'Click the name for every preset: Init, the factory sounds, the strange ones and yours.',
    undo: 'Undo: back to the sound before the last preset or roll of the dice.',
    redo: 'Redo.',
    rollAll: 'Roll everything: every layer that is on, the space, the echo, sometimes the ring. Undo takes it back.',
    settings: 'Settings: about this demo.',
    play: 'Starts and stops the generative player on every layer set to Generative or Both.',
    tech: 'How the hand plays: Finger, Thumb (rounder), Slap (choked), Harmonic, Ghost. Keyswitches C0 to E0.',
    stage: 'Play the pantam: click a field. Nearer its centre is a firmer hit.',
    instPrev: 'Previous instrument in the collection.',
    instNext: 'Next instrument in the collection.',
    collection: 'The whole collection, to choose by hand.',
    soundTab: 'The sound of this layer.',
    playerTab: 'The generative player, the scale and the keys of this layer.',
    diceMaterial: 'Roll the material: bright, hit, metal.',
    diceEnvelope: 'Roll the envelope: attack, decay, sustain, release.',
    diceHalo: 'Roll the halo: its character, amount, afterglow and motion.',
    diceFilter: 'Roll the filter.',
    diceSends: 'Roll how much of this layer goes to the echo, the space and the shadow.',
    dicePlayer: 'Roll the player: style, rate, phrases, touch.',
    diceSpace: 'Roll the space: amount, size, shimmer.',
    diceShadow: 'Roll the shadow: interval, grain, amount.',
    diceEcho: 'Roll the echo: two note values, feedback, spill, tone.',
    diceRing: 'Roll the ring: carrier, bend, mix, wander, feedback.',
    spaceOff: 'Space on or off. Off: the sound leaves the Cosmos and stands dry; its knobs keep their places.',
    shadowOff: 'Shadow on or off. Off: nothing sounds under the notes; its settings wait.',
    echoOff: 'Echo on or off. Off: no repeats; the ones already ringing fade out.',
    ringOff: 'Ring and Bend on or off. Off: the metal is whole again; its settings wait.',
    filterType: "The filter's type: LP keeps what is under the cutoff, BP a band around it, HP what is above.",
    voicing: 'Poly: every note rings. Mono: one note at a time. Legato: a held note slides to the next key without a new strike.',
    filterGraph: 'The filter, drawn. Drag the lower point for the cutoff, the peak for the resonance, the copper dot on the left for the high-pass. Double-click to open it; double-click the copper dot to turn the high-pass off.',
    inf: 'Release forever: let go of the key and the note stays. Click again for a 4 s release.',
    adsr: 'The envelope is the length of every note. Drag the points. Release at its end is forever.',
    halo: 'What the halo is: Cloud, Shimmer (octaves up), Reverse, Scatter, Stutter, or Freeze.',
    keyboard: 'The whole keyboard, A0 to C8. The copper band is this layer\'s key range, dots are its scale.',
    style: 'Random, Wander (neighbours, now and then a leap), Motif (a loop that grows), Arp.',
    mode: 'MIDI: only your keys. Generative: only the player. Both: the player, and your held keys become its notes.',
    lock: 'Snap keys: every key you play lands on the scale.',
    scaleLock: 'Lock the scale: every layer plays this root and scale, and it stays when you change presets. Unlock: each layer goes back to its own.',
    // knobs by short id
    bright: 'Dark to bright: how much of the upper partials the strike has.',
    hit: 'Soft to hard: the pad of a finger at the centre, or a hard hit at the edge.',
    metal: 'Pantam, then bell (up to the middle), then gong and glass: where the strange sounds live.',
    cloudMix: 'How much halo over the strikes.',
    afterglow: 'How long the halo outlives the strike. At the end, forever.',
    motion: 'The halo moves: brightness, place and grain size drift slowly, the grains scatter further.',
    breathRate: 'Theta breath: the whole instrument beats at this rate. 4 to 8 Hz is theta.',
    breathDepth: 'How strongly it breathes.',
    width: 'How wide this layer is: every field from where it sits on the instrument.',
    level: "This layer's level.",
    pan: "This layer's place, left to right.",
    sendDelay: 'How much of this layer goes to the echo.',
    sendSpace: 'How much of this layer goes to the space.',
    sendShadow: 'How much of this layer goes to the shadow: grains of it, deep under the sound.',
    transpose: "Semi: move this layer's pitch in semitones.",
    pitchOct: 'Octave: move everything this layer sounds up or down, keys and player alike.',
    drive: 'Drive: push the layer into the filter. A little thickens it, a lot growls.',
    keyTrack: 'Key track: the cutoff follows the note, so high notes stay as open as low ones.',
    glide: 'Glide: each new note slides in from the last one. Off at the left.',
    bendRange: 'Bend: how far the pitch wheel bends, in semitones.',
    velLevel: 'How much your touch decides the level. 0: every note equally loud.',
    velBright: 'How much your touch opens the tone. 0: every note equally bright.',
    fine: 'Fine tuning in cents.',
    rate: 'Strikes per second, when not synced.',
    chance: 'How often a tick really plays.',
    ding: 'How often the player returns to the ding.',
    velocity: "The player's touch.",
    dynamics: 'How much the touch varies.',
    chord: 'Now and then a second field at once.',
    roll: 'Now and then a quick roll on one field.',
    phrase: 'Notes before a rest. 0 never rests.',
    rest: 'How long the rests are.',
    evolve: 'Motif: how often a note of the loop changes.',
    // master
    spaceAmount: 'How far inside the space you are.',
    spaceSize: 'How long the space rings: 50% to 200%.',
    shimmer: 'An octave rising inside the space.',
    shadowAmount: "How loud the shadow is. Each layer's Shadow send decides what goes in.",
    delayFb: 'How many echoes. The left side rings longer than the right.',
    delaySpill: "How much of each side's echoes crosses to the other ear.",
    delayTone: 'Dark to bright echoes.',
    ringFreq: "The ring's carrier: under 30 Hz a tremolo, above it broken metal.",
    ringBend: "How far the carrier bends, and how much the ring's pitch warps.",
    ringMix: 'How much of the ring. 0 is off.',
    ringWander: 'How restless the carrier is: a slow drift on the left, digital chaos on the right.',
    ringFeedback: "The ring rings itself: the metal screams at the carrier's pitch.",
    strange: 'STRANGE pulls every layer somewhere stranger: metal, detune, odd notes, odd grains.',
    drift: 'DRIFT: the sound wanders by itself, slowly. Effects, filters and halo. Your hand always wins.',
    masterWidth: 'Width of the whole instrument. The bass always stays in the middle.',
    tune: 'Tuning of A4 for every layer.',
    volume: 'Master volume.',
    delayDiv: 'The left echo, as a note value of the host tempo.',
    delayDivR: 'The right echo, as a note value of the host tempo. Different from the left, the echoes move.',
    shadowInterval: 'How far below the sound the shadow sits: an octave, two octaves or a fifth.',
    shadowGrain: 'How long each grain of the shadow is, as a note value of the host tempo.',
    download: 'Get the plugin, free.',
  };

  return { C, STEELS, INSTRUMENTS, SCALES, NOTE, TECH, DIVS, INTERVALS, GRAINS, HALOS, noteName, keyNames, fieldNames, fieldPos, HELP };
})();
