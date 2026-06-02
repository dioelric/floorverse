import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { ArrowLeft, Move, Sun, Moon, Info, X, Home, Layers } from 'lucide-react';
import api from '../../services/api';

// ── Architectural constants ────────────────────────────────
const SCALE     = 0.015;
const WALL_H    = 2.8;
const WALL_T    = 0.15;
const PART_T    = 0.08;
const FLOOR_T   = 0.08;
const DOOR_W    = 0.9;
const DOOR_H    = 2.1;
const WIN_W     = 1.0;
const WIN_H     = 1.1;
const WIN_SILL  = 0.9;
const PARAPET_H = 0.9;   // balcony railing height
const RAIL_H    = 0.08;  // top rail thickness

const FLOOR_COLORS = {
  bedroom:    0xDBEAFE, bathroom:   0xFEF9C3, kitchen:    0xDCFCE7,
  living_room:0xEDE9FE, dining:     0xFCE7F3, balcony:    0xD1FAE5,
  study:      0xFEF3C7, utility:    0xF3F4F6, corridor:   0xE5E7EB,
};

const TYPE_LABELS = {
  bedroom:'Bedroom', bathroom:'Bathroom', kitchen:'Kitchen',
  living_room:'Living Room', dining:'Dining', balcony:'Balcony',
  study:'Study', utility:'Utility', corridor:'Corridor', other:'Room',
};

// ── Adjacency detection ────────────────────────────────────
function isExterior(rooms, room, side) {
  const eps = 3;
  return !rooms.some(other => {
    if (other.id === room.id) return false;
    const xOverlap = room.x < other.x + other.width  - eps
                  && room.x + room.width  > other.x  + eps;
    const yOverlap = room.y < other.y + other.height - eps
                  && room.y + room.height > other.y  + eps;
    switch (side) {
      case 'front': return Math.abs(room.y - (other.y + other.height)) < eps && xOverlap;
      case 'back':  return Math.abs((room.y + room.height) - other.y)  < eps && xOverlap;
      case 'left':  return Math.abs(room.x - (other.x + other.width))  < eps && yOverlap;
      case 'right': return Math.abs((room.x + room.width) - other.x)   < eps && yOverlap;
      default: return false;
    }
  });
}

// ── Low-poly furniture helpers ─────────────────────────────
// furn(scene, w,h,d, hexColor, centerX, bottomY, centerZ)
function furn(scene, w, h, d, hex, cx, by, cz) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: hex }),
  );
  m.position.set(cx, by + h / 2, cz);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  return m;
}

// ── Context helpers ────────────────────────────────────────
// Find the room touching a given side of this room
function getNeighbor(rooms, room, side) {
  const eps = 3;
  return rooms.find(other => {
    if (other.id === room.id) return false;
    const xOv = room.x < other.x + other.width  - eps && room.x + room.width  > other.x + eps;
    const yOv = room.y < other.y + other.height - eps && room.y + room.height > other.y + eps;
    switch (side) {
      case 'front': return Math.abs(room.y - (other.y + other.height)) < eps && xOv;
      case 'back':  return Math.abs((room.y + room.height) - other.y)  < eps && xOv;
      case 'left':  return Math.abs(room.x - (other.x + other.width))  < eps && yOv;
      case 'right': return Math.abs((room.x + room.width) - other.x)   < eps && yOv;
      default: return false;
    }
  }) || null;
}

const OPP_SIDE = { front:'back', back:'front', left:'right', right:'left' };
const ALL_SIDES = ['front','back','left','right'];

// Which side is the entrance? (the side that connects to the main flow: living/corridor/dining)
function getEntranceSide(rooms, room) {
  for (const s of ALL_SIDES) {
    const nb = getNeighbor(rooms, room, s);
    if (nb && ['living_room','corridor','dining'].includes(nb.room_type)) return s;
  }
  for (const s of ALL_SIDES) {
    const nb = getNeighbor(rooms, room, s);
    if (nb && nb.room_type !== 'bathroom') return s;
  }
  for (const s of ALL_SIDES) {
    if (!isExterior(rooms, room, s)) return s;
  }
  return 'front';
}

// Convert "entrance-relative" offsets to world X/Z
// axial  = along the entrance→bedwall axis  (+1 = toward far/bed wall)
// lateral = perpendicular to that axis       (+1 = to the right when facing bed wall)
function toWorld(entrance, rX, rZ, rW, rD, axial, lateral) {
  switch (entrance) {
    case 'front': return { x: rX + lateral, z: rZ + axial };   // depth = +Z
    case 'back':  return { x: rX - lateral, z: rZ - axial };   // depth = -Z
    case 'left':  return { x: rX + axial,   z: rZ - lateral }; // depth = +X
    case 'right': return { x: rX - axial,   z: rZ + lateral }; // depth = -X
    default:      return { x: rX + lateral, z: rZ + axial };
  }
}

// Half-extents of the room along axial and lateral axes for a given entrance
function roomHalves(entrance, rW, rD) {
  return (entrance === 'front' || entrance === 'back')
    ? { axial: rD / 2, lateral: rW / 2 }
    : { axial: rW / 2, lateral: rD / 2 };
}

