import type { Pos } from "../map/basemap.js";

/** Local metres around the Sarkhej Roza tomb (x east, z south) and the cinematic camera path. No three.js here, so the street page
 *  chrome can use it without loading the 3D engine. */
export const ORIGIN: Pos = [72.50547, 22.99351];
export const MX = 111_320 * Math.cos((ORIGIN[1] * Math.PI) / 180), MY = 110_540;
/** lon/lat -> local metres [x, z] (z points south, as in three.js with y up). */
export const toLocal = ([lon, lat]: Pos): [number, number] => [(lon - ORIGIN[0]) * MX, -(lat - ORIGIN[1]) * MY];

// --- cinematic camera: a drone descent, a walk through the Roza premises, then out along Sarkhej Roza Road -----------------
export interface Shot { pos: [number, number, number]; look: [number, number, number]; caption?: string; sub?: string }
const L = (p: Pos, y: number): [number, number, number] => { const [x, z] = toLocal(p); return [x, y, z]; };
export const TOUR: Shot[] = [
  { pos: L([72.5032, 22.9905], 170), look: L([72.50547, 22.99351], 0), caption: "Makarba, Ahmedabad", sub: "Sarkhej Roza and its tank from the south-west" },
  { pos: L([72.5040, 22.9918], 70), look: L([72.50547, 22.99351], 8) },
  { pos: L([72.5049, 22.9926], 22), look: L([72.50547, 22.99351], 10), caption: "Sarkhej Roza", sub: "The tomb of Shaikh Ahmed Khattu Ganj Bakhsh, 1445–1451" },
  { pos: L([72.50525, 22.99292], 1.7), look: L([72.50552, 22.99313], 3), caption: "Courtyard around the Baradari", sub: "Children play here and people sit in the open courtyard" },
  { pos: L([72.50565, 22.99318], 1.7), look: L([72.50595, 22.99352], 1) },
  { pos: L([72.50585, 22.99338], 1.7), look: L([72.5062, 22.9935], 0.6), caption: "Waiting for food", sub: "People sit along this edge for the food offered in the Roza premises" },
  { pos: L([72.5066, 22.99342], 1.7), look: L([72.5072, 22.99325], 1.6) },
  { pos: L([72.5072, 22.99318], 1.7), look: L([72.50756, 22.99306], 1.2), caption: "Fruit seller on Sarkhej Roza Road", sub: "Trading from the same spot by the road" },
  { pos: L([72.5085, 22.99345], 1.8), look: L([72.5105, 22.99368], 2) },
  { pos: L([72.5105, 22.9933], 45), look: L([72.50547, 22.99351], 0) },
  { pos: L([72.5098, 22.9905], 160), look: L([72.50547, 22.99351], 0), caption: "Makarba 360°", sub: "Walk the streets yourself, or explore the map" },
];
