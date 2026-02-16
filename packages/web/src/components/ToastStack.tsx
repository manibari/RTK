"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  color: string;
}

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div style={{ ...styles.toast, borderLeftColor: toast.color }}>
      <span style={styles.text}>{toast.text}</span>
      <button style={styles.dismiss} onClick={() => onDismiss(toast.id)}>✕</button>
    </div>
  );
}

let nextToastId = 1;
export function createToastId(): number {
  return nextToastId++;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: 20,
    right: 20,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    zIndex: 2000,
    maxWidth: 360,
  },
  toast: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderLeft: "4px solid #64748b",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    animation: "slideIn 0.2s ease-out",
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: "#e2e8f0",
    lineHeight: 1.4,
  },
  dismiss: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 14,
    cursor: "pointer",
    padding: 2,
    flexShrink: 0,
  },
};
