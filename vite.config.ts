import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function serverActionPlugin(): Plugin {
  return {
    name: "vite-plugin-use-server",
    enforce: "pre",
    transform(code, id, options) {
      if (options?.ssr) return null;
      if (!code.includes('"use server"') && !code.includes("'use server'")) {
        return null;
      }

      const exports: string[] = [];
      const constRegex = /export\s+const\s+([a-zA-Z0-9_$]+)\s*=/g;
      let match: RegExpExecArray | null;
      while ((match = constRegex.exec(code)) !== null) {
        exports.push(match[1]);
      }
      const funcRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/g;
      while ((match = funcRegex.exec(code)) !== null) {
        exports.push(match[1]);
      }

      // Convert path to clean key relative to src/
      const cleanPath = id.replace(/\\/g, "/");
      const srcIdx = cleanPath.lastIndexOf("/src/");
      const fileKey = srcIdx >= 0 ? cleanPath.slice(srcIdx + 5).replace(/\.[^.]+$/, "") : path.basename(id, path.extname(id));

      const lines = [
        `import { clientAction } from "@/client/api";`,
        ...exports.map((name) => `export const ${name} = clientAction("${fileKey}.${name}");`),
      ];

      return {
        code: lines.join("\n"),
        map: null,
      };
    },
  };
}

const rawBasePath = process.env.BASE_PATH?.trim();
const basePath = rawBasePath && rawBasePath !== "/"
  ? (rawBasePath.startsWith("/") ? (rawBasePath.endsWith("/") ? rawBasePath : `${rawBasePath}/`) : `/${rawBasePath}/`)
  : "/";

export default defineConfig({
  base: basePath,
  plugins: [serverActionPlugin(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "next/link": path.resolve(__dirname, "./src/components/link.tsx"),
      "next/navigation": path.resolve(__dirname, "./src/lib/navigation.tsx"),
      "next/cache": path.resolve(__dirname, "./src/lib/revalidate.ts"),
      "next/headers": path.resolve(__dirname, "./src/lib/headers.ts"),
      "next/server": path.resolve(__dirname, "./src/lib/server.ts"),
      "next": path.resolve(__dirname, "./src/lib/next.ts"),
      "server-only": path.resolve(__dirname, "./src/test/empty-module.ts"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/print": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
