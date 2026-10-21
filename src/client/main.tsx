import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { Toaster } from "@/components/toast";
import { COLOR_SCHEME_COOKIE, parseColorScheme } from "@/lib/ui-preferences";
import { AuthProvider } from "./context/auth";
import { router } from "./router";

import "@/fonts/fonts.css";
import "@/app/globals.css";

// Initialize theme from cookie if present
const themeCookie = document.cookie
  .split("; ")
  .find((row) => row.startsWith(COLOR_SCHEME_COOKIE + "="))
  ?.split("=")[1];
const scheme = parseColorScheme(themeCookie);
if (scheme) {
  document.documentElement.setAttribute("data-theme", scheme);
}

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </React.StrictMode>,
  );
}
