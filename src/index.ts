import { CanvasManager } from "./canvasManager";
import { Controls } from "./controls";
import { Graphics } from "./graphics";
import { World } from "./world";

const canvasMgr = new CanvasManager(document.getElementById("display") as HTMLCanvasElement);
const controls = new Controls(canvasMgr);
const world = new World(controls);
const graphics = new Graphics(canvasMgr, controls, world);

let lastTime: number | null = null;

function frame(time: number | null) {
    const tickDiff = lastTime === null || time === null ? 0 : (time - lastTime) / 1000;

    lastTime = time;

    if (tickDiff != 0) world.tick(tickDiff);
    graphics.draw(tickDiff);

    window.requestAnimationFrame(frame);
}

frame(null);

controls.onClear(() => {
    lastTime = null;
});