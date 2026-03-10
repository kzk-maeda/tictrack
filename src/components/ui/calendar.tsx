"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3 w-full",
        caption: "flex justify-center pt-1 relative items-center mb-3",
        caption_label: "text-base font-semibold",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 bg-transparent p-0 hover:bg-muted/60 transition-all rounded-lg"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse table-fixed",
        head_row: "",
        head_cell:
          "text-muted-foreground font-medium text-xs sm:text-sm text-center w-10 sm:w-12 pb-2",
        row: "",
        cell: "text-center p-0 relative",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 sm:h-12 sm:w-12 p-0 font-normal aria-selected:opacity-100 rounded-lg hover:bg-secondary/40 transition-all mx-auto"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-soft",
        day_today: "bg-secondary/50 text-secondary-foreground font-semibold ring-2 ring-secondary",
        day_outside:
          "day-outside text-muted-foreground/40 opacity-40",
        day_disabled: "text-muted-foreground/20 opacity-20 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
