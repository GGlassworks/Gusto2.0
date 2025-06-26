import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((msg, type = "info", timeout = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(toast => toast.id !== id)), timeout);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(({ id, msg, type }) => (
          <div
            key={id}
            className={`
              px-4 py-2 rounded-lg shadow-lg font-medium animate-fade-in pointer-events-auto
              ${type === "error"
                ? "bg-red-500 text-white"
                : type === "success"
                ? "bg-green-600 text-white"
                : "bg-gray-900 text-white"}
            `}
          >
            {msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
