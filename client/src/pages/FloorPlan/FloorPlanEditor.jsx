import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Text, Group, Transformer, Line, Arc, Image as KonvaImage } from 'react-konva';
import {
  Save, Eye, ArrowLeft, Plus, Trash2, Move,
  RotateCcw, Globe, Upload, EyeOff, X as XIcon,
  AlertTriangle, CheckCircle2, ChevronDown,
  DoorOpen, AppWindow,
} from 'lucide-react';
import api from '../../services/api';

// ── Grid: 1 cell = 20px = 1 sq.ft ────────────────────────
const GRID      = 20;
const CANVAS_W  = 4000;
const CANVAS_H  = 3000;
const DOOR_PX   = 60;    // door width in canvas px  (3 ft — standard residential)
const WIN_PX    = 80;    // window width in canvas px (4 ft — standard residential)
const SNAP_DIST = 18;    // snap threshold px (canvas space, pre-zoom)
const snap      = v => Math.round(v / GRID) * GRID;
const roomArea  = r => Math.round((r.width / GRID) * (r.height / GRID));
let _id = 1;

// ── Find nearest room-edge snap point ─────────────────────
// Positions along wall are snapped to GRID so the door stays stable
function findEdgeSnap(pos, rooms, fixturePx) {
  const fp = fixturePx ?? DOOR_PX;
  let best = null, bestDist = SNAP_DIST * 2; // wider capture zone
  rooms.forEach(room => {
    const { x, y, width, height, id } = room;
    const edges = [
      { side: 'top',    ax: x,       ay: y,        bx: x+width,  by: y        },
      { side: 'bottom', ax: x,       ay: y+height, bx: x+width,  by: y+height },
      { side: 'left',   ax: x,       ay: y,        bx: x,        by: y+height },
      { side: 'right',  ax: x+width, ay: y,        bx: x+width,  by: y+height },
    ];
    edges.forEach(({ side, ax, ay, bx, by }) => {
      const isH = ay === by;
      // Snap along-wall position to grid so the preview is rock-steady
      let nearX, nearY;
      if (isH) {
        const snappedX = snap(pos.x);
        nearX = Math.max(ax + fp/2, Math.min(bx - fp/2, snappedX));
        nearY = ay;
      } else {
        const snappedY = snap(pos.y);
        nearX = ax;
        nearY = Math.max(ay + fp/2, Math.min(by - fp/2, snappedY));
      }
      const dist = Math.hypot(pos.x - nearX, pos.y - nearY);
      if (dist < bestDist) {
        bestDist = dist;
        const len    = isH ? (bx - ax) : (by - ay);
        const offset = isH ? (nearX - ax) / len : (nearY - ay) / len;
        best = { roomId: id, side, offset: Math.max(0.01, Math.min(0.99, offset)), worldX: nearX, worldY: nearY };
      }
    });
  });
  return best;
}

// ── Snap a room's position to align with other room edges ─
const ROOM_SNAP_DIST = GRID * 1.5; // 30px — comfortably catches grid-adjacent edges
function snapRoomToRooms(dragged, allRooms, rawX, rawY) {
  let sx = rawX, sy = rawY;
  const rW = dragged.width, rH = dragged.height;
  let bestDx = ROOM_SNAP_DIST, bestDy = ROOM_SNAP_DIST;

  allRooms.forEach(other => {
    if (other.id === dragged.id) return;
    // X: align my left or right edge with their left or right edge
    [[rawX, other.x], [rawX, other.x + other.width],
     [rawX + rW, other.x], [rawX + rW, other.x + other.width]].forEach(([me, them]) => {
      const d = Math.abs(me - them);
      if (d < bestDx) { bestDx = d; sx = them - (me - rawX); }
    });
    // Y: align my top or bottom edge with their top or bottom edge
    [[rawY, other.y], [rawY, other.y + other.height],
     [rawY + rH, other.y], [rawY + rH, other.y + other.height]].forEach(([me, them]) => {
      const d = Math.abs(me - them);
      if (d < bestDy) { bestDy = d; sy = them - (me - rawY); }
    });
  });
  return { x: sx, y: sy };
}

// ── Blueprint symbols — absolute canvas coords ────────────
// Rendered OUTSIDE room Groups so the Transformer bounding box
// is never inflated by the arc geometry.

// Door: white gap in wall + door-leaf line + quarter-circle swing arc
function DoorSymbolAbs({ room, door, opacity = 1 }) {
  const { x: rX, y: rY, width: rW, height: rH } = room;
  const { side, offset } = door;
  const D = DOOR_PX;

  if (side === 'top' || side === 'bottom') {
    const wallY  = side === 'top' ? rY : rY + rH;
    const cx     = rX + offset * rW;
    const hx     = cx - D / 2;          // hinge x (left of opening)
    const inward = side === 'top' ? 1 : -1;  // +1 = downward into room
    // Arc: hinge at (hx, wallY), sweeps from "along wall" to "into room"
    const arcRot = side === 'top' ? 0 : -90; // top→sweeps right-to-down; bottom→up-to-right
    return (
      <Group opacity={opacity} listening={false}>
        {/* Erase wall segment */}
        <Line points={[hx, wallY, hx + D, wallY]} stroke="#fff" strokeWidth={5} />
        {/* Door leaf (at 90° open, perpendicular into room) */}
        <Line points={[hx, wallY, hx, wallY + D * inward]}
          stroke="#1A3C6B" strokeWidth={1.5} />
        {/* Swing arc */}
        <Arc x={hx} y={wallY} innerRadius={0} outerRadius={D}
          angle={90} rotation={arcRot}
          fill="rgba(37,99,235,0.10)" stroke="#2563EB" strokeWidth={1} />
        {/* Hinge dot */}
        <Line points={[hx - 3, wallY, hx + 3, wallY]} stroke="#1A3C6B" strokeWidth={2} />
      </Group>
    );
  }

  // left / right walls
  const wallX  = side === 'left' ? rX : rX + rW;
  const cy     = rY + offset * rH;
  const hy     = cy - D / 2;
  const inward = side === 'left' ? 1 : -1;  // +1 = rightward into room
  const arcRot = side === 'left' ? 0 : 90;  // left→right-to-down; right→down-to-left
  return (
    <Group opacity={opacity} listening={false}>
      <Line points={[wallX, hy, wallX, hy + D]} stroke="#fff" strokeWidth={5} />
      <Line points={[wallX, hy, wallX + D * inward, hy]}
        stroke="#1A3C6B" strokeWidth={1.5} />
      <Arc x={wallX} y={hy} innerRadius={0} outerRadius={D}
        angle={90} rotation={arcRot}
        fill="rgba(37,99,235,0.10)" stroke="#2563EB" strokeWidth={1} />
      <Line points={[wallX, hy - 3, wallX, hy + 3]} stroke="#1A3C6B" strokeWidth={2} />
    </Group>
  );
}

