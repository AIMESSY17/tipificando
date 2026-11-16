"use client";
import { useEffect } from "react";

export default function ClearCart() {
  useEffect(() => {
    try {
      localStorage.removeItem("tipificado-carrito");
    } catch {}
  }, []);
  return null;
}