// ── Bedroom ────────────────────────────────────────────────
function furnishBedroom(scene, rX, rZ, rW, rD, sqft, rooms, room) {
  const entrance  = getEntranceSide(rooms, room);
  const { axial: aH, lateral: lH } = roomHalves(entrance, rW, rD);
  const WM = WALL_T + 0.08;

  // Which side has the bathroom door? Avoid placing wardrobe there.
  const bathSide = ALL_SIDES.find(s => {
    const nb = getNeighbor(rooms, room, s);
    return nb && nb.room_type === 'bathroom';
  });
  // Lateral sign for wardrobe: prefer side WITHOUT bathroom
  // lateral +1 = right of entrance, -1 = left of entrance
  // Convert bathSide to a lateral direction relative to entrance
  const bathLateral = (() => {
    if (!bathSide) return null;
    switch (entrance) {
      case 'front': return bathSide === 'right' ? +1 : bathSide === 'left' ? -1 : null;
      case 'back':  return bathSide === 'left'  ? +1 : bathSide === 'right'? -1 : null;
      case 'left':  return bathSide === 'front' ? +1 : bathSide === 'back' ? -1 : null;
      case 'right': return bathSide === 'back'  ? +1 : bathSide === 'front'? -1 : null;
      default: return null;
    }
  })();
  const wdLateral = bathLateral === 1 ? -1 : 1; // wardrobe on opposite side from bath

  // ── Bed: headboard against far wall, centred laterally ──
  const bedLong = rW > 3.8 ? 1.8 : rW > 2.8 ? 1.5 : 1.0; // wide side of bed
  const bedShort = 2.0; // depth (axial direction)
  // Far-wall face (inside): aH - WM
  const bedAxialCenter = (aH - WM) - bedShort / 2;  // bed center from room center, axial
  const hbAxial = (aH - WM) + 0.045;               // headboard center, against far wall

  // Bed frame
  {
    const p = toWorld(entrance, rX, rZ, rW, rD, bedAxialCenter, 0);
    const h = toWorld(entrance, rX, rZ, rW, rD, hbAxial, 0);
    const isZAxis = (entrance === 'front' || entrance === 'back');
    // Frame & mattress
    furn(scene, isZAxis ? bedLong+0.06 : bedShort+0.06, 0.22, isZAxis ? bedShort+0.06 : bedLong+0.06, 0x6B4F3A, p.x, 0, p.z);
    furn(scene, isZAxis ? bedLong-0.04 : bedShort-0.08, 0.22, isZAxis ? bedShort-0.08 : bedLong-0.04, 0xF5F0E8, p.x, 0.22, p.z);
    // Headboard (thin slab against far wall)
    furn(scene, isZAxis ? bedLong+0.06 : 0.09, 0.65, isZAxis ? 0.09 : bedLong+0.06, 0x6B4F3A, h.x, 0.22, h.z);
    // Pillows (offset toward entrance from headboard, laterally split)
    const pilAx = bedAxialCenter - bedShort * 0.28;
    const pilLat = bedLong * 0.22;
    const pL = toWorld(entrance, rX, rZ, rW, rD, pilAx, -pilLat);
    const pR = toWorld(entrance, rX, rZ, rW, rD, pilAx,  pilLat);
    furn(scene, isZAxis ? bedLong*0.44 : 0.40, 0.10, isZAxis ? 0.40 : bedLong*0.44, 0xFAFAF8, pL.x, 0.44, pL.z);
    furn(scene, isZAxis ? bedLong*0.44 : 0.40, 0.10, isZAxis ? 0.40 : bedLong*0.44, 0xFAFAF8, pR.x, 0.44, pR.z);
  }

  // ── Side table: ONE, on the wdLateral side (opposite wardrobe), next to bed ──
  if (lH > 1.4) {
    const stAx  = bedAxialCenter - bedShort * 0.25;
    const stLat = -(bedLong / 2 + 0.30) * wdLateral; // opposite side from wardrobe
    const st = toWorld(entrance, rX, rZ, rW, rD, stAx, stLat);
    furn(scene, 0.48, 0.48, 0.48, 0x9E7B5A, st.x, 0, st.z);
    furn(scene, 0.08, 0.30, 0.08, 0xBB9966, st.x, 0.48, st.z); // lamp
  }

  // ── Wardrobe: against lateral wall on wdLateral side, near entrance ──
  // Placed at the ENTRANCE end of the side wall so it's convenient but not blocking the door
  // The bathroom door is at the entrance end of the bath side — so we put wardrobe on the OPPOSITE side
  {
    const isZAxis = (entrance === 'front' || entrance === 'back');
    const wdDepth  = 0.60; // depth away from wall
    const wdLength = Math.min(1.8, (isZAxis ? rW : rD) * 0.42);
    const wdHeight = 2.2;
    // Axial position: toward entrance side (NOT near the far/bed wall to keep path clear)
    const wdAx  = -(aH - WM) + wdLength / 2 + 0.15; // near entrance, small gap from entrance wall
    const wdLat = (lH - WM) * wdLateral - wdDepth / 2 * wdLateral; // against lateral wall
    const wd = toWorld(entrance, rX, rZ, rW, rD, wdAx, wdLat);
    furn(scene, isZAxis ? wdLength : wdDepth,  wdHeight, isZAxis ? wdDepth  : wdLength, 0xC4A882, wd.x, 0, wd.z);
    // Centre divider line
    furn(scene, isZAxis ? 0.02 : wdDepth+0.01, wdHeight, isZAxis ? wdDepth+0.01 : 0.02, 0x8B6040, wd.x, 0, wd.z);
  }

  // ── Desk + chair: large rooms, against the entrance wall lateral side (free corner) ──
  if (sqft > 130 && Math.min(rW, rD) > 3.0) {
    const isZAxis = (entrance === 'front' || entrance === 'back');
    const dkW = Math.min(1.2, (isZAxis ? rW : rD) * 0.30);
    const dkAx  = -(aH - WM) + 0.32;        // near entrance wall
    const dkLat = -(lH - WM - dkW / 2) * wdLateral; // far lateral side from wardrobe
    const dk = toWorld(entrance, rX, rZ, rW, rD, dkAx, dkLat);
    furn(scene, isZAxis ? dkW : 0.05, 0.05, isZAxis ? 0.05 : dkW, 0x9E7B5A, dk.x, 0.74, dk.z); // surface placeholder legs
    furn(scene, isZAxis ? dkW : 0.60, 0.05, isZAxis ? 0.60 : dkW, 0x9E7B5A, dk.x, 0.74, dk.z); // desk top
    const chAx = dkAx + 0.55;
    const ch = toWorld(entrance, rX, rZ, rW, rD, chAx, dkLat);
    furn(scene, 0.46, 0.08, 0.46, 0x607080, ch.x, 0.44, ch.z);
    furn(scene, 0.46, 0.42, 0.06, 0x607080, ch.x, 0.44, ch.z);
  }
}

