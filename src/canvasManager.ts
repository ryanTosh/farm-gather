const SCALING_FACTOR = 32; // cells / screenDimension

export class CanvasManager {
    public canvas: HTMLCanvasElement;

    private width!: number; // pixels
    private height!: number; // pixels
    private baseScale!: number; // pixels / cell (unrounded, assumes zoom = 1)

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.scaleCanvas(window.innerWidth, window.innerHeight);

        window.addEventListener("resize", () => {
            this.scaleCanvas(window.innerWidth, window.innerHeight);
        });
    }

    private scaleCanvas(width: number, height: number) {
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.width = width;
        this.height = height;

        this.baseScale = Math.sqrt(width * height) / SCALING_FACTOR;
    }

    public getWidth(): number {
        return this.width;
    }

    public getHeight(): number {
        return this.height;
    }

    public getBaseScale(): number {
        return this.baseScale;
    }

    public get2DContext(): CanvasRenderingContext2D {
        return this.canvas.getContext("2d")!;
    }
}