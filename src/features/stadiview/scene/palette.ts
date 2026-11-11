/**
 * The colours of the 3D scene.
 *
 * `SV` is the "Prestige Graduation Night" palette itself, the same six colours the HUD uses.
 * `PAINT` holds the surface colours derived from it: darker and greyer mixes for concrete, grass
 * and track, so that the palette's pure colours stay reserved for what matters (seats, the
 * lettering, light and gold accents).
 *
 * Lit surfaces are multiplied by the scene's light, so they come out darker than written here away
 * from the floodlights and close to it under them.
 */
export const SV = {
  night: '#061A17',
  deep: '#005A50',
  green: '#009C5A',
  gold: '#E7A614',
  sand: '#E8DEC3',
  white: '#FFFFFF',
} as const

export const PAINT = {
  // Ground, from the far land inward.
  land: '#0A1F1B',
  apron: '#1C302C',
  infield: '#0F4A3C',
  grassLight: '#1A5E33',
  grassDark: '#16522C',
  track: '#6A6146',
  trackLine: '#E8DEC3',
  pitchLine: '#B9B6A6',

  // The seating floor on the pitch.
  aisle: '#0D2622',
  pad: '#17382F',
  runner: '#00594F',

  // Stands and other structures.
  tread: '#27413C',
  riser: '#1B302C',
  wall: '#16302B',
  wallDark: '#0E211E',
  fascia: '#00483F',
  platform: '#31504A',
  canopyTop: '#12292A',
  canopyUnder: '#6B5A2E',
  column: '#1C3531',
  steel: '#22383A',

  // The stage.
  deckTop: '#0C3F38',
  deckSide: '#0A2420',
  podium: '#0A2B27',

  // Self-lit accents.
  gold: SV.gold,
  goldDim: '#8A6410',
  lamp: '#FFF3D0',
  warm: '#F2C56C',
  band: '#0E7A4B',
  window: '#C9A24A',

  // The campus beyond the stadium.
  campus: '#0B2420',
  campusLight: '#102E29',
} as const

/** The march carpet: crimson with gold trims (decision F). */
export const CARPET = { crimson: '#7A1A2C', trim: '#E7A614' } as const
