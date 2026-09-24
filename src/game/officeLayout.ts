export const TILE = 48
export const SPRITE_SCALE = 3
export const ROOM = { x: 160, y: 112, cols: 20, rows: 11 }
export const WALL_ROWS = 2
export const FLOOR_TOP = ROOM.y + WALL_ROWS * TILE
export const FLOOR_BOTTOM = ROOM.y + ROOM.rows * TILE

export const CHAR_COLUMNS = 27
export const CHAR_DIR_COLUMN = { left: 23, down: 24, up: 25, right: 26 } as const
export type Direction = keyof typeof CHAR_DIR_COLUMN

export interface TileRef {
  sheet: string
  frame: number
}

export const WALL_TILES = {
  wall: { sheet: 'walls', frame: 0 },
  window: { sheet: 'walls', frame: 9 },
  painting: { sheet: 'walls', frame: 30 },
} satisfies Record<string, TileRef>

export const FURNITURE = {
  desk: { sheet: 'furniture', frame: 7 },
  deskSmall: { sheet: 'furniture', frame: 6 },
  stool: { sheet: 'furniture', frame: 5 },
  shelf: { sheet: 'furniture', frame: 3 },
  plant: { sheet: 'furniture', frame: 12 },
  plantFlower: { sheet: 'furniture', frame: 13 },
  cooler: { sheet: 'furniture', frame: 10 },
  cabinet: { sheet: 'furniture', frame: 9 },
  monitor: { sheet: 'furniture', frame: 22 },
  sofa: { sheet: 'furniture', frame: 17 },
  rugLeft: { sheet: 'furniture', frame: 25 },
  rugRight: { sheet: 'furniture', frame: 26 },
} satisfies Record<string, TileRef>

export const DESK_Y = 352
export const DESK_ROW = 5

const DESK_COLUMNS: Record<number, number[]> = {
  1: [9],
  2: [5, 9, 13],
  3: [5, 8, 11, 14, 17],
}

export interface DeskUnit {
  leftCol: number
  center: number
  spot: { x: number; y: number }
}

export function deskUnits(officeLevel: number): DeskUnit[] {
  const columns = DESK_COLUMNS[officeLevel] ?? DESK_COLUMNS[1]!
  return columns.map((leftCol) => ({
    leftCol,
    center: ROOM.x + leftCol * TILE + TILE,
    spot: { x: ROOM.x + leftCol * TILE + TILE, y: DESK_Y + TILE + TILE / 2 },
  }))
}

export function deskCapacityFor(officeLevel: number): number {
  return deskUnits(officeLevel).length
}

export const WAYPOINTS = [
  { x: 1010, y: 300 },
  { x: 300, y: 330 },
  { x: 620, y: 470 },
  { x: 400, y: 560 },
  { x: 900, y: 570 },
  { x: 736, y: 300 },
]

export const WALK_SPEED = 130
