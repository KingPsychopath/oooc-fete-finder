import type { StorageKeys, DelayConfig } from "./types";

// Storage keys for localStorage
export const STORAGE_KEYS: StorageKeys = {
  CLICKED_CHAT: "whatsapp_chat_clicked",
  DISMISSED: "whatsapp_ad_dismissed",
} as const;

// Default delay configurations (in milliseconds)
export const DELAY_CONFIG: DelayConfig = {
  CHAT_CLICKED_DELAY: 4 * 24 * 60 * 60 * 1000, // 4 days
  DISMISSED_DELAY: 2 * 24 * 60 * 60 * 1000, // 2 days
} as const; 