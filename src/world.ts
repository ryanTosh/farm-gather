import { Controls } from "./controls";
import { WorldRandomizer } from "./worldRandomizer";

const WORLD_SIZE = 512; // MUST be 2**n and at least 16

const BASE_SPEED = 8; // cells / second
const SPRINT_SPEED_MULTIPLIER = 2.5;

const ZOOM_SPEED: number = 2; // log(zoom) / seconds
const MAX_ZOOM = 4;

export type Cell = number; // int32 (12 bit ID, 20 bits state)

export class World {
    private controls: Controls;

    public size: number; // cells
    public cells: Cell[][]; // indexed [x][y]

    private posX: number; // cells
    private posY: number; // cells
    private zoom: number; // unitless

    constructor(controls: Controls) {
        this.controls = controls;

        this.size = WORLD_SIZE;
        this.cells = WorldRandomizer.randomizeCells(WORLD_SIZE);

        this.posX = 0;
        this.posY = 0;
        this.zoom = 1;
    }

    public tick(tickDiff: number) { // tickDiff: seconds
        const moveBy = ((this.controls.isBindDown("north") != this.controls.isBindDown("south")) && (this.controls.isBindDown("west") != this.controls.isBindDown("east")) ? Math.SQRT1_2 : 1) * (this.controls.isBindDown("sprint") ? SPRINT_SPEED_MULTIPLIER : 1) * BASE_SPEED * tickDiff / this.zoom; // cells

        if (this.controls.isBindDown("north")) this.posY -= moveBy;
        if (this.controls.isBindDown("south")) this.posY += moveBy;
        if (this.controls.isBindDown("west")) this.posX -= moveBy;
        if (this.controls.isBindDown("east")) this.posX += moveBy;

        if (this.controls.isBindDown("zoomIn")) this.zoom *= ZOOM_SPEED ** tickDiff;
        if (this.controls.isBindDown("zoomOut")) this.zoom /= ZOOM_SPEED ** tickDiff;

        this.zoom = Math.min(this.zoom, MAX_ZOOM);
    }

    public getPosX(): number {
        return this.posX;
    }

    public getPosY(): number {
        return this.posY;
    }

    public getZoom(): number {
        return this.zoom;
    }
}