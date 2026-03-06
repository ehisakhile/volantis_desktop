import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Initialize logging system
import { logger, initGlobalErrorHandlers } from "./lib/logger";

// Initialize global error handlers
initGlobalErrorHandlers();

// Log app startup
logger.app("🚀 Volantis Desktop App starting...");
logger.app(`📋 App version: ${import.meta.env.VITE_APP_VERSION || '0.1.0'}`);
logger.app(`🌍 Environment: ${import.meta.env.DEV ? 'development' : 'production'}`);

// Log when app mounts
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

logger.app("✅ Volantis Desktop App initialized");