// ── Living Room ────────────────────────────────────────────
// Layout: TV on wall opposite main seating, sofa facing TV, coffee table between.
// Entrance side is kept clear.
function furnishLivingRoom(scene, rX, rZ, rW, rD, sqft, rooms, room) {
  const entrance = getEntranceSide(rooms, room);
  const { axial: aH, lateral: lH } = roomHalves(entrance, rW, rD);
  const WM = WALL_T + 0.08;
  const isZAxis = (entrance === 'front' || entrance === 'back');

  // TV goes on far wall (opposite entrance). Sofa faces it from the middle-ish area.
  const tvW    = Math.min(isZAxis ? rW : rD, 2.2) * 0.70;
  const tvCabinetD = 0.38;
  const tvAx   = (aH - WM) - tvCabinetD / 2;  // TV cabinet center, against far wall
  const tvPos  = toWorld(entrance, rX, rZ, rW, rD, tvAx, 0);
  furn(scene, isZAxis ? tvW : tvCabinetD, 0.40, isZAxis ? tvCabinetD : tvW, 0x3A2A1E, tvPos.x, 0, tvPos.z);
  // TV screen (thin panel just in front of cabinet)
  const scrAx  = tvAx - tvCabinetD / 2 - 0.03;
  const scrPos = toWorld(entrance, rX, rZ, rW, rD, scrAx, 0);
  furn(scene, isZAxis ? tvW*0.88 : 0.05, 0.52, isZAxis ? 0.05 : tvW*0.88, 0x0a0a14, scrPos.x, 0.40, scrPos.z);

  // Sofa: 1.5–1.8m from far wall, facing TV
  const sofaW = Math.min(isZAxis ? rW : rD, 2.8) * 0.72;
  const sofaD = 0.82;
  const sofaAx = (aH - WM) - 1.55 - sofaD / 2;  // leave ~1.5m gap between TV and sofa
  // Clamp so sofa stays in room
  const sofaAxClamped = Math.max(-(aH - WM) + sofaD / 2 + 0.3, sofaAx);
  const sofaPos = toWorld(entrance, rX, rZ, rW, rD, sofaAxClamped, 0);
  furn(scene, isZAxis ? sofaW : sofaD, 0.44, isZAxis ? sofaD : sofaW, 0x7C6B7A, sofaPos.x, 0, sofaPos.z);
  // Backrest (faces toward entrance, i.e. axially toward entrance)
  const bkAx = sofaAxClamped + sofaD / 2 - 0.06;  // back of sofa = toward far wall side
  const bkPos = toWorld(entrance, rX, rZ, rW, rD, bkAx, 0);
  furn(scene, isZAxis ? sofaW : 0.12, 0.46, isZAxis ? 0.12 : sofaW, 0x6A5A68, bkPos.x, 0.44, bkPos.z);
  // Armrests
  const arLPos = toWorld(entrance, rX, rZ, rW, rD, sofaAxClamped, -sofaW / 2 + 0.07);
  const arRPos = toWorld(entrance, rX, rZ, rW, rD, sofaAxClamped,  sofaW / 2 - 0.07);
  furn(scene, isZAxis ? 0.12 : sofaD, 0.55, isZAxis ? sofaD : 0.12, 0x6A5A68, arLPos.x, 0, arLPos.z);
  furn(scene, isZAxis ? 0.12 : sofaD, 0.55, isZAxis ? sofaD : 0.12, 0x6A5A68, arRPos.x, 0, arRPos.z);

  // Coffee table: centred between sofa and TV
  const ctAxMid = (sofaAxClamped - sofaD / 2 + tvAx) / 2;
  if (Math.abs(ctAxMid - sofaAxClamped) > 0.6) {
    const ctW = Math.min(sofaW * 0.55, 1.0), ctD = ctW * 0.55;
    const ctPos = toWorld(entrance, rX, rZ, rW, rD, ctAxMid, 0);
    furn(scene, isZAxis ? ctW : ctD, 0.04, isZAxis ? ctD : ctW, 0x8B6040, ctPos.x, 0.40, ctPos.z);
    [-1,1].forEach(s => {
      [-1,1].forEach(t => {
        const lp = toWorld(entrance, rX, rZ, rW, rD, ctAxMid + t * ctD * 0.35, s * ctW * 0.35);
        furn(scene, 0.06, 0.40, 0.06, 0x5C3D2E, lp.x, 0, lp.z);
      });
    });
  }
}

// ── Kitchen ────────────────────────────────────────────────
// L-shaped counter on two walls that don't face the entrance.
// Entrance stays open for movement.
function furnishKitchen(scene, rX, rZ, rW, rD, rooms, room) {
  const entrance = getEntranceSide(rooms, room);
  const { axial: aH, lateral: lH } = roomHalves(entrance, rW, rD);
  const WM = WALL_T + 0.08;
  const isZAxis = (entrance === 'front' || entrance === 'back');

  const ctrD = 0.60, ctrH = 0.90, top = 0.04, upH = 0.60;

  // Counter along far wall (full width)
  const farLen = (isZAxis ? rW : rD) - WM * 2;
  const farPos = toWorld(entrance, rX, rZ, rW, rD, (aH - WM) - ctrD / 2, 0);
  furn(scene, isZAxis ? farLen : ctrD, ctrH, isZAxis ? ctrD : farLen, 0xE8DFD0, farPos.x, 0, farPos.z);
  furn(scene, isZAxis ? farLen : ctrD+0.02, top,  isZAxis ? ctrD+0.02 : farLen, 0xCCBBAA, farPos.x, ctrH, farPos.z);
  furn(scene, isZAxis ? farLen : 0.35, upH, isZAxis ? 0.35 : farLen, 0xE0D4C0, farPos.x, ctrH+0.40, farPos.z);

  // Counter along right lateral wall (~45% of depth)
  const sideLen = (isZAxis ? rD : rW) * 0.45;
  const sideAx  = (aH - WM) - sideLen / 2;
  const sideLat = (lH - WM) - ctrD / 2;
  const sidePos = toWorld(entrance, rX, rZ, rW, rD, sideAx, sideLat);
  furn(scene, isZAxis ? ctrD : sideLen, ctrH, isZAxis ? sideLen : ctrD, 0xE8DFD0, sidePos.x, 0, sidePos.z);
  furn(scene, isZAxis ? ctrD+0.02 : sideLen, top, isZAxis ? sideLen : ctrD+0.02, 0xCCBBAA, sidePos.x, ctrH, sidePos.z);

  // Sink inset on far counter, offset from centre
  const snkPos = toWorld(entrance, rX, rZ, rW, rD, (aH - WM) - ctrD / 2, -farLen * 0.18);
  furn(scene, isZAxis ? 0.55 : 0.06, 0.06, isZAxis ? 0.06 : 0.55, 0xB0C4C4, snkPos.x, ctrH, snkPos.z);
}

// ── Bathroom ───────────────────────────────────────────────
// Toilet in far corner. Vanity near entrance on opposite side.
function furnishBathroom(scene, rX, rZ, rW, rD, sqft, rooms, room) {
  const entrance = getEntranceSide(rooms, room);
  const { axial: aH, lateral: lH } = roomHalves(entrance, rW, rD);
  const WM = WALL_T + 0.08;
  const isZAxis = (entrance === 'front' || entrance === 'back');

  // Toilet — far corner, lateral +1 side
  const tlAx  =  (aH - WM) - 0.26;
  const tlLat =  (lH - WM) - 0.19;
  const tlPos = toWorld(entrance, rX, rZ, rW, rD, tlAx, tlLat);
  furn(scene, isZAxis ? 0.38 : 0.22, 0.42, isZAxis ? 0.22 : 0.38, 0xF0EFEE, tlPos.x, 0, tlPos.z); // tank
  const tbPos = toWorld(entrance, rX, rZ, rW, rD, tlAx - 0.28, tlLat);
  furn(scene, isZAxis ? 0.38 : 0.50, 0.38, isZAxis ? 0.50 : 0.38, 0xF0EFEE, tbPos.x, 0, tbPos.z); // bowl

  // Vanity — near entrance, lateral -1 side
  const vaAx  = -(aH - WM) + 0.22;
  const vaLat = -(lH - WM) + 0.28;
  const vaPos = toWorld(entrance, rX, rZ, rW, rD, vaAx, vaLat);
  furn(scene, isZAxis ? 0.55 : 0.42, 0.82, isZAxis ? 0.42 : 0.55, 0xD9CFC8, vaPos.x, 0, vaPos.z);
  furn(scene, isZAxis ? 0.55 : 0.42, 0.06, isZAxis ? 0.42 : 0.55, 0xC8C0BC, vaPos.x, 0.82, vaPos.z);
  furn(scene, 0.28, 0.12, 0.28, 0xD0E4E4, vaPos.x, 0.82, vaPos.z);

  // Shower — far corner, lateral -1 side (if large enough)
  if (sqft > 50 && rW > 2.0 && rD > 2.0) {
    const shW = Math.min((isZAxis ? rW : rD) * 0.42, 1.0);
    const shD = Math.min((isZAxis ? rD : rW) * 0.42, 1.0);
    const shAx  = (aH - WM) - shD / 2;
    const shLat = -(lH - WM) + shW / 2;
    const shPos = toWorld(entrance, rX, rZ, rW, rD, shAx, shLat);
    const gm = new THREE.MeshLambertMaterial({ color: 0xAADDEE, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const mkG = (w, h, d, cx, cz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),gm); m.position.set(cx,h/2,cz); scene.add(m); };
    mkG(isZAxis ? shW : 0.03, WALL_H*0.85, isZAxis ? 0.03 : shW, shPos.x, shPos.z - (isZAxis ? shD/2 : 0)); // entrance face
    mkG(isZAxis ? 0.03 : shD, WALL_H*0.85, isZAxis ? shD : 0.03, shPos.x + (isZAxis ? -shW/2 : 0), shPos.z); // side face
  }
}

