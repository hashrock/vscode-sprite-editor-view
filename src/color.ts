//https://stackoverflow.com/a/24390910

export function colorToRGBA(color: string) {
  // Returns the color as an array of [r, g, b, a] -- all range from 0 - 255
  // color must be a valid canvas fillStyle. This will cover most anything
  // you'd want to use.
  // Examples:
  // colorToRGBA('red')  # [255, 0, 0, 255]
  // colorToRGBA('#f00') # [255, 0, 0, 255]
  let cvs, ctx;
  cvs = document.createElement("canvas");
  cvs.height = 1;
  cvs.width = 1;
  ctx = cvs.getContext("2d");
  if (!ctx) throw new Error("Could not get context from canvas");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  return ctx.getImageData(0, 0, 1, 1).data;
}

export function byteToHex(num: number) {
  // Turns a number (0-255) into a 2-character hex number (00-ff)
  return ("0" + num.toString(16)).slice(-2);
}

export function colorToHex(color: string) {
  // Convert any CSS color to a hex representation
  // Examples:
  // colorToHex('red')            # '#ff0000'
  // colorToHex('rgb(255, 0, 0)') # '#ff0000'
  const rgba = colorToRGBA(color);
  const hex = [0, 1, 2].map(
    function (idx) {
      return byteToHex(rgba[idx]);
    },
  ).join("");
  return "#" + hex;
}
