<template>
  <div class="main" tabindex="0">
    <div class="wrapper">
      <canvas class="bg" :style="canvasStyle" ref="canvasBg" width="200" height="200" />
      <canvas
        class="canvasMain"
        :style="canvasStyle"
        ref="canvas"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        width="200"
        height="200"
      />
    </div>
    <div>
      <input type="color" v-model="selectedColor" />
      <button
        class="palette"
        v-for="c in colors"
        :key="c"
        :style="{backgroundColor: `${c}`}"
        @click="selectColor(c)"
      ></button>
    </div>
    <div>
      <input type="radio" id="pen" value="pen" v-model="tool" />
      <label for="pen">Pen</label>
      <input type="radio" id="eraser" value="eraser" v-model="tool" />
      <label for="eraser">Eraser</label>
      <input type="radio" id="fill" value="fill" v-model="tool" />
      <label for="fill">Fill</label>

      <select v-model.number="scale">
        <option value="1">x1</option>
        <option value="2">x2</option>
        <option value="4">x4</option>
        <option value="8">x8</option>
        <option value="16">x16</option>
        <option value="32">x32</option>
      </select>
      <select v-model.number="strokeWidth">
        <option value="1">w1</option>
        <option value="2">w2</option>
        <option value="3">w3</option>
      </select>
      <button @click="save">SAVE</button>
    </div>
  </div>
</template>

<script lang="ts">
declare function acquireVsCodeApi(): any;

let vscode: any = null;
function postMessage(message: any) {
  if (vscode) {
    vscode.postMessage(message);
  } else {
    window.parent.postMessage(message, "*");
  }
}

try{
  acquireVsCodeApi()
}catch(e){
}


let canvas : HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let imageData : ImageData;
import * as FloodFill from "./flood";
import * as color from "./color";

