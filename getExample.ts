const f = await Deno.readFile("./public/sprite.png")
await Deno.writeTextFile( "sprite.json", [...f])
// console.log(f)