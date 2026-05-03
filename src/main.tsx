import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// تم حذف رسائل التنبيه (Alerts) بعد التأكد من نجاح تشغيل التطبيق
createRoot(document.getElementById("root")!).render(<App />);
