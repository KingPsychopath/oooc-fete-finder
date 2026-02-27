"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

const TooltipMobileContext = React.createContext<{
  isTouchDevice: boolean
  isOpen: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
} | null>(null)

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ open, onOpenChange, defaultOpen, ...props }: TooltipPrimitive.Root.Props) {
  const [isTouchDevice, setIsTouchDevice] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(defaultOpen ?? false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)")
    const updateTouchMode = () => setIsTouchDevice(mediaQuery.matches)

    updateTouchMode()
    mediaQuery.addEventListener("change", updateTouchMode)

    return () => {
      mediaQuery.removeEventListener("change", updateTouchMode)
    }
  }, [])

  const isControlled = open !== undefined
  const activeOpen = isControlled ? open : mobileOpen

  return (
    <TooltipMobileContext.Provider
      value={{ isTouchDevice, isOpen: activeOpen, setOpen: setMobileOpen }}
    >
      <TooltipPrimitive.Root
        data-slot="tooltip"
        {...props}
        defaultOpen={defaultOpen}
        open={isTouchDevice ? activeOpen : open}
        onOpenChange={(nextOpen, eventDetails) => {
          if (isTouchDevice && !isControlled) {
            setMobileOpen(nextOpen)
          }
          onOpenChange?.(nextOpen, eventDetails)
        }}
      />
    </TooltipMobileContext.Provider>
  )
}

function TooltipTrigger({ onClick, ...props }: TooltipPrimitive.Trigger.Props) {
  const mobileContext = React.useContext(TooltipMobileContext)

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      {...props}
      onClick={(event) => {
        if (mobileContext?.isTouchDevice) {
          mobileContext.setOpen((current) => !current)
        }
        onClick?.(event)
      }}
    />
  )
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-[95]"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 rounded-md px-3 py-1.5 text-xs data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 bg-foreground text-background z-[95] w-fit max-w-xs origin-(--transform-origin)",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 bg-foreground fill-foreground z-[95] data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
