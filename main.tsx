import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // tu peux supprimer si tu n'utilises pas de global CSS

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