// Window: white gap + three parallel lines (standard architectural symbol)
function WindowSymbolAbs({ room, win, opacity = 1 }) {
  const { x: rX, y: rY, width: rW, height: rH } = room;
  const { side, offset } = win;
  const W = WIN_PX;
  const GAP = 3; // spacing between the three lines

  if (side === 'top' || side === 'bottom') {
    const wallY = side === 'top' ? rY : rY + rH;
    const cx    = rX + offset * rW;
    return (
      <Group opacity={opacity} listening={false}>
        <Line points={[cx - W/2, wallY, cx + W/2, wallY]} stroke="#fff" strokeWidth={5} />
        <Line points={[cx - W/2, wallY - GAP, cx + W/2, wallY - GAP]} stroke="#374151" strokeWidth={1.5} />
        <Line points={[cx - W/2, wallY,        cx + W/2, wallY]}        stroke="#0284C7" strokeWidth={1.2} />
        <Line points={[cx - W/2, wallY + GAP, cx + W/2, wallY + GAP]} stroke="#374151" strokeWidth={1.5} />
      </Group>
    );
  }

  const wallX = side === 'left' ? rX : rX + rW;
  const cy    = rY + offset * rH;
  return (
    <Group opacity={opacity} listening={false}>
      <Line points={[wallX, cy - W/2, wallX, cy + W/2]} stroke="#fff" strokeWidth={5} />
      <Line points={[wallX - GAP, cy - W/2, wallX - GAP, cy + W/2]} stroke="#374151" strokeWidth={1.5} />
      <Line points={[wallX,       cy - W/2, wallX,       cy + W/2]} stroke="#0284C7" strokeWidth={1.2} />
      <Line points={[wallX + GAP, cy - W/2, wallX + GAP, cy + W/2]} stroke="#374151" strokeWidth={1.5} />
    </Group>
  );
}

// ── Room types ────────────────────────────────────────────
const ROOM_TYPES = [
  { type: 'bedroom',     label: 'Bedroom',     color: '#DBEAFE' },
  { type: 'bathroom',    label: 'Bathroom',    color: '#FEF9C3' },
  { type: 'kitchen',     label: 'Kitchen',     color: '#DCFCE7' },
  { type: 'living_room', label: 'Living Room', color: '#EDE9FE' },
  { type: 'dining',      label: 'Dining',      color: '#FCE7F3' },
  { type: 'balcony',     label: 'Balcony',     color: '#D1FAE5' },
  { type: 'study',       label: 'Study',       color: '#FEF3C7' },
  { type: 'utility',     label: 'Utility',     color: '#F3F4F6' },
  { type: 'corridor',    label: 'Corridor',    color: '#E5E7EB' },
];

// ── Plan types & validation rules ─────────────────────────
// min/max = allowed count of that room type (99 = unlimited)
const PLAN_TYPES = ['Studio', '1BHK', '2BHK', '3BHK', '4BHK', 'Penthouse', 'Villa', 'Commercial'];

const PLAN_RULES = {
  Studio: {
    living_room: { min: 1, max: 1,  label: 'Living Room' },
    kitchen:     { min: 1, max: 1,  label: 'Kitchen'     },
    bathroom:    { min: 1, max: 2,  label: 'Bathroom'    },
  },
  '1BHK': {
    bedroom:     { min: 1, max: 1,  label: 'Bedroom'     },
    living_room: { min: 1, max: 1,  label: 'Living Room' },
    kitchen:     { min: 1, max: 1,  label: 'Kitchen'     },
    bathroom:    { min: 1, max: 2,  label: 'Bathroom'    },
  },
  '2BHK': {
    bedroom:     { min: 2, max: 2,  label: 'Bedroom'     },
    living_room: { min: 1, max: 1,  label: 'Living Room' },
    kitchen:     { min: 1, max: 1,  label: 'Kitchen'     },
    bathroom:    { min: 1, max: 2,  label: 'Bathroom'    },
  },
  '3BHK': {
    bedroom:     { min: 3, max: 3,  label: 'Bedroom'     },
    living_room: { min: 1, max: 1,  label: 'Living Room' },
    kitchen:     { min: 1, max: 1,  label: 'Kitchen'     },
    bathroom:    { min: 2, max: 3,  label: 'Bathroom'    },
  },
  '4BHK': {
    bedroom:     { min: 4, max: 4,  label: 'Bedroom'     },
    living_room: { min: 1, max: 2,  label: 'Living Room' },
    kitchen:     { min: 1, max: 1,  label: 'Kitchen'     },
    bathroom:    { min: 3, max: 99, label: 'Bathroom'    },
  },
  Penthouse: {
    bedroom:     { min: 4, max: 99, label: 'Bedroom'     },
    living_room: { min: 2, max: 2,  label: 'Living Room' },
    kitchen:     { min: 1, max: 1,  label: 'Kitchen'     },
    bathroom:    { min: 4, max: 99, label: 'Bathroom'    },
    study:       { min: 1, max: 99, label: 'Study'       },
    balcony:     { min: 1, max: 99, label: 'Balcony'     },
  },
  Villa: {
    bedroom:     { min: 4, max: 99, label: 'Bedroom'     },
    living_room: { min: 2, max: 99, label: 'Living Room' },
    kitchen:     { min: 1, max: 1,  label: 'Kitchen'     },
    bathroom:    { min: 4, max: 99, label: 'Bathroom'    },
    study:       { min: 1, max: 99, label: 'Study'       },
    utility:     { min: 1, max: 99, label: 'Utility'     },
    balcony:     { min: 1, max: 99, label: 'Balcony'     },
  },
  Commercial: null, // no rules — free-form
};

