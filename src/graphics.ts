import { CanvasManager } from "./canvasManager";
import { Controls } from "./controls";
import { World } from "./world";

const CHUNK_SIZING_FACTOR = 16; // chunks / screenDimension
const MIN_CHUNK_SIZE = 16; // cells / chunk

const CHUNK_LOAD_TICK_LIMIT = 768; // cells / tick

export class Graphics {
    private canvasMgr: CanvasManager;
    private ctx: CanvasRenderingContext2D;

    private world: World;

    private chunkCache: Map<string, HTMLCanvasElement> = new Map(); // key: x,y
    private chunkCacheScale: number | null = null;
    private fallbackChunkCache: Map<string, HTMLCanvasElement> = new Map(); // key: chunkSize,x,y (used when zooming)
    private chunkLoadCounter: number = 0; // cells

    private frameTimes: [number, number][] = [];

    constructor(canvasMgr: CanvasManager, _controls: Controls, world: World) {
        this.canvasMgr = canvasMgr;
        this.ctx = canvasMgr.get2DContext();

        this.world = world;
    }

    public draw(_tickDiff: number) { // tickDiff: seconds
        const pStart = performance.now();

        this.chunkLoadCounter = 0;

        const posX = this.world.getPosX(); // cells
        const posY = this.world.getPosY(); // cells
        const zoom = this.world.getZoom(); // unitless

        const width = this.canvasMgr.getWidth(); // pixels
        const height = this.canvasMgr.getHeight(); // pixels
        const scale = Math.ceil(this.canvasMgr.getBaseScale() * zoom); // pixels / cell (int)
        const chunkSize = this.calculateChunkSize(scale); // cells / chunk

        this.ctx.fillStyle = "#000000";
        this.ctx.fillRect(0, 0, width, height);

        // pixels
        const midpointX = Math.floor(width / 2);
        const midpointY = Math.floor(height / 2);

        // cells
        const loX = Math.floor(posX - midpointX / scale); // cells...
        const hiX = Math.ceil(posX + (midpointX + 1) / scale);
        const loY = Math.floor(posY - midpointY / scale);
        const hiY = Math.ceil(posY + (midpointY + 1) / scale);

        // chunks
        const loChunkX = Math.floor(loX / chunkSize);
        const hiChunkX = Math.floor(hiX / chunkSize);
        const loChunkY = Math.floor(loY / chunkSize);
        const hiChunkY = Math.floor(hiY / chunkSize);

        if (this.chunkCacheScale != scale) {
            this.chunkCache.clear();

            this.chunkCacheScale = scale;
        } else {
            for (const key of [...this.chunkCache.keys()]) {
                const [keyX, keyY] = key.split(",").map(Number);
    
                if (keyX < loChunkX - 2 || keyX > hiChunkX + 2 || keyY < loChunkY - 2 || keyY > hiChunkY + 2) {
                    this.chunkCache.delete(key);
                }
            }
        }

        for (const key of [...this.fallbackChunkCache.keys()]) {
            const [keyX, keyY] = key.split(",").map(Number);

            if (keyX < loChunkX - 2 || keyX > hiChunkX + 2 || keyY < loChunkY - 2 || keyY > hiChunkY + 2) {
                this.chunkCache.delete(key);
            }
        }

        this.ctx.save();
        this.ctx.translate(Math.round(-posX * scale + midpointX), Math.round(-posY * scale + midpointY));

        for (let x = loChunkX; x <= hiChunkX; x++) {
            for (let y = loChunkY; y <= hiChunkY; y++) {
                this.drawChunk(x, y, scale, chunkSize);
            }
        }

        this.ctx.restore();

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        this.ctx.fillRect(0, 0, 300, 200);

        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "top";
        this.ctx.font = "10px system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";

        const times = this.frameTimes.map(t => t[1]).sort((a, b) => a - b);

        this.ctx.fillText("fps: " + this.frameTimes.length, 5, 5);
        this.ctx.fillText("chunkCache size: " + this.chunkCache.size, 5, 20);
        this.ctx.fillText("ticks: " + times[0] + "ms / " + times[Math.floor(times.length / 4)] + "ms / " + times[Math.floor(times.length / 2)] + "ms / " + times[Math.ceil(times.length * 3 / 4)] + "ms / " + times[times.length - 1] + "ms", 5, 35);
        this.ctx.fillText("scale, dims, chunkSize: " + scale + ", " + (width / scale).toFixed(2) + "\xd7" + (height / scale).toFixed(2) + ", " + chunkSize, 5, 50);
        this.ctx.fillText("zoom: " + zoom, 5, 65);

        const pNow = performance.now();

        this.frameTimes = this.frameTimes.filter(t => pNow - t[0] <= 1000).concat([[pNow, Math.round((pNow - pStart) * 1000) / 1000]]);
    }

