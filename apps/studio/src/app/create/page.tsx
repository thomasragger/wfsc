import { Suspense } from "react";

import { CreateWizard } from "@/components/create-wizard";

export const metadata = {
  title: "Start your book — Warm Fuzzy Story Club",
};

export default function CreatePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense
        fallback={
          <div className="card flex items-center justify-center p-16 text-ink-soft">
            Warming up the story studio…
          </div>
        }
      >
        <CreateWizard />
      </Suspense>
    </div>
  );
}
