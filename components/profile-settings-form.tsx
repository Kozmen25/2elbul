"use client";

import { CheckCircle2, RotateCcw, Save, TriangleAlert } from "lucide-react";
import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile } from "@/app/account/actions";

type Props = {
  displayName?: string | null;
  location?: string | null;
  bio?: string | null;
};

const initialState = {
  ok: false,
  message: "",
};

export function ProfileSettingsForm({ displayName, location, bio }: Props) {
  const [state, formAction] = useActionState(updateProfile, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  function handleReset() {
    formRef.current?.reset();
  }

  return (
    <div>
      {state.ok ? (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800 sm:p-5"
        >
          <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
          <p className="font-bold">{state.message}</p>
        </div>
      ) : state.message ? (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 sm:p-5"
        >
          <TriangleAlert className="mt-0.5 shrink-0" size={22} />
          <p className="font-bold">{state.message}</p>
        </div>
      ) : null}

      <form ref={formRef} action={formAction} className="grid gap-5">
        <label>
          <span className="mb-2 block text-sm font-bold">Ad soyad</span>
          <input
            name="displayName"
            type="text"
            maxLength={80}
            defaultValue={displayName ? String(displayName) : ""}
            className="field h-13 px-4"
            placeholder="Görünen adınız"
          />
        </label>

        <label>
          <span className="mb-2 block text-sm font-bold">Konum</span>
          <input
            name="location"
            type="text"
            maxLength={120}
            defaultValue={location ? String(location) : ""}
            className="field h-13 px-4"
            placeholder="Örn. İstanbul"
          />
        </label>

        <label>
          <span className="mb-2 block text-sm font-bold">Kısa biyografi</span>
          <textarea
            name="bio"
            maxLength={300}
            rows={4}
            defaultValue={bio ? String(bio) : ""}
            className="field resize-y px-4 py-3"
            placeholder="Kendinizden kısaca bahsedin"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SubmitButton />
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center justify-center gap-2 rounded-xl border border-black/10 px-4 py-3 font-bold text-black/60 transition hover:bg-black/3 sm:w-auto"
          >
            <RotateCcw size={18} /> Sıfırla
          </button>
        </div>
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="orange-button w-full px-6 py-3 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
    >
      <Save size={18} />
      {pending ? "Kaydediliyor..." : "Kaydet"}
    </button>
  );
}
