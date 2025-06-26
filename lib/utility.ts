// src/lib/utils.ts

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names and merges Tailwind CSS conflicts.
 * Usage: cn("px-2", someCondition && "bg-blue-500", ["font-bold", otherVar])
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
