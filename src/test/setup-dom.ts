import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only cleans up automatically when Vitest globals are on.
afterEach(() => {
  cleanup();
});

// jsdom has no layout, so nothing ever resizes.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom's Blob lacks stream(), which undici/Node Response requires.
if (!Blob.prototype.stream) {
  Blob.prototype.stream = function () {
    return new ReadableStream({
      start: async (controller) => {
        controller.enqueue(new Uint8Array(await this.arrayBuffer()));
        controller.close();
      },
    });
  };
}
