declare module 'canvas' {
  export interface CanvasRenderingContext2D extends CanvasRenderingContext2D {}
  export function createCanvas(width: number, height: number): HTMLCanvasElement;
  export function loadImage(src: string): Promise<HTMLImageElement>;
  export function registerFont(
    path: string,
    options: { family: string; weight?: string; style?: string }
  ): void;
}
