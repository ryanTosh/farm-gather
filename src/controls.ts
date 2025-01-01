import { CanvasManager } from "./canvasManager";

const LEFT_MOUSE_BTN = 0;
const RIGHT_MOUSE_BTN = 2;

const SINGLE_SCROLL_PIXELS = 8;
const PARTIAL_SCROLL_PIXELS = 20;

interface Binding {
    id: string;
    keys: string[];
    mouseBtns: number[];
    scrollDirs: number[];
}

const bindings: Binding[] = [
    {
        id: "north",
        keys: ["KeyW", "ArrowUp"],
        mouseBtns: [],
        scrollDirs: []
    },
    {
        id: "south",
        keys: ["KeyS", "ArrowDown"],
        mouseBtns: [],
        scrollDirs: []
    },
    {
        id: "west",
        keys: ["KeyA", "ArrowLeft"],
        mouseBtns: [],
        scrollDirs: []
    },
    {
        id: "east",
        keys: ["KeyD", "ArrowRight"],
        mouseBtns: [],
        scrollDirs: []
    },
    {
        id: "scroll",
        keys: [],
        mouseBtns: [LEFT_MOUSE_BTN],
        scrollDirs: []
    },
    {
        id: "use",
        keys: ["KeyF", "Space"],
        mouseBtns: [],
        scrollDirs: []
    },
    {
        id: "sprint",
        keys: ["ShiftLeft", "ShiftRight"],
        mouseBtns: [],
        scrollDirs: []
    },
    {
        id: "invBack",
        keys: ["KeyQ"],
        mouseBtns: [],
        scrollDirs: [-1]
    },
    {
        id: "invFwd",
        keys: ["KeyE"],
        mouseBtns: [],
        scrollDirs: [1]
    },
    {
        id: "zoomIn",
        keys: ["KeyZ"],
        mouseBtns: [3],
        scrollDirs: []
    },
    {
        id: "zoomOut",
        keys: ["KeyX"],
        mouseBtns: [4],
        scrollDirs: []
    }
];

export class Controls {
    private canvas: HTMLCanvasElement;

    private keysDown: Set<string> = new Set();
    private mouseBtnsDown: Set<number> = new Set();

    private mouseOffset: [number, number] | null = null;

    private partialScrollPixels: number = 0;

    private bindNowDownListeners: Map<string, (() => void)[]>;
    private bindUpListeners: Map<string, (() => void)[]>;
    private mouseMoveListeners: ((pointingDir: number | null) => void)[] = [];
    private clearListeners: (() => void)[] = [];

    private keydownListener: (event: KeyboardEvent) => void;
    private keyupListener: (event: KeyboardEvent) => void;
    private mousedownListener: (event: MouseEvent) => void;
    private mouseupListener: (event: MouseEvent) => void;
    private mousemoveListener: (event: MouseEvent) => void;
    private contextmenuListener: (event: MouseEvent) => void;
    private wheelListener: (event: WheelEvent) => void;
    private blurListener: () => void;

