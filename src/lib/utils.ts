import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  const unit = size < 1024 ** 2 ? "KB" : size < 1024 ** 3 ? "MB" : "GB";
  const divisor = unit === "KB" ? 1024 : unit === "MB" ? 1024 ** 2 : 1024 ** 3;
  return `${(size / divisor).toFixed(1)} ${unit}`;
}