    private drawChunk(x: number, y: number, scale: number, chunkSize: number) { // x: chunks, y: chunks, scale: pixels / cell, chunkSize: cells / chunk
        const key = x + "," + y;

        const cachedChunk = this.chunkCache.get(key);
        if (cachedChunk !== undefined) {
            this.ctx.drawImage(cachedChunk, x * chunkSize * scale, y * chunkSize * scale);
            return;
        }

        if (this.chunkLoadCounter >= CHUNK_LOAD_TICK_LIMIT) {
            const cachedFallbackChunk = this.fallbackChunkCache.get(chunkSize + "," + key);
            if (cachedFallbackChunk !== undefined) {
                this.ctx.drawImage(cachedFallbackChunk, x * chunkSize * scale, y * chunkSize * scale, chunkSize * scale, chunkSize * scale);
                return;
            }

            const cachedSuperFallbackChunk = this.fallbackChunkCache.get(chunkSize * 2 + "," + Math.floor(x / 2) + "," + Math.floor(y / 2));
            if (cachedSuperFallbackChunk !== undefined) {
                const superChunkHalfWidth = cachedSuperFallbackChunk.width / 2;

                this.ctx.drawImage(cachedSuperFallbackChunk, superChunkHalfWidth * ((x % 2 + 2) % 2), superChunkHalfWidth * ((y % 2 + 2) % 2), superChunkHalfWidth, superChunkHalfWidth, x * chunkSize * scale, y * chunkSize * scale, chunkSize * scale, chunkSize * scale);
                return;
            }

            const subChunkSize = chunkSize / 2;
            for (let subX = x * 2; subX < (x + 1) * 2; subX++) {
                for (let subY = y * 2; subY < (y + 1) * 2; subY++) {
                    const cachedSubFallbackChunk = this.fallbackChunkCache.get(subChunkSize + "," + subX + "," + subY);
                    if (cachedSubFallbackChunk !== undefined) {
                        this.ctx.drawImage(cachedSubFallbackChunk, subX * subChunkSize * scale, subY * subChunkSize * scale, subChunkSize * scale, subChunkSize * scale);
                    }
                }
            }
        } else {
            const chunk = this.loadChunk(x, y, scale, chunkSize);

            this.chunkCache.set(key, chunk);
            this.fallbackChunkCache.set(chunkSize + "," + key, chunk);

            this.chunkLoadCounter += chunkSize ** 2;

            this.ctx.drawImage(chunk, x * chunkSize * scale, y * chunkSize * scale);
            return;
        }
    }

    private calculateChunkSize(scale: number): number { // cells / chunk
        return Math.max(2 ** Math.floor(Math.log2(Math.sqrt(this.canvasMgr.getWidth() * this.canvasMgr.getHeight()) / scale / CHUNK_SIZING_FACTOR)), MIN_CHUNK_SIZE);
    }

    private loadChunk(x: number, y: number, scale: number, chunkSize: number): HTMLCanvasElement { // x: chunks, y: chunks, scale: pixels / cell, chunkSize: cells / chunk
        const chunk = document.createElement("canvas");

        chunk.width = scale * chunkSize;
        chunk.height = scale * chunkSize;

        const chunkCtx = chunk.getContext("2d")!;

        const cellIndexOffset = this.world.size / 2;

        for (let cellX = 0; cellX < chunkSize; cellX++) {
            for (let cellY = 0; cellY < chunkSize; cellY++) {
                const cellIndexX = cellX + x * chunkSize + cellIndexOffset;
                const cellIndexY = cellY + y * chunkSize + cellIndexOffset;

                if (cellIndexX in this.world.cells && cellIndexY in this.world.cells[cellIndexX]) {
                    const cell = this.world.cells[cellIndexX][cellIndexY];

                    // const arg0 = (cell >>> 12) & 0xff;
                    const altitude = ((cell >>> 20) - 512) / 256;

                    switch (cell % 1024) {
                        case 0:
                            chunkCtx.fillStyle = "#000000";
                            break;
                        case 1:
                            chunkCtx.fillStyle = "hsl(115, 50%, " + (altitude * 20 + 40) + "%)";
                            break;
                        case 2:
                            chunkCtx.fillStyle = "hsl(" + (-altitude * 15 + 190) + ", 70%, " + (altitude * 25 + 45) + "%)";
                            break;
                        case 3:
                            chunkCtx.fillStyle = "hsl(30, 40%, " + (altitude * 10 + 25) + "%)";
                            break;
                    }

                    chunkCtx.fillRect(cellX * scale, cellY * scale, scale, scale);

                    if (cell % 1024 != 5 && cell % 1024 != 6) {
                        for (let offX = -3; offX <= 3; offX++) {
                            for (let offY = -3; offY <= 3; offY++) {
                                const offCellIndexX = cellX + offX + x * chunkSize + cellIndexOffset;
                                const offCellIndexY = cellY + offY + y * chunkSize + cellIndexOffset;

                                if (offCellIndexX in this.world.cells && offCellIndexY in this.world.cells[offCellIndexX]) {
                                    const offCell = this.world.cells[offCellIndexX][offCellIndexY];
                                    if (offCell % 1024 == 5 || offCell % 1024 == 6) {
                                        chunkCtx.fillStyle = "hsla(130, " + (-altitude * 20 + 80) + "%, " + (altitude * 20 + 25) + "%, 0.333)";
                                        chunkCtx.fillRect(cellX * scale, cellY * scale, scale, scale);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    chunkCtx.fillStyle = "#000000";
                    chunkCtx.fillRect(cellX * scale, cellY * scale, scale, scale);
                }
            }
        }

        return chunk;
    }
}