    constructor(canvasMgr: CanvasManager) {
        const canvas = canvasMgr.canvas;

        this.canvas = canvas;

        this.bindNowDownListeners = new Map(bindings.map(b => [b.id, []]));
        this.bindUpListeners = new Map(bindings.map(b => [b.id, []]));

        window.addEventListener("keydown", this.keydownListener = (event) => {
            const bindsNowDown = [];

            bindings: for (const binding of bindings) {
                if (binding.keys.includes(event.code)) {
                    if (binding.keys.some((key) => this.keysDown.has(key)) || binding.mouseBtns.some((mouseBtn) => this.mouseBtnsDown.has(mouseBtn))) {
                        continue bindings;
                    }

                    bindsNowDown.push(binding.id);
                }
            }

            this.keysDown.add(event.code);

            for (const bindingId of bindsNowDown) {
                for (const listener of this.bindNowDownListeners.get(bindingId)!) {
                    listener();
                }
            }
        });

        window.addEventListener("keyup", this.keyupListener = (event) => {
            this.keysDown.delete(event.code);

            bindings: for (const binding of bindings) {
                if (binding.keys.includes(event.code)) {
                    if (binding.keys.some((key) => this.keysDown.has(key)) || binding.mouseBtns.some((mouseBtn) => this.mouseBtnsDown.has(mouseBtn))) {
                        continue bindings;
                    }

                    for (const listener of this.bindUpListeners.get(binding.id)!) {
                        listener();
                    }
                }
            }
        });

        canvas.addEventListener("mousedown", this.mousedownListener = (event) => {
            const bindsNowDown = [];

            bindings: for (const binding of bindings) {
                if (binding.mouseBtns.includes(event.button)) {
                    if (binding.keys.some((key) => this.keysDown.has(key)) || binding.mouseBtns.some((mouseBtn) => this.mouseBtnsDown.has(mouseBtn))) {
                        continue bindings;
                    }

                    bindsNowDown.push(binding.id);
                }
            }

            this.mouseBtnsDown.add(event.button);

            for (const bindingId of bindsNowDown) {
                for (const listener of this.bindNowDownListeners.get(bindingId)!) {
                    listener();
                }
            }

            this.partialScrollPixels = 0;
        });

        canvas.addEventListener("mouseup", this.mouseupListener = (event) => {
            this.mouseBtnsDown.delete(event.button);

            bindings: for (const binding of bindings) {
                if (binding.mouseBtns.includes(event.button)) {
                    if (binding.keys.some((key) => this.keysDown.has(key)) || binding.mouseBtns.some((mouseBtn) => this.mouseBtnsDown.has(mouseBtn))) {
                        continue bindings;
                    }

                    for (const listener of this.bindUpListeners.get(binding.id)!) {
                        listener();
                    }
                }
            }

            this.partialScrollPixels = 0;
        });

        canvas.addEventListener("mousemove", this.mousemoveListener = (event) => {
            this.mouseOffset = [event.offsetX, event.offsetY];

            this.partialScrollPixels = 0;

            for (const listener of this.mouseMoveListeners) {
                listener(this.getPointingDir());
            }
        });

        canvas.addEventListener("contextmenu", this.contextmenuListener = (event: MouseEvent) => {
            for (const binding of bindings) {
                if (binding.mouseBtns.includes(RIGHT_MOUSE_BTN)) {
                    event.preventDefault();

                    break;
                }
            }
        });

        canvas.addEventListener("wheel", this.wheelListener = (event) => {
            let dir = 0;

            if (event.deltaMode == event.DOM_DELTA_PIXEL) {
                if (Math.abs(event.deltaY) > SINGLE_SCROLL_PIXELS) {
                    dir = Math.sign(event.deltaY);
                } else if (Math.sign(event.deltaY) == Math.sign(this.partialScrollPixels) || this.partialScrollPixels == 0) {
                    this.partialScrollPixels += event.deltaY;

                    if (Math.abs(this.partialScrollPixels) > PARTIAL_SCROLL_PIXELS) {
                        dir = Math.sign(this.partialScrollPixels);
                    }
                } else {
                    this.partialScrollPixels = event.deltaY;
                }
            } else {
                dir = Math.sign(event.deltaY);
            }

            if (dir != 0) {
                const bindsNowDown = [];

                bindings: for (const binding of bindings) {
                    if (binding.scrollDirs.includes(dir)) {
                        if (binding.keys.some((key) => this.keysDown.has(key)) || binding.mouseBtns.some((mouseBtn) => this.mouseBtnsDown.has(mouseBtn))) {
                            continue bindings;
                        }

                        bindsNowDown.push(binding.id);
                    }
                }

                for (const bindingId of bindsNowDown) {
                    for (const listener of this.bindNowDownListeners.get(bindingId)!) {
                        listener();
                    }
                }

                this.partialScrollPixels = 0;
            }
        });

        window.addEventListener("blur", this.blurListener = () => {
            this.keysDown.clear();
            this.mouseBtnsDown.clear();

            this.mouseOffset = null;

            this.partialScrollPixels = 0;

            for (const listener of this.mouseMoveListeners) {
                listener(this.getPointingDir());
            }
            for (const listener of this.clearListeners) {
                listener();
            }
        });
    }

    public getPointingDir(): number | null {
        return this.mouseOffset === null ? null : Math.atan2(this.mouseOffset[1] - this.canvas.height / 2, this.mouseOffset[0] - this.canvas.width / 2);
    }

    public isBindDown(bindingId: string) {
        const binding = bindings.find(b => b.id == bindingId)!;

        return binding!.keys.some(k => this.keysDown.has(k)) || binding!.mouseBtns.some(b => this.mouseBtnsDown.has(b));
    }

    public onBindNowDown(bindingId: string, fn: () => void) {
        this.bindNowDownListeners.get(bindingId)!.push(fn);
    }

    public onBindUp(bindingId: string, fn: () => void) {
        this.bindUpListeners.get(bindingId)!.push(fn);
    }

    public onMouseMove(fn: (pointingDir: number | null) => void) {
        this.mouseMoveListeners.push(fn);
    }

    public onClear(fn: () => void) {
        this.clearListeners.push(fn);
    }

    public close() {
        window.removeEventListener("keydown", this.keydownListener);
        window.removeEventListener("keyup", this.keyupListener);
        this.canvas.removeEventListener("mousedown", this.mousedownListener);
        this.canvas.removeEventListener("mouseup", this.mouseupListener);
        this.canvas.removeEventListener("mousemove", this.mousemoveListener);
        this.canvas.removeEventListener("contextmenu", this.contextmenuListener);
        this.canvas.removeEventListener("wheel", this.wheelListener);
        window.removeEventListener("blur", this.blurListener);
    }
}