// ── Dining Room ────────────────────────────────────────────
function furnishDining(scene, rX, rZ, rW, rD, sqft) {
  const tW = Math.min(rW * 0.60, 1.6);
  const tD = Math.min(rD * 0.60, 0.95);
  furn(scene, tW, 0.05, tD, 0x8B6040, rX, 0.74, rZ);
  furn(scene, 0.06, 0.74, 0.06, 0x5C3D2E, rX - tW/2+0.08, 0, rZ - tD/2+0.08);
  furn(scene, 0.06, 0.74, 0.06, 0x5C3D2E, rX + tW/2-0.08, 0, rZ - tD/2+0.08);
  furn(scene, 0.06, 0.74, 0.06, 0x5C3D2E, rX - tW/2+0.08, 0, rZ + tD/2-0.08);
  furn(scene, 0.06, 0.74, 0.06, 0x5C3D2E, rX + tW/2-0.08, 0, rZ + tD/2-0.08);
  const chairs = [
    [rX - tW/2 - 0.28, rZ, 0], [rX + tW/2 + 0.28, rZ, Math.PI],
    [rX, rZ - tD/2 - 0.28, Math.PI/2], [rX, rZ + tD/2 + 0.28, -Math.PI/2],
  ];
  if (sqft > 90) chairs.push([rX - tW/4, rZ - tD/2 - 0.28, Math.PI/2], [rX + tW/4, rZ + tD/2 + 0.28, -Math.PI/2]);
  chairs.forEach(([cx, cz, ry]) => {
    furn(scene, 0.42, 0.08, 0.42, 0x9E7B5A, cx, 0.44, cz);
    // chair back angled outward
    const bx = cx + Math.sin(ry) * 0.20;
    const bz = cz - Math.cos(ry) * 0.20;
    furn(scene, 0.42, 0.42, 0.06, 0x9E7B5A, bx, 0.44, bz);
  });
}

// ── Study ──────────────────────────────────────────────────
function furnishStudy(scene, rX, rZ, rW, rD, rooms, room) {
  const entrance = getEntranceSide(rooms, room);
  const { axial: aH, lateral: lH } = roomHalves(entrance, rW, rD);
  const WM = WALL_T + 0.08;
  const isZAxis = (entrance === 'front' || entrance === 'back');
  const dkW = Math.min((isZAxis ? rW : rD) * 0.55, 1.5);
  const dkAx  = (aH - WM) - 0.32;
  const dkLat = 0;
  const dk = toWorld(entrance, rX, rZ, rW, rD, dkAx, dkLat);
  furn(scene, isZAxis ? dkW : 0.60, 0.05, isZAxis ? 0.60 : dkW, 0x9E7B5A, dk.x, 0.74, dk.z);
  // Legs
  [-1,1].forEach(sa => [-1,1].forEach(sb => {
    const lp = toWorld(entrance, rX, rZ, rW, rD, dkAx + sb*(isZAxis?0.26:0), dkLat + sa*(isZAxis?0:0.26));
    furn(scene, 0.05, 0.74, 0.05, 0x5C3D2E, lp.x, 0, lp.z);
  }));
  // Chair facing desk (toward far wall)
  const ch = toWorld(entrance, rX, rZ, rW, rD, dkAx - 0.55, 0);
  furn(scene, 0.48, 0.08, 0.48, 0x607080, ch.x, 0.44, ch.z);
  furn(scene, 0.48, 0.45, 0.06, 0x607080, ch.x, 0.44, ch.z);
  // Bookshelf on lateral wall
  const bsH = WALL_H * 0.80;
  const bs = toWorld(entrance, rX, rZ, rW, rD, dkAx, (lH - WM) - 0.11);
  furn(scene, isZAxis ? 0.30 : bsH, bsH, isZAxis ? bsH : 0.30, 0xC4A882, bs.x, 0, bs.z);
}

// ── Balcony ────────────────────────────────────────────────
function furnishBalcony(scene, rX, rZ, rW, rD, sqft) {
  if (sqft < 55) return;
  // Chair offset from centre, planter in opposite corner
  furn(scene, 0.48, 0.06, 0.46, 0x8B7355, rX - rW * 0.22, 0.44, rZ - rD * 0.15);
  furn(scene, 0.48, 0.38, 0.05, 0x8B7355, rX - rW * 0.22, 0.44, rZ - rD * 0.15 + 0.22);
  furn(scene, 0.28, 0.40, 0.28, 0xA05030, rX + rW * 0.28, 0, rZ + rD * 0.25);
  furn(scene, 0.22, 0.22, 0.22, 0x4A7C40, rX + rW * 0.28, 0.40, rZ + rD * 0.25);
}

// ── Floor label (Y-axis billboard, flat on floor) ──────────
function makeLabel(scene, text, areaStr, rX, rZ, rW, rD) {
  const cvs = document.createElement('canvas');
  cvs.width = 256; cvs.height = 80;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(2, 2, 252, 76, 8); else ctx.rect(2, 2, 252, 76);
  ctx.fill();
  ctx.fillStyle = '#1A3C6B'; ctx.font = 'bold 24px Inter,sans-serif';
  ctx.textAlign = 'center'; ctx.fillText(text, 128, 32);
  if (areaStr) {
    ctx.fillStyle = '#6B7280'; ctx.font = '16px Inter,sans-serif';
    ctx.fillText(areaStr, 128, 56);
  }
  const labelW = Math.min(rW * 0.75, 2.8);
  const labelD = labelW * (80 / 256);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(labelW, labelD),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cvs), transparent: true, depthWrite: false }),
  );
  mesh.rotation.order = 'YXZ';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(rX, 0.06, rZ);
  scene.add(mesh);
  return mesh;
}

