import { Controls } from "./controls";
import { WorldRandomizer } from "./worldRandomizer";

const WORLD_SIZE = 512; // MUST be 2**n and at least 16

const BASE_SPEED = 8; // cells / second
const SPRINT_SPEED_MULTIPLIER = 2;

export type Cell = number; // int32 (12 bit ID, 20 bits state)

export class World {
    private controls: Controls;

    public size: number; // cells
    public cells: Cell[][]; // indexed [x][y]

    private posX: number; // cells
    private posY: number; // cells

    constructor(controls: Controls) {
        this.controls = controls;

        this.size = WORLD_SIZE;
        this.cells = WorldRandomizer.randomizeCells(WORLD_SIZE);

        this.posX = 0;
        this.posY = 0;
    }

    public tick(tickDiff: number) { // tickDiff: seconds
        const moveBy = ((this.controls.isBindDown("north") != this.controls.isBindDown("south")) && (this.controls.isBindDown("west") != this.controls.isBindDown("east")) ? Math.SQRT1_2 : 1) * (this.controls.isBindDown("sprint") ? SPRINT_SPEED_MULTIPLIER : 1) * BASE_SPEED * tickDiff; // cells

        if (this.controls.isBindDown("north")) this.posY -= moveBy;
        if (this.controls.isBindDown("south")) this.posY += moveBy;
        if (this.controls.isBindDown("west")) this.posX -= moveBy;
        if (this.controls.isBindDown("east")) this.posX += moveBy;
    }

    public getPosX(): number {
        return this.posX;
    }

    public getPosY(): number {
        return this.posY;
    }
}