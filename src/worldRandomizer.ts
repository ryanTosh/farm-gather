import { Cell } from "./world";

const DIAMOND_SQUARE_H = 0.25; // [0, 1], lower values produce rougher terrain

const WATER_SOURCE_PROPORTION = 1 / 4096;
const MIN_WATER_CELLS_PER_SOURCE = 128;
const MAX_WATER_CELLS_PER_SOURCE = 2048;

const TREE_ATTEMPT_PROPORTION = 1 / 64;

export abstract class WorldRandomizer {
    public static randomizeCells(size: number): Cell[][] {
        const heightmap = new Array(size);

        for (let i = 0; i < size; i++) heightmap[i] = new Array(size);

        heightmap[0][0] = 0;

        let diamondQueue: Parameters<typeof diamondStep>[] = [[0, size, 0, size, 2]];
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

            const nMultiplier = multiplier / 2 ** DIAMOND_SQUARE_H;

            diamondQueue.push([midX % size, hiX - Math.floor(midX / size) * size, loY, midY, nMultiplier]);
            diamondQueue.push([midX % size, hiX - Math.floor(midX / size) * size, midY % size, hiY - Math.floor(midY / size) * size, nMultiplier]);
        }

        for (let i = 1; i < size; i *= 2) {
            for (const args of diamondQueue) diamondStep(...args);
            diamondQueue = [];

            for (const args of squareQueue) squareStep(...args);
            squareQueue = [];
        }

        const cells = new Array(size);

        for (let i = 0; i < size; i++) cells[i] = new Array(size);

        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                cells[x][y] = Math.min(Math.max(heightmap[x][y] * 256 + 512, 0), 1023) << 20 | 1;
            }
        }

        for (let i = 0; i < Math.ceil(WATER_SOURCE_PROPORTION * size ** 2); i++) {
            const sourceX = Math.floor(Math.random() * size);
            const sourceY = Math.floor(Math.random() * size);

            if (cells[sourceX][sourceY] % 1024 != 1) continue;

            cells[sourceX][sourceY] ^= 3;

            const pqLowestGrass: ({ x: number, y: number, height: number })[] = [];
            const visitedWater: Set<string> = new Set();
            const waterToVisit: [number, number][] = [];

            function visitWater(x: number, y: number) {
                offsets: for (const offset of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    const targX = (x + offset[0] + size) % size;
                    const targY = (y + offset[1] + size) % size;

                    if (cells[targX][targY] % 1024 == 1) {
                        const height = heightmap[targX][targY];

                        let i: number;

                        for (i = 0; i < pqLowestGrass.length; i++) {
                            if (pqLowestGrass[i].x == targX && pqLowestGrass[i].y == targY) continue offsets;
                            if (pqLowestGrass[i].height > height) break;
                        }

                        pqLowestGrass.splice(i, 0, {
                            x: targX,
                            y: targY,
                            height
                        });
                    } else if (cells[targX][targY] % 1024 == 2) {
                        if (!visitedWater.has(targX + "," + targY)) {
                            visitedWater.add(targX + "," + targY);
                            waterToVisit.push([targX, targY]);
                        }
                    }
                }
            }

            visitedWater.add(sourceX + "," + sourceY);
            waterToVisit.push([sourceX, sourceY]);
            while (waterToVisit.length != 0) {
                visitWater(...waterToVisit.shift()!);
            }

            const numWaterCells = Math.ceil(Math.exp(Math.random() * Math.log(MAX_WATER_CELLS_PER_SOURCE / MIN_WATER_CELLS_PER_SOURCE) + Math.log(MIN_WATER_CELLS_PER_SOURCE)));
            for (let i = 1; i < numWaterCells; i++) {
                const lowestGrass = pqLowestGrass.shift();
                if (lowestGrass === undefined) break;

                cells[lowestGrass.x][lowestGrass.y!] ^= 3;

                visitedWater.add(lowestGrass.x + "," + lowestGrass.y);
                waterToVisit.push([lowestGrass.x, lowestGrass.y]);
                while (waterToVisit.length != 0) {
                    visitWater(...waterToVisit.shift()!);
                }
            }
        }

        tree: for (let i = 0; i < Math.ceil(TREE_ATTEMPT_PROPORTION * size ** 2); i++) {
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);

            if (cells[x][y] % 1024 != 1) continue;

            for (let offX = -2; offX <= 2; offX++) {
                for (let offY = -2; offY <= 2; offY++) {
                    const targX = (x + offX + size) % size;
                    const targY = (y + offY + size) % size;
    
                    if (cells[targX][targY] % 1024 != 1 && Math.random() ** 2 < 1 / Math.hypot(targX - x, targY - y)) {
                        continue tree;
                    }
                }
            }

            cells[x][y] ^= 4;
        }

        return cells;
    }
}