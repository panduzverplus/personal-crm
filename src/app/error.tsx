"use client";

import { useEffect } from "react";
import { BigLetter } from "@/components/big-letter";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-5 rounded-card border px-6 py-12 text-center">
      <BigLetter />
      <h1 className="text-h2 font-light">Что-то пошло не так</h1>
      <p className="text-muted-foreground">
        Не получилось загрузить данные. Проверьте, что база данных запущена, и
        попробуйте ещё раз.
      </p>
      <Button variant="outline" onClick={() => retry()}>
        Попробовать ещё раз
      </Button>
    </div>
  );
}
