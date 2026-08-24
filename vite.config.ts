import { createReadStream, statSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

const STATIC_PASSTHROUGH = [
  "/ort-wasm-simd-threaded.mjs",
  "/ort-wasm-simd-threaded.wasm",
  "/ort-wasm-simd-threaded.jsep.mjs",
  "/ort-wasm-simd-threaded.jsep.wasm",
  "/silero_vad_v5.onnx",
  "/silero_vad_legacy.onnx",
  "/vad.worklet.bundle.min.js",
];

const MIME: Record<string, string> = {
  ".mjs": "application/javascript",
  ".js": "application/javascript",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
};

// Vite refuses to "import" files from /public via the module pipeline. The
// VAD library and ONNX runtime ask for these files via dynamic import, so we
// short-circuit those requests with raw file responses.
const passthrough = {
  name: "vad-onnx-public-passthrough",
  configureServer(server: {
    middlewares: {
      use: (
        path: string,
        handler: (req: unknown, res: unknown) => void,
      ) => void;
    };
  }) {
    for (const url of STATIC_PASSTHROUGH) {
      server.middlewares.use(url, (_req: unknown, res: unknown) => {
        const r = res as {
          setHeader: (k: string, v: string) => void;
          statusCode: number;
          end: () => void;
        };
        const filePath = resolve(process.cwd(), "public", url.slice(1));
        try {
          const size = statSync(filePath).size;
          const ext = `.${filePath.split(".").pop()}`;
          r.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
          r.setHeader("Content-Length", String(size));
          createReadStream(filePath).pipe(res as never);
        } catch {
          r.statusCode = 404;
          r.end();
        }
      });
    }
  },
};

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), passthrough],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