// ── Balcony wall builder ───────────────────────────────────
function buildBalconySide(scene, isExt, wallMat, railMat, wallW, wallH, wallT, cx, cy, cz, axis) {
  if (!isExt) {
    // Shared with another room — thin interior partition (same as normal)
    const m = new THREE.Mesh(
      axis === 'x'
        ? new THREE.BoxGeometry(wallT, wallH, wallW)
        : new THREE.BoxGeometry(wallW, wallH, wallT),
      wallMat,
    );
    m.position.set(cx, cy, cz);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    return;
  }
  // Exterior balcony → parapet + top rail
  const gParapet = axis === 'x'
    ? new THREE.BoxGeometry(wallT, PARAPET_H, wallW)
    : new THREE.BoxGeometry(wallW, PARAPET_H, wallT);
  const pMesh = new THREE.Mesh(gParapet, railMat);
  pMesh.position.set(cx, PARAPET_H / 2, cz);
  pMesh.castShadow = true; scene.add(pMesh);

  const gRail = axis === 'x'
    ? new THREE.BoxGeometry(wallT + 0.06, RAIL_H, wallW + 0.06)
    : new THREE.BoxGeometry(wallW + 0.06, RAIL_H, wallT + 0.06);
  const rMesh = new THREE.Mesh(gRail, railMat);
  rMesh.position.set(cx, PARAPET_H + RAIL_H / 2, cz);
  scene.add(rMesh);
}

