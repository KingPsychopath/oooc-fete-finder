export type VignetteAdProps = {
  whatsappUrl: string;
  delayAfterChatClick?: number;
  delayAfterDismiss?: number;
  className?: string;
};

export type UseVignetteAdStorageOptions = {
  delayAfterChatClick?: number;
  delayAfterDismiss?: number;
  initialDelay?: number;
};

export type VignetteAdStorageReturn = {
  shouldShow: boolean;
  markChatClicked: () => void;
  markDismissed: () => void;
  clearStorage: () => void;
  checkShouldShow: () => boolean;
};

export type StorageKeys = {
  readonly CLICKED_CHAT: string;
  readonly DISMISSED: string;
};

export type DelayConfig = {
  readonly CHAT_CLICKED_DELAY: number;
  readonly DISMISSED_DELAY: number;
};

export type VignetteAdConfig = {
  readonly WHATSAPP_URL: string;
  readonly DELAYS: {
    readonly AFTER_CHAT_CLICK: number;
    readonly AFTER_DISMISS: number;
    readonly INITIAL_DELAY: number;
  };
  readonly UI: {
    readonly ANIMATION_DURATION: number;
    readonly Z_INDEX: number;
    readonly EDGE_OFFSET: string;
  };
  readonly CONTENT: {
    readonly TITLE: string;
    readonly DESCRIPTION: string;
    readonly CTA_TEXT: string;
  };
}; 