// ── Helpers ───────────────────────────────────────────────
function validateDesign(rooms, planType, maxSqft) {
  const errors = [];
  const rule   = PLAN_RULES[planType];

  if (rule) {
    const counts = {};
    rooms.forEach(r => { counts[r.room_type] = (counts[r.room_type] || 0) + 1; });

    Object.entries(rule).forEach(([type, { min, max, label }]) => {
      const count = counts[type] || 0;
      if (count < min) {
        errors.push(
          min === max
            ? `Exactly ${min} ${label}${min > 1 ? 's' : ''} required — you have ${count}`
            : `At least ${min} ${label}${min > 1 ? 's' : ''} required — you have ${count}`,
        );
      } else if (count > max && max < 99) {
        errors.push(`Max ${max} ${label}${max > 1 ? 's' : ''} allowed — you have ${count}`);
      }
    });
  }

  const used = rooms.reduce((s, r) => s + roomArea(r), 0);
  if (maxSqft && used > maxSqft) {
    errors.push(`Total area is ${used} sq.ft — exceeds the plan cap of ${maxSqft} sq.ft`);
  }

  return errors;
}

function detectPlanType(rooms) {
  const counts = {};
  rooms.forEach(r => { counts[r.room_type] = (counts[r.room_type] || 0) + 1; });
  const beds    = counts['bedroom']     || 0;
  const living  = counts['living_room'] || 0;
  const utility = counts['utility']     || 0;

  if (beds === 0) return 'Studio';
  if (beds === 1) return '1BHK';
  if (beds === 2) return '2BHK';
  if (beds === 3) return '3BHK';
  if (beds === 4 && living >= 2) return 'Penthouse';
  if (beds === 4) return '4BHK';
  if (utility >= 1) return 'Villa';
  return 'Penthouse';
}

