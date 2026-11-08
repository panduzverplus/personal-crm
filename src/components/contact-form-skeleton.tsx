/** Placeholder for the contact form card while it waits for the groups. */
export function ContactFormSkeleton() {
  return (
    <div className="flex flex-col gap-5 rounded-card border p-5 md:p-7" aria-busy="true">
      <span className="h-8 w-56 animate-pulse rounded-full bg-skeleton/60" />
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <span className="h-3 w-28 animate-pulse rounded-full bg-skeleton/60" />
          <span className="h-11 w-full animate-pulse rounded-field bg-input" />
        </div>
      ))}
    </div>
  );
}
