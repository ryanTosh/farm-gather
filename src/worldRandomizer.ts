import { Cell } from "./world";

const DIAMOND_SQUARE_H = 0.25; // [0, 1], lower values produce rougher terrain

export abstract class WorldRandomizer {
    public static randomizeCells(size: number): Cell[][] {
        const heightmap = new Array(size);

        for (let i = 0; i < size; i++) heightmap[i] = new Array(size);

        heightmap[0][0] = 0;

        let diamondQueue: Parameters<typeof diamondStep>[] = [[0, size, 0, size, 1]]; // TODO: should this be 1 or 1 / 2 ** DSH?
        let squareQueue: Parameters<typeof squareStep>[] = [];

        function diamondStep(loX: number, hiX: number, loY: number, hiY: number, multiplier: number) {
            const midX = (loX + hiX) / 2;
            const midY = (loY + hiY) / 2;

            heightmap[midX][midY] = (
                heightmap[loX][loY] +
                heightmap[loX][hiY % size] +
                heightmap[hiX % size][loY] +
                heightmap[hiX % size][hiY % size]
            ) / 4 + (Math.random() - 0.5) * multiplier;

            const nMultiplier = multiplier / 2 ** DIAMOND_SQUARE_H;

            squareQueue.push([midX, hiX * 2 - midX, loY, hiY, nMultiplier]);
            squareQueue.push([loX, hiX, midY, hiY * 2 - midY, nMultiplier]);
        }

        function squareStep(loX: number, hiX: number, loY: number, hiY: number, multiplier: number) {
            const midX = (loX + hiX) / 2;
            const midY = (loY + hiY) / 2;

            heightmap[midX % size][midY % size] = (
                heightmap[loX][midY % size] +
                heightmap[hiX % size][midY % size] +
                heightmap[midX % size][loY] +
                heightmap[midX % size][hiY % size]
            ) / 4 + (Math.random() - 0.5) * multiplier;

            const nMultiplier = multiplier / 2 ** DIAMOND_SQUARE_H; // TODO: should this run in both diamond and square steps?

            diamondQueue.push([midX % size, hiX - Math.floor(midX / size) * size, loY, midY, nMultiplier]);
            diamondQueue.push([midX % size, hiX - Math.floor(midX / size) * size, midY % size, hiY - Math.floor(midY / size) * size, nMultiplier]);
        }

        for (let i = 1; i < size; i *= 2) {
            for (const args of diamondQueue) {
                diamondStep(...args);
            }

            diamondQueue = [];

            for (const args of squareQueue) {
                squareStep(...args);
            }

            squareQueue = [];
        }

        return heightmap;
    }
}