// ── Component ─────────────────────────────────────────────
export default function FloorPlanEditor() {
  const { id }        = useParams();
  const navigate      = useNavigate();
  const stageRef      = useRef(null);
  const trRef         = useRef(null);
  const containerRef  = useRef(null);
  const bpInputRef    = useRef(null);

  const [floorPlan,   setFloorPlan]   = useState(null);
  const [rooms,       setRooms]       = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [tool,        setTool]        = useState('select');
  const [addType,     setAddType]     = useState('bedroom');
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState('');
  const [size,        setSize]        = useState({ w: 800, h: 600 });

  // Plan-type & area cap
  const [planType,    setPlanType]    = useState('2BHK');
  const [maxSqft,     setMaxSqft]    = useState(null);
  const [changingPlan, setChangingPlan] = useState(false);

  // Validation modal
  const [showValidation, setShowValidation] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [pendingAction,    setPendingAction]    = useState(null); // fn to run after dismiss

  // Zoom / pan
  const [stageScale, setStageScale] = useState(1);
  const [stagePos,   setStagePos]   = useState({ x: 0, y: 0 });

  // Door / window hover snap
  const [hoverSnap, setHoverSnap] = useState(null);

  // Blueprint overlay
  const [bpUrl,     setBpUrl]     = useState(null);
  const [bpImg,     setBpImg]     = useState(null);
  const [bpOpacity, setBpOpacity] = useState(0.35);
  const [bpVisible, setBpVisible] = useState(true);

  // ── Derived ────────────────────────────────────────────
  const totalUsed     = useMemo(() => rooms.reduce((s, r) => s + roomArea(r), 0), [rooms]);
  const areaPercent   = maxSqft ? Math.min(100, Math.round((totalUsed / maxSqft) * 100)) : 0;
  const areaOverLimit = maxSqft ? totalUsed > maxSqft : false;

  // ── Load floor plan ────────────────────────────────────
  useEffect(() => {
    if (!id || id === 'new') return;
    api.get(`/floor-plans/${id}`).then(r => {
      const fp = r.data.data;
      setFloorPlan(fp);
      setPlanType(fp.unit_type || '2BHK');
      setMaxSqft(fp.area_sqft ? Number(fp.area_sqft) : null);
      if (fp.rooms?.length) {
        setRooms(fp.rooms.map((rm, i) => {
          let doors = [], windows = [];
          if (rm.metadata) {
            try {
              const m = typeof rm.metadata === 'string' ? JSON.parse(rm.metadata) : rm.metadata;
              doors   = m.doors   || [];
              windows = m.windows || [];
            } catch {}
          }
          return { ...rm, id: rm.id || `r${i}`, doors, windows };
        }));
      }
    });
  }, [id]);

  // ── Resize canvas ──────────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setSize({ w: width, h: height });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Transformer ────────────────────────────────────────
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    const node = selectedId
      ? stageRef.current.findOne(`#${CSS.escape(selectedId)}`)
      : null;
    trRef.current.nodes(node ? [node] : []);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedId]);

  // ── Blueprint image ────────────────────────────────────
  useEffect(() => {
    if (!bpUrl) { setBpImg(null); return; }
    const img    = new window.Image();
    img.onload   = () => setBpImg(img);
    img.onerror  = () => { setBpImg(null); setBpUrl(null); };
    img.src      = bpUrl;
    return () => { img.onload = null; img.onerror = null; };
  }, [bpUrl]);

  useEffect(() => {
    return () => { if (bpUrl) URL.revokeObjectURL(bpUrl); };
  }, [bpUrl]);

  const handleBpUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (bpUrl) URL.revokeObjectURL(bpUrl);
    setBpUrl(URL.createObjectURL(file));
    setBpVisible(true);
    e.target.value = '';
  };

  const removeBp = () => {
    if (bpUrl) URL.revokeObjectURL(bpUrl);
    setBpUrl(null);
    setBpImg(null);
  };

  // ── Zoom / pan helpers ────────────────────────────────
  const handleWheel = useCallback(e => {
    e.evt.preventDefault();
    const stage    = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer  = stage.getPointerPosition();
    const factor   = 1.08;
    const newScale = Math.max(0.2, Math.min(5,
      e.evt.deltaY < 0 ? oldScale * factor : oldScale / factor,
    ));
    const to = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    setStageScale(newScale);
    setStagePos({ x: pointer.x - to.x * newScale, y: pointer.y - to.y * newScale });
  }, []);

  const zoomBy = (delta) => {
    const newScale = Math.max(0.2, Math.min(5, stageScale * (delta > 0 ? 1.2 : 1 / 1.2)));
    // Zoom toward centre of viewport
    const cx = size.w / 2;
    const cy = size.h / 2;
    const to = { x: (cx - stagePos.x) / stageScale, y: (cy - stagePos.y) / stageScale };
    setStageScale(newScale);
    setStagePos({ x: cx - to.x * newScale, y: cy - to.y * newScale });
  };

  const resetZoom = () => { setStageScale(1); setStagePos({ x: 0, y: 0 }); };

  // ── Mouse move: snap detection for door/window tools ──
  const handleMouseMove = useCallback(e => {
    if (tool !== 'door' && tool !== 'window') {
      if (hoverSnap) setHoverSnap(null);
      return;
    }
    const pos = e.target.getStage()?.getRelativePointerPosition();
    if (!pos) return;
    const fp = tool === 'window' ? WIN_PX : DOOR_PX;
    const found = findEdgeSnap(pos, rooms, fp);
    // Only update state when snap target actually changes — eliminates re-render churn
    setHoverSnap(prev => {
      if (!found && !prev) return prev;
      if (!found) return null;
      if (prev && prev.roomId === found.roomId && prev.side === found.side &&
          Math.abs(prev.offset - found.offset) < 0.001) return prev;
      return found;
    });
  }, [tool, rooms, hoverSnap]);

  // ── Add room / place fixture ───────────────────────────
  const addRoom = useCallback(e => {
    // Door / window placement
    if (tool === 'door' || tool === 'window') {
      if (!hoverSnap) return;
      const key = tool === 'door' ? 'doors' : 'windows';
      setRooms(prev => prev.map(r => {
        if (r.id !== hoverSnap.roomId) return r;
        const existing = r[key] || [];
        // Toggle: clicking same side removes existing fixture on that side
        const already = existing.find(f => f.side === hoverSnap.side &&
          Math.abs(f.offset - hoverSnap.offset) < 0.08);
        if (already) return { ...r, [key]: existing.filter(f => f.id !== already.id) };
        const filtered = existing.filter(f => f.side !== hoverSnap.side); // one per side
        return { ...r, [key]: [...filtered, { id: `f${Date.now()}`, side: hoverSnap.side, offset: hoverSnap.offset }] };
      }));
      return;
    }

    if (tool !== 'add') {
      if (e.target === e.target.getStage()) setSelectedId(null);
      return;
    }
    // getRelativePointerPosition accounts for current zoom + pan
    const pos = e.target.getStage().getRelativePointerPosition();
    const rt  = ROOM_TYPES.find(r => r.type === addType) || ROOM_TYPES[0];

    // Default room: 12×10 cells = 120 sq.ft — clamp to remaining area
    const defaultW  = 12 * GRID; // 240px
    const defaultH  = 10 * GRID; // 200px
    const newArea   = Math.round((defaultW / GRID) * (defaultH / GRID));
    const remaining = maxSqft ? maxSqft - totalUsed : Infinity;

    if (remaining <= 0) {
      // No room left — show gentle banner instead of blocking
      setSaveMsg('Area cap reached — resize existing rooms to free up space');
      setTimeout(() => setSaveMsg(''), 3000);
      return;
    }

    const nr = {
      id:        `r${++_id}${Date.now()}`,
      name:      rt.label,
      room_type: addType,
      x:         snap(pos.x - defaultW / 2),
      y:         snap(pos.y - defaultH / 2),
      width:     defaultW,
      height:    defaultH,
      color:     rt.color,
      notes:     '',
      doors:     [],
      windows:   [],
    };
    setRooms(p => [...p, nr]);
    setSelectedId(nr.id);
    setTool('select');
  }, [tool, addType, maxSqft, totalUsed]);

  const upd = useCallback(
    (rid, attrs) => setRooms(p => p.map(r => r.id === rid ? { ...r, ...attrs } : r)),
    [],
  );

  // ── Validate then act ──────────────────────────────────
  const runWithValidation = (action) => {
    const errors = validateDesign(rooms, planType, maxSqft);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setPendingAction(() => action);
      setShowValidation(true);
      return;
    }
    action();
  };

  // ── Save ───────────────────────────────────────────────
  const doSave = async () => {
    if (!id || id === 'new') return;
    setSaving(true);
    try {
      await api.post(`/floor-plans/${id}/rooms`, {
        rooms: rooms.map(r => ({
          name:      r.name,
          roomType:  r.room_type,
          areaSqft:  roomArea(r),
          x:         r.x,
          y:         r.y,
          width:     r.width,
          height:    r.height,
          color:     r.color,
          notes:     r.notes,
          metadata:  (r.doors?.length || r.windows?.length)
            ? { doors: r.doors || [], windows: r.windows || [] }
            : null,
        })),
      });
      await api.put(`/floor-plans/${id}`, {
        unitType:   planType,
        canvasData: { rooms, version: 1 },
      });
      setSaveMsg('Saved ✓');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('Error saving');
    } finally {
      setSaving(false);
    }
  };

  const handleSave    = () => runWithValidation(doSave);
  const handlePublish = () => runWithValidation(async () => {
    await doSave();
    await api.post(`/floor-plans/${id}/publish`, { publish: true });
    navigate(`/viewer/${id}`);
  });

  // ── Update plan type to match current design ───────────
  const updatePlanToMatch = () => {
    const detected = detectPlanType(rooms);
    setPlanType(detected);
    setShowValidation(false);
    // Run the pending action with new plan type synchronously after state settles
    // by clearing errors and letting user click Save again
    setValidationErrors([]);
    setSaveMsg(`Plan updated to ${detected} — save again to confirm`);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  // ── Grid lines — cover virtual canvas so grid stays visible when panned ──
  const gridLines = [];
  for (let x = 0; x <= CANVAS_W; x += GRID) gridLines.push([x, 0, x, CANVAS_H]);
  for (let y = 0; y <= CANVAS_H; y += GRID) gridLines.push([0, y, CANVAS_W, y]);

  const sel = rooms.find(r => r.id === selectedId);

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-900 overflow-hidden">

      {/* ── Top bar ── */}
      <header className="h-14 bg-primary-800 flex items-center gap-3 px-4 text-white flex-shrink-0">
        <button onClick={() => navigate('/floor-plans')}
          className="p-1.5 rounded hover:bg-primary-700 text-primary-200">
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate">
            {floorPlan?.name || 'Floor Plan Editor'}
          </h1>
          <p className="text-xs text-primary-300">
            {floorPlan?.building_name} · Floor {floorPlan?.floor_number}
          </p>
        </div>

        {/* Live area indicator */}
        {maxSqft && (
          <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full font-medium
            ${areaOverLimit
              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
              : 'bg-primary-700/60 text-primary-200'}`}>
            {areaOverLimit && <AlertTriangle size={12} />}
            <span>{totalUsed} / {maxSqft} sq.ft</span>
          </div>
        )}

        {saveMsg && (
          <span className={`text-xs px-2 py-1 rounded ${
            saveMsg.startsWith('Saved')
              ? 'bg-green-600/30 text-green-300'
              : saveMsg.includes('cap') || saveMsg.includes('Error')
                ? 'bg-red-600/30 text-red-300'
                : 'bg-yellow-600/30 text-yellow-200'
          }`}>
            {saveMsg}
          </span>
        )}

        <button onClick={() => navigate(`/viewer/${id}`)}
          className="btn-secondary btn-sm border-primary-600 text-white hover:bg-primary-700">
          <Eye size={14} /> Preview 3D
        </button>
        <button onClick={handleSave} disabled={saving}
          className="btn-secondary btn-sm border-primary-600 text-white hover:bg-primary-700">
          <Save size={14} /> {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={handlePublish}
          className="btn-sm bg-accent-500 hover:bg-accent-600 text-white rounded-lg px-3 py-1.5 font-semibold flex items-center gap-1.5">
          <Globe size={14} /> Publish
        </button>
      </header>

      {/* ── Area progress bar ── */}
      {maxSqft && (
        <div className="h-1.5 bg-gray-700 flex-shrink-0">
          <div
            className={`h-full transition-all duration-300 ${
              areaOverLimit ? 'bg-red-500' : areaPercent > 85 ? 'bg-yellow-400' : 'bg-green-500'
            }`}
            style={{ width: `${areaPercent}%` }}
          />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ── */}
        <aside className="w-52 bg-gray-800 flex flex-col flex-shrink-0 overflow-y-auto text-white">

          {/* Plan type */}
          <div className="p-3 border-b border-gray-700">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-2">
              Plan Type
            </p>
            {!changingPlan ? (
              <button
                onClick={() => setChangingPlan(true)}
                className="w-full flex items-center justify-between px-2 py-2 rounded
                           bg-primary-700/40 border border-primary-600/40 text-white
                           hover:bg-primary-700/60 text-xs font-semibold">
                <span>{planType}</span>
                <ChevronDown size={12} className="text-primary-300" />
              </button>
            ) : (
              <div className="space-y-1">
                {PLAN_TYPES.map(pt => (
                  <button key={pt}
                    onClick={() => { setPlanType(pt); setChangingPlan(false); }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors
                      ${planType === pt
                        ? 'bg-primary-600 text-white font-semibold'
                        : 'text-gray-300 hover:bg-gray-700'}`}>
                    {pt}
                    {PLAN_RULES[pt] && (
                      <span className="ml-1 text-gray-500 font-normal">
                        · {Object.values(PLAN_RULES[pt]).filter(r => r.min > 0).map(r =>
                            `${r.min}${r.max < 99 && r.max !== r.min ? '-'+r.max : r.max === 99 ? '+' : ''} ${r.label}`
                          ).slice(0,2).join(', ')}
                      </span>
                    )}
                  </button>
                ))}
                <button onClick={() => setChangingPlan(false)}
                  className="w-full text-[10px] text-gray-500 hover:text-gray-300 py-1 text-center">
                  Cancel
                </button>
              </div>
            )}

            {/* Area summary */}
            {maxSqft && (
              <div className="mt-2 text-[10px] text-gray-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>Used</span>
                  <span className={areaOverLimit ? 'text-red-400 font-semibold' : 'text-white'}>
                    {totalUsed} sq.ft
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cap</span>
                  <span>{maxSqft} sq.ft</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining</span>
                  <span className={maxSqft - totalUsed < 0 ? 'text-red-400' : 'text-green-400'}>
                    {maxSqft - totalUsed} sq.ft
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Tool picker */}
          <div className="p-3 border-b border-gray-700">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-2">
              Tool
            </p>
            <div className="grid grid-cols-2 gap-1">
              {[
                { key: 'select', label: 'Select',  icon: <Move size={12} /> },
                { key: 'add',    label: 'Add Room', icon: <Plus size={12} /> },
                { key: 'door',   label: 'Door',     icon: <DoorOpen size={12} /> },
                { key: 'window', label: 'Window',   icon: <AppWindow size={12} /> },
              ].map(t => (
                <button key={t.key} onClick={() => { setTool(t.key); setHoverSnap(null); }}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium
                    ${tool === t.key
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'}`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
            {(tool === 'door' || tool === 'window') && (
              <p className="text-[10px] text-primary-400 mt-1.5 leading-tight">
                Hover near a room edge, click to place. Click again to remove.
              </p>
            )}
          </div>

          {/* Room type list */}
          <div className="p-3 border-b border-gray-700">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-2">
              Room Type
            </p>

            {/* Required rooms checklist */}
            {PLAN_RULES[planType] && (
              <div className="mb-2 space-y-0.5">
                {Object.entries(PLAN_RULES[planType]).map(([type, { min, label }]) => {
                  const count  = rooms.filter(r => r.room_type === type).length;
                  const met    = count >= min;
                  return (
                    <div key={type} className="flex items-center justify-between text-[10px]">
                      <span className={met ? 'text-green-400' : 'text-red-400'}>{label}</span>
                      <span className={met ? 'text-green-400' : 'text-red-400'}>
                        {met ? '✓' : `${count}/${min}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-0.5">
              {ROOM_TYPES.map(rt => (
                <button key={rt.type}
                  onClick={() => { setAddType(rt.type); setTool('add'); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors
                    ${addType === rt.type && tool === 'add'
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'}`}>
                  <span className="w-3 h-3 rounded flex-shrink-0"
                    style={{ background: rt.color, border: '1px solid rgba(0,0,0,.15)' }} />
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Blueprint upload */}
          <div className="p-3 border-b border-gray-700">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-2">
              Blueprint
            </p>
            {!bpUrl ? (
              <>
                <input ref={bpInputRef} type="file" accept="image/*"
                  className="hidden" onChange={handleBpUpload} />
                <button onClick={() => bpInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-2 py-2
                             rounded border border-dashed border-gray-600 text-gray-400
                             hover:border-primary-500 hover:text-primary-400 text-xs transition-colors">
                  <Upload size={12} /> Upload Image
                </button>
                <p className="text-[10px] text-gray-600 mt-1.5 leading-tight">
                  Upload a JPG / PNG blueprint to trace over.
                </p>
              </>
            ) : (
              <div className="space-y-2">
                {bpImg && (
                  <div className="rounded overflow-hidden bg-gray-700 h-16">
                    <img src={bpUrl} alt="blueprint" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <button onClick={() => setBpVisible(v => !v)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs
                      ${bpVisible
                        ? 'bg-primary-700/50 text-primary-300 hover:bg-primary-700/70'
                        : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}`}>
                    {bpVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                    {bpVisible ? 'Visible' : 'Hidden'}
                  </button>
                  <button onClick={removeBp}
                    className="p-1.5 rounded bg-red-900/30 text-red-400 hover:bg-red-800/40">
                    <XIcon size={12} />
                  </button>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Opacity</span><span>{Math.round(bpOpacity * 100)}%</span>
                  </div>
                  <input type="range" min="0.05" max="1" step="0.05"
                    value={bpOpacity}
                    onChange={e => setBpOpacity(Number(e.target.value))}
                    className="w-full h-1.5 accent-primary-500 cursor-pointer" />
                </div>
                <input ref={bpInputRef} type="file" accept="image/*"
                  className="hidden" onChange={handleBpUpload} />
                <button onClick={() => bpInputRef.current?.click()}
                  className="w-full text-[10px] text-gray-500 hover:text-gray-300 text-center py-0.5">
                  Replace image
                </button>
              </div>
            )}
          </div>

          {/* Rooms list */}
          <div className="p-3 flex-1">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-2">
              Rooms ({rooms.length})
            </p>
            <div className="space-y-0.5">
              {rooms.map(r => (
                <button key={r.id}
                  onClick={() => { setSelectedId(r.id); setTool('select'); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left
                    ${selectedId === r.id
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'}`}>
                  <span className="w-3 h-3 rounded flex-shrink-0" style={{ background: r.color }} />
                  <span className="truncate flex-1">{r.name}</span>
                  <span className="opacity-50 text-[10px] flex-shrink-0">{roomArea(r)}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Canvas ── */}
        <div ref={containerRef}
          className={`flex-1 overflow-hidden bg-white relative ${
            tool === 'add' ? 'cursor-crosshair' :
            (tool === 'door' || tool === 'window') ? 'cursor-cell' : ''
          }`}>
          {size.w > 0 && (
            <Stage
              ref={stageRef}
              width={size.w}
              height={size.h}
              scaleX={stageScale}
              scaleY={stageScale}
              x={stagePos.x}
              y={stagePos.y}
              draggable={tool === 'select'}
              onDragEnd={e => setStagePos({ x: e.target.x(), y: e.target.y() })}
              onWheel={handleWheel}
              onMouseMove={handleMouseMove}
              onClick={addRoom}
            >
              <Layer>
                {bpImg && bpVisible && (
                  <KonvaImage image={bpImg} x={0} y={0}
                    width={size.w} height={size.h}
                    opacity={bpOpacity} listening={false} />
                )}
                {gridLines.map((pts, i) => (
                  <Line key={i} points={pts} stroke="#E5E7EB"
                    strokeWidth={0.5} listening={false} />
                ))}
                {rooms.map(room => (
                  <Group key={room.id} id={room.id}
                    x={room.x} y={room.y} draggable
                    onClick={() => {
                      // In door/window mode, clicking a room places a fixture (handled by
                      // Stage onClick / addRoom). Don't change selection here — it would
                      // attach the Transformer and inflate the bounding box.
                      if (tool === 'door' || tool === 'window') return;
                      setSelectedId(room.id);
                      setTool('select');
                    }}
                    onTap={() => {
                      if (tool === 'door' || tool === 'window') return;
                      setSelectedId(room.id);
                    }}
                    onDragEnd={e => {
                      const gridX = snap(e.target.x());
                      const gridY = snap(e.target.y());
                      const { x, y } = snapRoomToRooms(room, rooms, gridX, gridY);
                      e.target.x(x); e.target.y(y);
                      upd(room.id, { x, y });
                    }}
                    onTransformEnd={e => {
                      const n    = e.target;
                      const newW = Math.max(GRID, snap(room.width  * n.scaleX()));
                      const newH = Math.max(GRID, snap(room.height * n.scaleY()));
                      upd(room.id, {
                        x: snap(n.x()), y: snap(n.y()),
                        width: newW, height: newH,
                      });
                      n.scaleX(1); n.scaleY(1);
                    }}
                  >
                    <Rect
                      width={room.width} height={room.height}
                      fill={room.color}
                      stroke={selectedId === room.id ? '#1A3C6B' : '#9CA3AF'}
                      strokeWidth={selectedId === room.id ? 2 : 1}
                      cornerRadius={2}
                      shadowEnabled={selectedId === room.id}
                      shadowColor="#1A3C6B" shadowBlur={8} shadowOpacity={0.25}
                    />
                    <Text text={room.name}
                      width={room.width} height={room.height}
                      align="center" verticalAlign="middle"
                      fontSize={Math.min(13, room.width / 7)}
                      fontStyle="bold" fontFamily="Inter,sans-serif"
                      fill="#374151" listening={false} />
                    <Text
                      text={`${roomArea(room)} sq.ft`}
                      y={room.height - 16}
                      width={room.width} align="center"
                      fontSize={9} fill="#9CA3AF" listening={false} />

                    {/* Door/window symbols are rendered OUTSIDE this Group — see below */}
                  </Group>
                ))}
                <Transformer ref={trRef} rotateEnabled={false}
                  boundBoxFunc={(_, nb) => ({
                    ...nb,
                    width:  Math.max(GRID, nb.width),
                    height: Math.max(GRID, nb.height),
                  })} />
              </Layer>

              {/* ── Fixture layer — completely separate from Transformer layer ── */}
              <Layer listening={false}>
                {rooms.flatMap(room => [
                  ...(room.doors   || []).map(d =>
                    <DoorSymbolAbs   key={d.id} room={room} door={d} />),
                  ...(room.windows || []).map(w =>
                    <WindowSymbolAbs key={w.id} room={room} win={w}  />),
                ])}
                {/* Hover preview */}
                {hoverSnap && (() => {
                  const room = rooms.find(r => r.id === hoverSnap.roomId);
                  if (!room) return null;
                  const fixture = { side: hoverSnap.side, offset: hoverSnap.offset };
                  return tool === 'door'
                    ? <DoorSymbolAbs   room={room} door={fixture} opacity={0.55} />
                    : <WindowSymbolAbs room={room} win={fixture}  opacity={0.55} />;
                })()}
              </Layer>
            </Stage>
          )}

          {tool === 'add' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none
                            bg-primary-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
              Click to place {ROOM_TYPES.find(r => r.type === addType)?.label}
              {maxSqft && <span className="ml-2 text-primary-300">· {maxSqft - totalUsed} sq.ft remaining</span>}
            </div>
          )}

          {bpImg && bpVisible && rooms.length === 0 && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 pointer-events-none
                            bg-primary-900/80 text-primary-200 text-xs px-3 py-1.5 rounded-full shadow-lg">
              Blueprint loaded — pick a room type then click to trace
            </div>
          )}

          {/* ── Zoom controls ── */}
          <div className="absolute bottom-4 left-4 flex items-center gap-1
                          bg-gray-800/90 backdrop-blur border border-gray-700
                          rounded-lg px-1 py-1 shadow-lg z-10">
            <button onClick={() => zoomBy(-1)}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-300
                         hover:bg-gray-700 text-base font-bold leading-none">
              −
            </button>
            <button onClick={resetZoom}
              className="px-2 h-7 text-xs text-gray-300 hover:bg-gray-700 rounded
                         min-w-[46px] text-center font-mono tabular-nums">
              {Math.round(stageScale * 100)}%
            </button>
            <button onClick={() => zoomBy(1)}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-300
                         hover:bg-gray-700 text-base font-bold leading-none">
              +
            </button>
          </div>

          {/* ── Scale indicator ── */}
          <div className="absolute bottom-4 right-4 flex items-center gap-3
                          bg-gray-800/90 backdrop-blur border border-gray-700
                          rounded-lg px-3 py-1.5 text-xs text-gray-400 shadow-lg z-10 select-none">
            {/* mini ruler */}
            <div className="flex items-center gap-1">
              <div className="flex items-end gap-px">
                <div className="w-px h-2 bg-gray-400" />
                <div className="w-5 h-px bg-gray-400" style={{ width: `${20 * stageScale}px`, maxWidth: 60, minWidth: 8 }} />
                <div className="w-px h-2 bg-gray-400" />
              </div>
              <span className="text-gray-300 font-medium">1 sq.ft</span>
            </div>
            <span className="text-gray-600">|</span>
            <span>
              {tool === 'select'  ? 'Drag canvas to pan' :
               tool === 'door'   ? (hoverSnap ? 'Click to place door' : 'Hover near a wall edge') :
               tool === 'window' ? (hoverSnap ? 'Click to place window' : 'Hover near a wall edge') :
               `Click to place ${ROOM_TYPES.find(r => r.type === addType)?.label}`}
            </span>
          </div>
        </div>

        {/* ── Properties panel ── */}
        <aside className="w-52 bg-gray-800 flex-shrink-0 p-3 overflow-y-auto text-white">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-3">
            Properties
          </p>

          {!sel ? (
            <p className="text-xs text-gray-500">Select a room to edit its properties.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Name</label>
                <input
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs
                             text-white focus:outline-none focus:border-primary-500"
                  value={sel.name}
                  onChange={e => upd(selectedId, { name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Type</label>
                <select
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs
                             text-white focus:outline-none"
                  value={sel.room_type}
                  onChange={e => {
                    const rt = ROOM_TYPES.find(r => r.type === e.target.value);
                    upd(selectedId, { room_type: e.target.value, color: rt?.color || sel.color });
                  }}
                >
                  {ROOM_TYPES.map(r => <option key={r.type} value={r.type}>{r.label}</option>)}
                </select>
              </div>

              {/* Area — read-only, auto-computed */}
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">
                  Area
                  <span className="ml-1 text-gray-600">(auto)</span>
                </label>
                <div className="w-full bg-gray-700/50 border border-gray-700 rounded px-2 py-1.5
                                text-xs text-white/60 flex items-center justify-between">
                  <span className="font-semibold text-white">{roomArea(sel)} sq.ft</span>
                  <span className="text-gray-500 text-[10px]">
                    {Math.round(sel.width / GRID)}×{Math.round(sel.height / GRID)} ft
                  </span>
                </div>
                <p className="text-[10px] text-gray-600 mt-1">
                  Resize the room on canvas to change area.
                </p>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Color</label>
                <div className="flex flex-wrap gap-1">
                  {ROOM_TYPES.map(rt => (
                    <button key={rt.type} title={rt.label}
                      onClick={() => upd(selectedId, { color: rt.color })}
                      className="w-5 h-5 rounded border-2 hover:scale-110 transition-transform"
                      style={{
                        background:  rt.color,
                        borderColor: sel.color === rt.color ? '#1A3C6B' : 'transparent',
                      }} />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Size</label>
                <p className="text-xs text-gray-300">
                  {Math.round(sel.width / GRID)} × {Math.round(sel.height / GRID)} ft
                </p>
                <p className="text-xs text-gray-500">
                  ({Math.round(sel.width)}px × {Math.round(sel.height)}px)
                </p>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Notes</label>
                <textarea rows={2}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs
                             text-white focus:outline-none resize-none"
                  placeholder="e.g. Marble flooring"
                  value={sel.notes || ''}
                  onChange={e => upd(selectedId, { notes: e.target.value })}
                />
              </div>

              <button
                onClick={() => { setRooms(p => p.filter(r => r.id !== selectedId)); setSelectedId(null); }}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded
                           bg-red-900/30 border border-red-800 text-red-400
                           hover:bg-red-800/40 text-xs font-medium">
                <Trash2 size={12} /> Delete Room
              </button>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-700">
            <button
              onClick={() => { setRooms([]); setSelectedId(null); }}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded
                         bg-gray-700 text-gray-400 hover:bg-gray-600 text-xs">
              <RotateCcw size={12} /> Clear All
            </button>
          </div>
        </aside>
      </div>

      {/* ── Validation modal ── */}
      {showValidation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">

            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-gray-700">
              <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Design doesn't match the plan</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fix the issues below, or update the plan to match what you've drawn.
                </p>
              </div>
            </div>

            {/* Error list */}
            <div className="p-5 space-y-2">
              {validationErrors.map((err, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
                  <span className="text-gray-200">{err}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="p-5 pt-0 flex flex-col gap-2">
              {/* Update plan — primary CTA */}
              <button
                onClick={updatePlanToMatch}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                           bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm transition-colors">
                <CheckCircle2 size={15} />
                Update Plan to "{detectPlanType(rooms)}" & Continue
              </button>

              {/* Fix manually */}
              <button
                onClick={() => setShowValidation(false)}
                className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700
                           text-gray-300 text-sm transition-colors">
                Fix Manually
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
