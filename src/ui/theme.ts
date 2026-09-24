import Phaser from 'phaser'

export const COLOR = {
  bg: 0x14151f,
  bgCss: '#14151f',
  panel: 0x1e2030,
  panelAlt: 0x252943,
  panelDeep: 0x191b28,
  border: 0x3a3f5c,
  borderBright: 0x5b6288,
  text: '#e8ecf1',
  textFill: 0xe8ecf1,
  textDim: '#8aa1b1',
  accent: 0xf4d35e,
  accentCss: '#f4d35e',
  good: 0x6fbf73,
  goodCss: '#6fbf73',
  danger: 0xe05a5a,
  dangerCss: '#e05a5a',
  primary: 0x3f6b45,
  primaryHover: 0x4f8557,
  primaryPressed: 0x5d9a66,
  primaryCss: '#d7f0dc',
  defaultHover: 0x333955,
  defaultPressed: 0x404a6e,
  overlay: 0x000000,
  moneyCss: '#8fd694',
} as const

export const FONT_FAMILY = 'Silkscreen'
export const FONT_SIZE = { sm: 16, md: 24, lg: 32, xl: 48 } as const
export const PAD = 8

export function textStyle(size: number, color: string, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    color,
    fontStyle: bold ? 'bold' : 'normal',
  }
}

export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size: number,
  color: string,
  bold = false,
): Phaser.GameObjects.Text {
  return scene.add.text(Math.round(x), Math.round(y), content, textStyle(size, color, bold))
}

export function centerText(text: Phaser.GameObjects.Text, x: number, y: number): void {
  text.setPosition(Math.round(x - text.width / 2), Math.round(y - text.height / 2))
}

export function rightAlignText(text: Phaser.GameObjects.Text, xRight: number, y: number): void {
  text.setPosition(Math.round(xRight - text.width), Math.round(y))
}

export function rectHitArea(x: number, y: number, width: number, height: number): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(Math.round(x), Math.round(y), Math.round(width), Math.round(height))
}