// ── Scene builder ──────────────────────────────────────────
function buildScene(rooms, isNight, showRoof) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(isNight ? 0x08091a : 0x87ceea);
  if (!isNight) scene.fog = new THREE.FogExp2(0x87ceea, 0.007);

  scene.add(new THREE.AmbientLight(isNight ? 0x223344 : 0xffffff, isNight ? 0.55 : 0.65));
  const sun = new THREE.DirectionalLight(isNight ? 0x6688bb : 0xfff5e0, isNight ? 0.4 : 1.1);
  sun.position.set(12, 18, 10); sun.castShadow = true;
  sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
  Object.assign(sun.shadow.camera, { left:-40, right:40, top:40, bottom:-40, near:0.5, far:120 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  const fill = new THREE.DirectionalLight(isNight ? 0x112233 : 0xffffff, isNight ? 0.1 : 0.35);
  fill.position.set(0, -5, 0); scene.add(fill);
  if (isNight) { const pl = new THREE.PointLight(0xffeeaa, 1.2, 25); pl.position.set(0,2.5,0); scene.add(pl); }

  const wallMat  = new THREE.MeshLambertMaterial({ color: isNight ? 0xc4d4e4 : 0xf0ede8 });
  const partMat  = new THREE.MeshLambertMaterial({ color: isNight ? 0xaabbcc : 0xe8e4de });
  const ceilMat  = new THREE.MeshLambertMaterial({ color: isNight ? 0x7788aa : 0xfafafa });
  const railMat  = new THREE.MeshLambertMaterial({ color: isNight ? 0xb0c8d0 : 0xddeeff });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x99c8ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide });

  const box = (w, h, d, mat, cx, cy, cz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(cx, cy, cz); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  };

  const roomMeshes = [];
  const labelMeshes = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

  // Check if plan has a dedicated dining room
  const hasDining = rooms.some(r => r.room_type === 'dining');

  rooms.forEach(room => {
    const rW = room.width  * SCALE;
    const rD = room.height * SCALE;
    const rX = (room.x + room.width  / 2) * SCALE;
    const rZ = (room.y + room.height / 2) * SCALE;
    const sqft = room.area_sqft ? parseFloat(room.area_sqft) : Math.round((room.width / 20) * (room.height / 20));

    minX = Math.min(minX, rX-rW/2); maxX = Math.max(maxX, rX+rW/2);
    minZ = Math.min(minZ, rZ-rD/2); maxZ = Math.max(maxZ, rZ+rD/2);

    // Parse door/window metadata
    let doors = [], windows = [];
    if (room.metadata) {
      try {
        const meta = typeof room.metadata === 'string' ? JSON.parse(room.metadata) : room.metadata;
        doors   = meta.doors   || [];
        windows = meta.windows || [];
      } catch {}
    }

    // ── Floor slab ──
    const fMat = new THREE.MeshLambertMaterial({ color: FLOOR_COLORS[room.room_type] ?? 0xf0f0f0 });
    const floorM = box(rW, FLOOR_T, rD, fMat, rX, -FLOOR_T/2, rZ);
    floorM.userData = {
      isRoom:true, roomId:room.id, roomName:room.name,
      roomType:room.room_type, areaSqft:sqft, notes:room.notes, color:room.color,
    };
    roomMeshes.push(floorM);

    if (showRoof) box(rW - WALL_T*2, FLOOR_T, rD - WALL_T*2, ceilMat, rX, WALL_H + FLOOR_T/2, rZ);

    // ── Wall classification ──
    const frontExt = isExterior(rooms, room, 'front');
    const backExt  = isExterior(rooms, room, 'back');
    const leftExt  = isExterior(rooms, room, 'left');
    const rightExt = isExterior(rooms, room, 'right');

    const isBalcony = room.room_type === 'balcony';

    if (isBalcony) {
      // ── Balcony: parapet on exterior sides, partition on shared sides ──
      const fZ  = rZ - rD/2;
      const bZ  = rZ + rD/2;
      const lX  = rX - rW/2;
      const rtX = rX + rW/2;

      // Front (−Z)
      buildBalconySide(scene, frontExt, partMat, railMat, rW, WALL_H, WALL_T, rX, WALL_H/2, fZ + WALL_T/2, 'z');
      // Back (+Z) — partition if interior, parapet if exterior
      buildBalconySide(scene, backExt,  partMat, railMat, rW, WALL_H, WALL_T, rX, WALL_H/2, bZ - WALL_T/2, 'z');
      // Left (−X)
      if (leftExt) buildBalconySide(scene, true,  partMat, railMat, rD, WALL_H, WALL_T, lX + WALL_T/2, WALL_H/2, rZ, 'x');
      // Right (+X)
      buildBalconySide(scene, rightExt, partMat, railMat, rD, WALL_H, WALL_T, rtX - WALL_T/2, WALL_H/2, rZ, 'x');
    } else {
      // ── Normal room walls ──
      const doorOnSide = side => doors.find(d => d.side === side);
      const winOnSide  = side => windows.find(w => w.side === side);

      const fZ  = rZ - rD/2 + WALL_T/2;
      const bZ  = rZ + rD/2 - WALL_T/2;
      const lX  = rX - rW/2 + WALL_T/2;
      const rtX = rX + rW/2 - WALL_T/2;

      // Helper: build a wall with a door opening
      const wallWithDoor = (len, height, thick, mat, cx, cy, cz, axis, doorInfo) => {
        const dW = doorInfo ? Math.min(DOOR_W, len * 0.45) : DOOR_W;
        const doorOffset = doorInfo ? doorInfo.offset ?? 0.5 : 0.5;
        const doorCx = (axis === 'z') ? cx - len/2 + doorOffset * len : cx;
        const doorCz = (axis === 'x') ? cz - len/2 + doorOffset * len : cz;
        const sdW = (axis === 'z') ? Math.max(0, (len - dW) / 2) : 0;
        const sdH = (axis === 'x') ? Math.max(0, (len - dW) / 2) : 0;

        if (axis === 'z') {
          if (sdW > 0.05) {
            box(sdW, height, thick, mat, doorCx - dW/2 - sdW/2, cy, cz);
            box(sdW, height, thick, mat, doorCx + dW/2 + sdW/2, cy, cz);
          }
          const lintelH = height - DOOR_H;
          if (lintelH > 0.05) box(dW, lintelH, thick, mat, doorCx, DOOR_H + lintelH/2, cz);
        } else {
          if (sdH > 0.05) {
            box(thick, height, sdH, mat, cx, cy, doorCz - dW/2 - sdH/2);
            box(thick, height, sdH, mat, cx, cy, doorCz + dW/2 + sdH/2);
          }
          const lintelH = height - DOOR_H;
          if (lintelH > 0.05) box(thick, lintelH, dW, mat, cx, DOOR_H + lintelH/2, doorCz);
        }
      };

      // Helper: build a wall with a window opening
      const wallWithWindow = (len, height, thick, mat, cx, cz, axis, winInfo) => {
        const wW = Math.min(WIN_W, len * 0.50);
        const winOffset = winInfo ? winInfo.offset ?? 0.5 : 0.5;

        if (axis === 'z') {
          const winCx = cx - len/2 + winOffset * len;
          const wSd = Math.max(0, (len - wW) / 2);
          const wTopH = height - WIN_SILL - WIN_H;
          box(len, WIN_SILL, thick, mat, cx, WIN_SILL/2, cz);
          if (wSd > 0.05) {
            box(wSd, WIN_H, thick, mat, winCx - wW/2 - wSd/2, WIN_SILL + WIN_H/2, cz);
            box(wSd, WIN_H, thick, mat, winCx + wW/2 + wSd/2, WIN_SILL + WIN_H/2, cz);
          }
          if (wTopH > 0.05) box(len, wTopH, thick, mat, cx, WIN_SILL + WIN_H + wTopH/2, cz);
          const gl = new THREE.Mesh(new THREE.PlaneGeometry(wW, WIN_H), glassMat);
          gl.position.set(winCx, WIN_SILL + WIN_H/2, cz); scene.add(gl);
        } else {
          const winCz = cz - len/2 + winOffset * len;
          const wSd = Math.max(0, (len - wW) / 2);
          const wTopH = height - WIN_SILL - WIN_H;
          box(thick, WIN_SILL, len, mat, cx, WIN_SILL/2, cz);
          if (wSd > 0.05) {
            box(thick, WIN_H, wSd, mat, cx, WIN_SILL + WIN_H/2, winCz - wW/2 - wSd/2);
            box(thick, WIN_H, wSd, mat, cx, WIN_SILL + WIN_H/2, winCz + wW/2 + wSd/2);
          }
          if (wTopH > 0.05) box(thick, wTopH, len, mat, cx, WIN_SILL + WIN_H + wTopH/2, cz);
          const gl = new THREE.Mesh(new THREE.PlaneGeometry(wW, WIN_H), glassMat);
          gl.rotation.y = Math.PI/2;
          gl.position.set(cx, WIN_SILL + WIN_H/2, winCz); scene.add(gl);
        }
      };

      // FRONT wall (−Z)
      if (frontExt) {
        const d = doorOnSide('front');
        if (d) wallWithDoor(rW, WALL_H, WALL_T, wallMat, rX, WALL_H/2, fZ, 'z', d);
        else {
          const w = winOnSide('front');
          if (w) wallWithWindow(rW, WALL_H, WALL_T, wallMat, rX, fZ, 'z', w);
          else {
            // Auto: rooms likely to have front door
            if (['bedroom','living_room','kitchen','corridor'].includes(room.room_type)) {
              wallWithDoor(rW, WALL_H, WALL_T, wallMat, rX, WALL_H/2, fZ, 'z', null);
            } else {
              box(rW, WALL_H, WALL_T, wallMat, rX, WALL_H/2, fZ);
            }
          }
        }
      }
      // Interior front — SKIP

      // BACK wall (+Z)
      if (backExt) {
        const w = winOnSide('back');
        const d = doorOnSide('back');
        if (d) wallWithDoor(rW, WALL_H, WALL_T, wallMat, rX, WALL_H/2, bZ, 'z', d);
        else wallWithWindow(rW, WALL_H, WALL_T, wallMat, rX, bZ, 'z', w);
      } else {
        box(rW, WALL_H, PART_T, partMat, rX, WALL_H/2, rZ + rD/2);
      }

      // LEFT wall (−X)
      if (leftExt) {
        const d = doorOnSide('left');
        const w = winOnSide('left');
        if (d) wallWithDoor(rD, WALL_H, WALL_T, wallMat, lX, WALL_H/2, rZ, 'x', d);
        else if (w) wallWithWindow(rD, WALL_H, WALL_T, wallMat, lX, rZ, 'x', w);
        else box(WALL_T, WALL_H, rD, wallMat, lX, WALL_H/2, rZ);
      }
      // Interior left — SKIP

      // RIGHT wall (+X)
      if (rightExt) {
        const d = doorOnSide('right');
        const w = winOnSide('right');
        if (d) wallWithDoor(rD, WALL_H, WALL_T, wallMat, rtX, WALL_H/2, rZ, 'x', d);
        else if (w) wallWithWindow(rD, WALL_H, WALL_T, wallMat, rtX, rZ, 'x', w);
        else {
          // Auto: window on right for wide-exterior rooms
          wallWithWindow(rD, WALL_H, WALL_T, wallMat, rtX, rZ, 'x', null);
        }
      } else {
        box(PART_T, WALL_H, rD, partMat, rX + rW/2, WALL_H/2, rZ);
      }
    }

    // ── Furniture ──
    switch (room.room_type) {
      case 'bedroom':    furnishBedroom(scene, rX, rZ, rW, rD, sqft, rooms, room);    break;
      case 'living_room':furnishLivingRoom(scene, rX, rZ, rW, rD, sqft, rooms, room); break;
      case 'kitchen':    furnishKitchen(scene, rX, rZ, rW, rD, rooms, room);          break;
      case 'bathroom':   furnishBathroom(scene, rX, rZ, rW, rD, sqft, rooms, room);   break;
      case 'dining':     furnishDining(scene, rX, rZ, rW, rD, sqft);                  break;
      case 'study':      furnishStudy(scene, rX, rZ, rW, rD, rooms, room);            break;
      case 'balcony':    furnishBalcony(scene, rX, rZ, rW, rD, sqft);                 break;
      default: break;
    }
    // Living room with no separate dining: add dining corner
    if (room.room_type === 'living_room' && !hasDining && sqft > 200) {
      furnishDining(scene, rX + rW * 0.28, rZ - rD * 0.25, rW * 0.4, rD * 0.45, sqft * 0.3);
    }

    // ── Floor label (Y-axis billboard) ──
    const label = makeLabel(
      scene, room.name,
      sqft ? `${sqft} sq.ft` : null,
      rX, rZ, rW, rD,
    );
    labelMeshes.push(label);
  });

  // Ground plane
  if (rooms.length > 0) {
    const pad = 4;
    const midX = (minX+maxX)/2, midZ = (minZ+maxZ)/2;
    const span = Math.max(maxX-minX, maxZ-minZ);
    const gMesh = new THREE.Mesh(
      new THREE.PlaneGeometry((maxX-minX)+pad*2, (maxZ-minZ)+pad*2),
      new THREE.MeshLambertMaterial({ color: isNight ? 0x182010 : 0xc8dca8 }),
    );
    gMesh.rotation.x = -Math.PI/2;
    gMesh.position.set(midX, -FLOOR_T-0.01, midZ);
    gMesh.receiveShadow = true; scene.add(gMesh);
    scene.userData.center = { x: midX, z: midZ };
    scene.userData.span   = span;
  }

  return { scene, roomMeshes, labelMeshes };
}