const colors = [
  "#000000",
  "#9d9d9d",
  "#ffffff",
  "#be2633",
  "#e06f8b",
  "#493c2b",
  "#a46422",
  "#eb8931",
  "#f7e26b",
  "#2f484e",
  "#44891a",
  "#a3ce27",
  "#1b2632",
  "#005784",
  "#31a2f2",
  "#b2dcef"
];
async function loadImageFromData(initialContent: BlobPart) {
  const blob = new Blob([initialContent], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  try {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function getImageData() {
  const outCanvas = document.createElement("canvas");
  outCanvas.width = canvas.width;
  outCanvas.height = canvas.height;

  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) {
    throw new Error("no context");
  }
  outCtx.drawImage(canvas, 0, 0);

  const blob = await new Promise<Blob>((resolve : any) => {
    outCanvas.toBlob(resolve, "image/png");
  }) as Blob;

  return new Uint8Array(await blob.arrayBuffer());
}

function round(p: number) {
  return Math.floor(p);
}
import { defineComponent } from 'vue'

interface Point {
  x: number;
  y: number;
}

export default  defineComponent({
  data() {
    return {
      drag: false,
      old: null as Point | null,
      color: "black",
      lineWidth: 1,
      scale: 16,
      selectedColor: "#000000",
      width: 200,
      height: 200,
      colors: colors,
      strokeWidth: 1,
      tool: "pen",
      ready: false      
    };
  },
  computed: {
    canvasStyle() {
      return {
        transform: `scale(${this.scale})`
      };
    }
  },
  mounted() {
    canvas = this.$refs.canvas as HTMLCanvasElement;
    if (!canvas) {
      throw new Error("canvas not found");
    }
    ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = false;
    window.addEventListener("message", async e => {
      const { type, body, requestId } = e.data;
      console.log("message", type, body);
      switch (type) {
        case "init": {
          if (body.untitled) {
            canvas.height = 32;
            canvas.width = 32;
            this.width = 32
            this.height = 32
            ctx.clearRect(0, 0, 32, 32);
            this.setupCanvasBg(32, 32);
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            postMessage({
              type: "update",
              snapshot: await getImageData()
            })
            return;
          } else {
            // Load the initial image into the canvas.
            const data = new Uint8Array(body.value.data);
            await this.reset(data);
            return;
          }
        }
        case "update": {
          let data = body.content
            ? new Uint8Array(body.content.data)
            : undefined;
          //get last snapshot
          if (body.edits.length > 0) {
            data = body.edits[body.edits.length - 1].snapshot.data;
          }
          if(!data){
            return
          }
          await this.reset(new Uint8Array(data));
          return;
        }
        case "getFileData": {
          // Get the image data for the canvas and post it back to the extension.
          getImageData().then(data => {
            postMessage({
              type: "response",
              requestId,
              body: Array.from(data)
            });
          });
          return;
        }
      }
    });

    postMessage({ type: "ready" });


    // mock init message
    // if(!vscode){
    //   window.dispatchEvent(new MessageEvent('message', {data: {type: 'init', body: {untitled: true}}}))
    // }

  },
  methods: {
    save() {
      postMessage({
        type: "save",
      });
    },
    setupCanvasBg(width: number, height: number) {
      const canvas = this.$refs.canvasBg as HTMLCanvasElement;      
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      canvas.width = width;
      canvas.height = height;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
          const start = (y * imageData.width + x) * 4;
          let bright = x % 2 === 0;
          if (y % 2 === 0) {
            bright = !bright;
          }
          imageData.data[start] = bright ? 200 : 180;
          imageData.data[start + 1] = bright ? 200 : 180;
          imageData.data[start + 2] = bright ? 200 : 180;
          imageData.data[start + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    },
    async reset(data: Uint8Array) {
      if (data) {
        const img = await loadImageFromData(data);
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        this.width = canvas.width;
        this.height = canvas.height;

        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.ready = true;

        this.setupCanvasBg(canvas.width, canvas.height);
        this.redraw();
      }
    },
    down(ev: { button: number; offsetX: any; offsetY: any; pointerId: number; }) {
      if (ev.button === 0) {
        if (this.tool === "fill") {
          this.startFlood(round(ev.offsetX), round(ev.offsetY));
        } else {
          canvas.setPointerCapture(ev.pointerId);
          this.drag = true;
          this.old = {
            x: round(ev.offsetX),
            y: round(ev.offsetY)
          };
          this.move(ev);
        }
      }
      if (ev.button === 2) {
        const pixel = this.getPixel(round(ev.offsetX), round(ev.offsetY));
        this.selectedColor =
          "#" +
          Math.floor(pixel[0]).toString(16) +
          Math.floor(pixel[1]).toString(16) +
          Math.floor(pixel[2]).toString(16);
        if (pixel[3] === 0) {
          this.tool = "eraser";
        } else {
          this.tool = "pen";
        }
      }
    },
    async up(_: any) {
      if (this.drag) {
        this.drag = false;

        postMessage({
          type: "update",
          snapshot: await getImageData()
        });
      }
    },
    move(ev: { offsetX: any; offsetY: any; }) {
      if (this.drag && this.old) {
        this.line(this.old.x, this.old.y, round(ev.offsetX), round(ev.offsetY));
        this.old = {
          x: round(ev.offsetX),
          y: round(ev.offsetY)
        };
        this.redraw();
      }
    },
    redraw() {
      ctx.putImageData(imageData, 0, 0);
    },
    line(x0: number, y0: number, x1: number, y1: number) {
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      while (true) {
        if (this.strokeWidth === 1) {
          this.setPixel(x0, y0);
        }
        if (this.strokeWidth === 2) {
          this.setPixel(x0, y0);
          this.setPixel(x0 + 1, y0);
          this.setPixel(x0, y0 + 1);
          this.setPixel(x0 + 1, y0 + 1);
        }
        if (this.strokeWidth === 3) {
          this.setPixel(x0 - 1, y0 - 1);
          this.setPixel(x0 - 1, y0);
          this.setPixel(x0 - 1, y0 + 1);
          this.setPixel(x0, y0 - 1);
          this.setPixel(x0, y0);
          this.setPixel(x0, y0 + 1);
          this.setPixel(x0 + 1, y0 - 1);
          this.setPixel(x0 + 1, y0);
          this.setPixel(x0 + 1, y0 + 1);
        }

        if (x0 == x1 && y0 == y1) {
          break;
        }
        const e2 = err << 1;
        if (e2 > -dy) {
          err -= dy;
          x0 += sx;
        }
        if (e2 < dx) {
          err += dx;
          y0 += sy;
        }
      }
    },
    setPixel(x: number, y: number) {
      if (x < 0) {
        return;
      }
      if (y < 0) {
        return;
      }
      if (x >= this.width) {
        return;
      }
      if (y >= this.height) {
        return;
      }

      const start = (y * this.width + x) * 4;
      if (this.tool === "eraser") {
        imageData.data[start] = 0;
        imageData.data[start + 1] = 0;
        imageData.data[start + 2] = 0;
        imageData.data[start + 3] = 0;
      } else {
        imageData.data[start] = parseInt(this.selectedColor.slice(1, 3), 16);
        imageData.data[start + 1] = parseInt(
          this.selectedColor.slice(3, 5),
          16
        );
        imageData.data[start + 2] = parseInt(
          this.selectedColor.slice(5, 7),
          16
        );
        imageData.data[start + 3] = 255;
      }
    },
    getPixel(x: number, y: number) {
      if (x < 0 || y < 0 || x > imageData.width || y > imageData.height) {
        return [-1, -1, -1, -1];
      }
      const start = (y * this.width + x) * 4;
      return [
        imageData.data[start],
        imageData.data[start + 1],
        imageData.data[start + 2],
        imageData.data[start + 3]
      ];
    },
    async startFlood(x: number, y: number) {
      const fillColor = color.colorToRGBA(this.selectedColor);

      FloodFill.floodfill(
        imageData.data,
        x,
        y,
        {
          r: fillColor[0],
          g: fillColor[1],
          b: fillColor[2],
          a: fillColor[3]
        },
        0,
        this.width,
        this.height
      );
      postMessage({
        type: "update",
        snapshot: await getImageData()
      });
      this.redraw();
    },
    selectColor(c: string) {
      this.selectedColor = c;
      this.tool = "pen";
    }
  }
})


</script>

<style>
body, html{
  height: 100%;
  margin: 0;
  padding: 0;
  background-color: #111;
}


#app{
  flex: 1;
  height: 100%;
  margin: 0;
  padding: 0;
  display: flex;
}
.main{
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: center;
}

canvas {
  position: absolute;
  top: 0;
  left: 0;
  touch-action: none;
  transform-origin: top left;
  image-rendering: pixelated;
}

.wrapper {
  position: relative;
  width: 800px;
  height: 600px;
  background: #333;
  overflow: scroll;
}

.palette {
  width: 16px;
  height: 16px;
  border: none;
}
</style>