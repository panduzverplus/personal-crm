import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "cn"

// From the shadcn registry (base-nova), restyled to match Input.

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div
      className={cn(
        "group/native-select relative w-full has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        className="h-11 w-full min-w-0 appearance-none rounded-field border border-transparent bg-input py-1 pr-11 pl-4 text-base transition-colors outline-none select-none focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive"
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-input text-foreground", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-input text-foreground", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
