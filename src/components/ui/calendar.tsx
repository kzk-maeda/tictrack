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
        caption: "flex justify-between pt-1 items-center mb-3",
        caption_label: "text-base font-semibold",
        nav: "hidden",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 bg-transparent p-0 hover:bg-muted/60 transition-all rounded-lg"
        ),
        nav_button_previous: "",
        nav_button_next: "",
        month_grid: "w-full border-collapse",
        weekdays: "",
        weekday:
          "text-muted-foreground font-medium text-xs sm:text-sm text-center pb-2 w-[14.28%]",
        week: "",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 sm:h-12 sm:w-12 p-0 font-normal aria-selected:opacity-100 rounded-lg hover:bg-secondary/40 transition-all"
        ),
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-soft",
        today: "bg-secondary/50 text-secondary-foreground font-semibold ring-2 ring-secondary",
        outside:
          "day-outside text-muted-foreground/40 opacity-40",
        disabled: "text-muted-foreground opacity-50 cursor-not-allowed",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
