"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileJson2,
  Upload,
} from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  importAdminListings,
  type AdminImportState,
} from "./actions";

const exampleJson = `[
  {
    "product_name": "iPhone 13",
    "title": "iPhone 13 128GB Temiz",
    "price": 21000,
    "city": "İstanbul",
    "source": "Sahibinden",
    "url": "https://example.com",
    "condition": "İkinci El"
  }
]`;

const initialState: AdminImportState = {
  status: "idle",
  message: "",
  imported: 0,
  existing: 0,
  failed: 0,
  errors: [],
};

export function AdminImportForm() {
  const [state, formAction] = useActionState(
    importAdminListings,
    initialState,
  );
  const hasResult = state.status !== "idle";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
      <form
        action={formAction}
        className="min-w-0 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] sm:p-8"
      >
        <label htmlFor="import-json" className="flex items-center gap-2 font-black">
          <FileJson2 size={20} className="text-[#ff6b00]" />
          İlan JSON verisi
        </label>
        <p className="mt-2 text-sm leading-6 text-black/45">
          JSON dizisini yapıştırın. Tek seferde en fazla 500 kayıt işlenir.
        </p>
        <textarea
          id="import-json"
          name="json"
          required
          defaultValue={exampleJson}
          spellCheck={false}
          className="field mt-5 min-h-96 resize-y p-4 font-mono text-sm leading-6"
        />
        <SubmitButton />
      </form>

      <aside className="min-w-0">
        {hasResult ? (
          <div
            className={`rounded-3xl border p-5 sm:p-6 ${
              state.status === "error" && state.imported === 0
                ? "border-red-200 bg-red-50"
                : "border-black/8 bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              {state.status === "success" ? (
                <CheckCircle2 className="shrink-0 text-green-600" size={23} />
              ) : (
                <AlertTriangle className="shrink-0 text-red-600" size={23} />
              )}
              <div>
                <h2 className="font-black">Aktarım sonucu</h2>
                <p className="mt-1 text-sm leading-6 text-black/55">
                  {state.message}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <ResultStat label="Eklendi" value={state.imported} />
              <ResultStat label="Zaten vardı" value={state.existing} />
              <ResultStat label="Hatalı" value={state.failed} />
            </div>

            {state.errors.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-black">Hatalı kayıtlar</h3>
                <div className="mt-3 grid gap-2">
                  {state.errors.map((error) => (
                    <div
                      key={`${error.index}-${error.title}`}
                      className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm"
                    >
                      <p className="font-bold">
                        #{error.index + 1} {error.title}
                      </p>
                      <p className="mt-1 break-words text-red-700">
                        {error.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-black/15 bg-white p-6 text-sm leading-6 text-black/50">
            Aktarım sonucu burada gösterilecek. Aynı URL daha önce kaydedildiyse
            ilan tekrar eklenmez.
          </div>
        )}
      </aside>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="orange-button mt-5 w-full py-4 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Upload size={18} />
      {pending ? "İlanlar işleniyor..." : "İlanları içe aktar"}
    </button>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-black/8 bg-white p-3 text-center">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[11px] font-bold leading-4 text-black/45">
        {label}
      </p>
    </div>
  );
}