// ─────────────────────────────────────────────────────────────
export default function ViewerPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const mountRef     = useRef(null);
  const sceneRef     = useRef(null);
  const cameraRef    = useRef(null);
  const rendererRef  = useRef(null);
  const keysRef      = useRef({});
  const rafRef       = useRef(null);
  const roomMeshRef  = useRef([]);
  const labelMeshRef = useRef([]);
  const modeRef      = useRef('orbit');

  const [floorPlan,    setFloorPlan]    = useState(null);
  const [mode,         setMode]         = useState('orbit');
  const [isNight,      setIsNight]      = useState(false);
  const [showRoof,     setShowRoof]     = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [clickedRoom,  setClickedRoom]  = useState(null);
  const [showHelp,     setShowHelp]     = useState(false);
  const [currentFloor, setCurrentFloor] = useState(1);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    (async () => {
      try {
        let res;
        try { res = await api.get(`/floor-plans/${id}`); }
        catch { res = await api.get(`/marketplace/listings/${id}`); }
        setFloorPlan(res.data.data);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [id]);

  useEffect(() => {
    if (mode !== 'walk' || !cameraRef.current || !sceneRef.current) return;
    const center = sceneRef.current.userData.center;
    const span   = sceneRef.current.userData.span ?? 10;
    if (center) cameraRef.current.position.set(center.x, 1.7, center.z + span*0.4);
  }, [mode]);

  useEffect(() => {
    if (!floorPlan || !mountRef.current) return;
    const container = mountRef.current;
    const W = container.clientWidth, H = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(60, W/H, 0.1, 200);
    cameraRef.current = camera;

    // Coerce decimal-string coordinates to numbers (mysql2 DECIMAL → string)
    const rooms = (floorPlan.rooms || []).map(r => ({
      ...r,
      x:         parseFloat(r.x)         || 0,
      y:         parseFloat(r.y)         || 0,
      width:     parseFloat(r.width)     || 100,
      height:    parseFloat(r.height)    || 100,
      area_sqft: r.area_sqft != null ? parseFloat(r.area_sqft) : null,
    }));

    const { scene, roomMeshes, labelMeshes } = buildScene(rooms, isNight, showRoof);
    sceneRef.current    = scene;
    roomMeshRef.current  = roomMeshes;
    labelMeshRef.current = labelMeshes;

    const center = scene.userData.center ?? { x:5, z:5 };
    const span   = scene.userData.span   ?? 10;
    const dist   = Math.max(span*1.3, 10);

    let orbitTheta = 0, orbitPhi = Math.PI/4, orbitRadius = dist;
    const orbitTarget = new THREE.Vector3(center.x, 0, center.z);

    const updateOrbit = () => {
      camera.position.x = orbitTarget.x + orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta);
      camera.position.y = orbitTarget.y + orbitRadius * Math.cos(orbitPhi);
      camera.position.z = orbitTarget.z + orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta);
      camera.lookAt(orbitTarget);
    };
    updateOrbit();

    let isDragging = false, hasMoved = false, prevMouse = { x:0, y:0 };
    const onMouseDown = e => { isDragging=true; hasMoved=false; prevMouse={x:e.clientX,y:e.clientY}; };
    const onMouseUp   = () => { isDragging = false; };
    const onMouseMove = e => {
      if (!isDragging || modeRef.current !== 'orbit') return;
      const dx = e.clientX - prevMouse.x, dy = e.clientY - prevMouse.y;
      if (Math.abs(dx)+Math.abs(dy) > 3) hasMoved = true;
      orbitTheta -= dx * 0.008;
      orbitPhi    = Math.max(0.05, Math.min(Math.PI/2.05, orbitPhi + dy*0.006));
      prevMouse   = { x:e.clientX, y:e.clientY };
      updateOrbit();
    };
    const onWheel = e => {
      orbitRadius = Math.max(3, Math.min(60, orbitRadius + e.deltaY*0.02));
      updateOrbit();
    };

    const onClick = e => {
      if (hasMoved || modeRef.current !== 'orbit') return;
      const rect  = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  *  2 - 1,
        ((e.clientY - rect.top)  / rect.height) * -2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(roomMeshRef.current);
      if (hits.length > 0 && hits[0].object.userData.isRoom) {
        const ud = hits[0].object.userData;
        setClickedRoom({ id:ud.roomId, name:ud.roomName, type:ud.roomType, area:ud.areaSqft, notes:ud.notes, color:ud.color });
      } else {
        setClickedRoom(null);
      }
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('click',     onClick);
    window.addEventListener('mouseup',   onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });

    const onKeyDown = e => { keysRef.current[e.key.toLowerCase()] = true; };
    const onKeyUp   = e => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    let walkYaw = Math.PI;
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const k = keysRef.current, m = modeRef.current;
      if (m === 'walk') {
        const speed = 0.07, turn = 0.03;
        if (k['arrowleft']  || k['a']) walkYaw += turn;
        if (k['arrowright'] || k['d']) walkYaw -= turn;
        const dir = new THREE.Vector3(-Math.sin(walkYaw), 0, -Math.cos(walkYaw));
        if (k['arrowup']   || k['w']) camera.position.addScaledVector(dir,  speed);
        if (k['arrowdown'] || k['s']) camera.position.addScaledVector(dir, -speed);
        camera.position.y = 1.7;
        camera.lookAt(camera.position.clone().add(dir));
      } else {
        updateOrbit();
      }

      // Y-axis billboard: rotate labels to face camera horizontally
      labelMeshRef.current.forEach(lm => {
        const dx = camera.position.x - lm.position.x;
        const dz = camera.position.z - lm.position.z;
        lm.rotation.y = Math.atan2(dx, dz);
      });

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const W2 = container.clientWidth, H2 = container.clientHeight;
      camera.aspect = W2/H2; camera.updateProjectionMatrix(); renderer.setSize(W2, H2);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('click',     onClick);
      window.removeEventListener('mouseup',   onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      window.removeEventListener('resize',  onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [floorPlan, isNight, showRoof]);

  const goDollhouse = () => {
    const camera = cameraRef.current, scene = sceneRef.current;
    if (!camera || !scene) return;
    const center = scene.userData.center ?? { x:5, z:5 };
    const span   = scene.userData.span   ?? 10;
    camera.position.set(center.x - span*0.4, span*1.6, center.z + span*0.9);
    camera.lookAt(center.x, 0, center.z);
    setMode('orbit');
  };

  const toggleWalk = () => setMode(m => m === 'walk' ? 'orbit' : 'walk');

  if (loading) return (
    <div className="h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm opacity-60">Building 3D scene…</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-gray-900 overflow-hidden relative">
      <header className="absolute top-0 left-0 right-0 z-20 h-14 bg-black/60 backdrop-blur
                         border-b border-white/10 flex items-center px-4 gap-3">
        <button onClick={() => navigate(-1)}
          className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">{floorPlan?.name}</h1>
          <p className="text-xs text-white/50 truncate">{floorPlan?.building_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goDollhouse}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
            <Home size={13} /> Dollhouse
          </button>
          <button onClick={toggleWalk}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors
              ${mode==='walk' ? 'bg-primary-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <Move size={13} />{mode==='walk' ? 'Walking' : 'Walk'}
          </button>
          <button onClick={() => setShowRoof(r => !r)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors
              ${showRoof ? 'bg-amber-600/80 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <span className="text-base leading-none">{showRoof ? '🏠' : '🔓'}</span>
            {showRoof ? 'Roof On' : 'Open Top'}
          </button>
          <button onClick={() => setIsNight(n => !n)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
            {isNight ? <Sun size={13} /> : <Moon size={13} />}
            {isNight ? 'Day' : 'Night'}
          </button>
          <button onClick={() => setShowHelp(h => !h)}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
            <Info size={16} />
          </button>
        </div>
      </header>

      <div ref={mountRef} className="absolute inset-0" />

      <div className="absolute left-4 top-20 flex flex-col gap-1.5 z-10">
        <div className="bg-black/60 backdrop-blur rounded-xl px-3 py-2 text-white text-xs flex items-center gap-2">
          <Layers size={13} className="text-white/50" />
          <span className="text-white/50">Floor</span>
          <span className="font-bold">{currentFloor}</span>
        </div>
        <button onClick={() => setCurrentFloor(f => f+1)}
          className="bg-black/60 backdrop-blur text-white text-xs w-full py-1.5 rounded-lg hover:bg-white/20 font-bold">▲</button>
        <button onClick={() => setCurrentFloor(f => Math.max(1,f-1))}
          className="bg-black/60 backdrop-blur text-white text-xs w-full py-1.5 rounded-lg hover:bg-white/20 font-bold">▼</button>
      </div>

      {floorPlan?.rooms?.length > 0 && (
        <div className="absolute right-4 top-20 w-48 bg-black/60 backdrop-blur rounded-xl p-3 text-white z-10">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 text-white/50">Rooms</p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
            {(floorPlan.rooms||[]).map(r => (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:r.color||'#6B7280'}}/>
                <span className="truncate flex-1 text-white/80">{r.name}</span>
                {r.area_sqft && <span className="text-white/35 text-[10px] flex-shrink-0">{parseFloat(r.area_sqft)}</span>}
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-white/40">
            {floorPlan.rooms?.length} rooms{floorPlan.area_sqft ? ` · ${floorPlan.area_sqft} sq.ft` : ''}
          </div>
        </div>
      )}

      {clickedRoom && (
        <div className="absolute left-4 bottom-20 bg-black/80 backdrop-blur rounded-2xl p-4
                        text-white w-64 z-10 border border-white/10 shadow-2xl">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {clickedRoom.color && <span className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{background:clickedRoom.color}}/>}
              <div>
                <h3 className="font-bold text-base leading-tight">{clickedRoom.name}</h3>
                <p className="text-xs text-white/50 mt-0.5">{TYPE_LABELS[clickedRoom.type]||clickedRoom.type}</p>
              </div>
            </div>
            <button onClick={() => setClickedRoom(null)}
              className="text-white/40 hover:text-white p-1 -mt-1 -mr-1 rounded-lg hover:bg-white/10">
              <X size={15}/>
            </button>
          </div>
          {clickedRoom.area && (
            <div className="flex items-center justify-between text-sm py-2 border-t border-white/10">
              <span className="text-white/50">Area</span>
              <span className="font-semibold">{clickedRoom.area} sq.ft</span>
            </div>
          )}
          {clickedRoom.notes && (
            <p className="text-xs text-white/55 leading-relaxed border-t border-white/10 pt-2 mt-1">
              {clickedRoom.notes}
            </p>
          )}
        </div>
      )}

      {mode==='walk' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white
                        text-xs px-4 py-2 rounded-full backdrop-blur pointer-events-none">
          W/↑ Forward &nbsp;|&nbsp; S/↓ Back &nbsp;|&nbsp; A/← Turn Left &nbsp;|&nbsp; D/→ Turn Right
        </div>
      )}
      {mode==='orbit' && !clickedRoom && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white
                        text-xs px-4 py-2 rounded-full backdrop-blur pointer-events-none">
          Drag to orbit &nbsp;|&nbsp; Scroll to zoom &nbsp;|&nbsp; Click a room for info
        </div>
      )}

      {showHelp && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-30"
          onClick={() => setShowHelp(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white text-base">3D Navigator</h3>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"><X size={18}/></button>
            </div>
            <div className="space-y-4 text-sm text-gray-300">
              <div><p className="font-semibold text-white mb-1">🔓 Open Top (default)</p><p>Roof removed for dollhouse view. Toggle <strong className="text-white">Roof On</strong> to close it.</p></div>
              <div><p className="font-semibold text-white mb-1">🏠 Dollhouse</p><p>Wide elevated angle showing all rooms and furniture at once.</p></div>
              <div><p className="font-semibold text-white mb-1">🚶 Walk Mode</p><p>First-person. W/S move, A/D or arrow keys to turn.</p></div>
              <div><p className="font-semibold text-white mb-1">🌐 Orbit</p><p>Drag to rotate, scroll to zoom, click a room for details.</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
