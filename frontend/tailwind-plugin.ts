import tailwindcss from "@tailwindcss/postcss";
import type { BunPlugin } from "bun";
import postcss from "postcss";

const tailwindPlugin: BunPlugin = {
  name: "tailwindcss",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async args => {
      const css = await Bun.file(args.path).text();
      const result = await postcss([tailwindcss]).process(css, {
        from: args.path,
      });
      return {
        contents: result.css,
        loader: "css",
      };
    });
  },
};

export default tailwindPlugin;
