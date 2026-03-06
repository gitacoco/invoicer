import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { CompanySettings } from "../types";
import {
  DEFAULT_MINIMAX_MODEL,
  MINIMAX_MODEL_OPTIONS,
} from "../hooks/useAiRewrite";
import { resolveAssetUrl } from "../utils/assets";

interface SavePayload {
  settings: CompanySettings;
  togglApiToken: string;
  minimaxApiKey: string;
  minimaxModel: string;
}

interface Props {
  open: boolean;
  loading: boolean;
  saving: boolean;
  initialSettings: CompanySettings;
  initialTogglToken: string;
  initialMinimaxApiKey: string;
  initialMinimaxModel: string;
  onClose: () => void;
  onSave: (payload: SavePayload) => Promise<void>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[#5f6c65]">{label}</span>
      <input
        type="text"
        className="h-10 rounded-lg border border-[#d7e0d5] bg-white px-3 text-[13px] text-[#1f2f28] outline-none focus:border-[#31566f]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[#5f6c65]">{label}</span>
      <textarea
        className="rounded-lg border border-[#d7e0d5] bg-white px-3 py-2 text-[13px] text-[#1f2f28] outline-none focus:border-[#31566f] resize-y min-h-[80px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </label>
  );
}

function EyeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4" />
      <path d="M9.9 5.1A10.7 10.7 0 0 1 12 5c7 0 11 7 11 7a21.8 21.8 0 0 1-5.2 5.9" />
      <path d="M6.2 6.2A21.6 21.6 0 0 0 1 12s4 7 11 7a10.9 10.9 0 0 0 2.1-.2" />
    </svg>
  );
}

const SECTIONS = [
  { id: "company-info", label: "My company information" },
  { id: "payment-instructions", label: "Payment instructions" },
  { id: "api-settings", label: "API settings" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export default function CompanySettingsModal({
  open,
  loading,
  saving,
  initialSettings,
  initialTogglToken,
  initialMinimaxApiKey,
  initialMinimaxModel,
  onClose,
  onSave,
}: Props) {
  const [settingsDraft, setSettingsDraft] = useState<CompanySettings>(initialSettings);
  const [togglTokenDraft, setTogglTokenDraft] = useState(initialTogglToken);
  const [minimaxDraft, setMinimaxDraft] = useState(initialMinimaxApiKey);
  const [minimaxModelDraft, setMinimaxModelDraft] = useState(
    initialMinimaxModel || DEFAULT_MINIMAX_MODEL
  );
  const [showTogglApiKey, setShowTogglApiKey] = useState(false);
  const [showMinimaxApiKey, setShowMinimaxApiKey] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("company-info");
  const [error, setError] = useState<string | null>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const logoFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSettingsDraft(initialSettings);
    setTogglTokenDraft(initialTogglToken);
    setMinimaxDraft(initialMinimaxApiKey);
    setMinimaxModelDraft(initialMinimaxModel || DEFAULT_MINIMAX_MODEL);
    setShowTogglApiKey(false);
    setShowMinimaxApiKey(false);
    setActiveSection("company-info");
    setError(null);
  }, [
    open,
    initialSettings,
    initialTogglToken,
    initialMinimaxApiKey,
    initialMinimaxModel,
  ]);

  if (!open) return null;

  const setField = <K extends keyof CompanySettings>(
    key: K,
    value: CompanySettings[K]
  ) => {
    setSettingsDraft((prev) => ({ ...prev, [key]: value }));
  };

  const scrollToSection = (id: SectionId) => {
    const node = sectionRefs.current[id];
    if (!node) return;
    setActiveSection(id);
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setField("companyLogoDataUrl", reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const companyLogoPreviewUrl = resolveAssetUrl(settingsDraft.companyLogoDataUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[rgba(12,18,16,0.45)]" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-[#d6ddd5] bg-[#f8faf6] p-5 shadow-[0_20px_48px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-[#1f2f28]">Settings</h2>
          <button
            type="button"
            className="h-8 px-3 rounded-lg text-[12px] text-[#4d5b54] hover:bg-[#edf2ed] transition-colors"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="pt-4 text-[12px] text-[#6f7a73]">Loading settings...</div>
        ) : (
          <form
            className="pt-4 grid grid-cols-[220px_minmax(0,1fr)] gap-5 min-h-0"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              void onSave({
                settings: settingsDraft,
                togglApiToken: togglTokenDraft.trim(),
                minimaxApiKey: minimaxDraft.trim(),
                minimaxModel: minimaxModelDraft.trim() || DEFAULT_MINIMAX_MODEL,
              }).catch((err: unknown) => {
                const message =
                  err instanceof Error ? err.message : "Failed to save settings.";
                setError(message);
              });
            }}
          >
            <aside className="border-r border-[#dce4da] pr-3">
              <div className="sticky top-0 flex flex-col gap-1">
                {SECTIONS.map((section) => {
                  const active = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      className={`text-left rounded-lg px-2.5 py-2 text-[12px] transition-colors ${
                        active
                          ? "bg-[#e6ece8] text-[#1f2f28] font-medium"
                          : "text-[#5f6c65] hover:bg-[#eef3ef]"
                      }`}
                      onClick={() => scrollToSection(section.id)}
                    >
                      {section.label}
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="max-h-[68vh] overflow-y-auto pr-1 flex flex-col gap-6">
              <section
                ref={(node) => {
                  sectionRefs.current["company-info"] = node;
                }}
                className="flex flex-col gap-3 scroll-mt-4"
              >
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#5f6c65]">
                  My company information
                </h3>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-[#5f6c65]">Company Logo</span>
                  <div className="flex items-center gap-3">
                    {companyLogoPreviewUrl ? (
                      <img
                        src={companyLogoPreviewUrl}
                        alt="Company logo preview"
                        className="h-10 w-10 rounded-md object-cover border border-[#d7e0d5] bg-white"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md border border-[#d7e0d5] bg-[#eef3ef] text-[10px] text-[#7c8982] inline-flex items-center justify-center">
                        Logo
                      </div>
                    )}
                    <button
                      type="button"
                      className="h-8 px-3 rounded-lg border border-[#d7e0d5] text-[12px] text-[#2f5168] hover:bg-[#eef3ef] transition-colors"
                      onClick={() => logoFileRef.current?.click()}
                    >
                      {settingsDraft.companyLogoDataUrl ? "Change" : "Upload"}
                    </button>
                    {settingsDraft.companyLogoDataUrl && (
                      <button
                        type="button"
                        className="h-8 px-3 rounded-lg text-[12px] text-[#5f6c65] hover:bg-[#eef3ef] transition-colors"
                        onClick={() => setField("companyLogoDataUrl", undefined)}
                      >
                        Remove
                      </button>
                    )}
                    <input
                      ref={logoFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoFileChange}
                    />
                  </div>
                </div>
                <Field
                  label="My Company Name"
                  value={settingsDraft.companyName}
                  onChange={(v) => setField("companyName", v)}
                />
                <TextArea
                  label="Company Address"
                  value={settingsDraft.companyAddress}
                  onChange={(v) => setField("companyAddress", v)}
                  rows={3}
                />
                <Field
                  label="Contact email"
                  value={settingsDraft.contactEmail}
                  onChange={(v) => setField("contactEmail", v)}
                />
                <Field
                  label="EIN"
                  value={settingsDraft.ein}
                  onChange={(v) => setField("ein", v)}
                />
              </section>

              <section
                ref={(node) => {
                  sectionRefs.current["payment-instructions"] = node;
                }}
                className="flex flex-col gap-3 scroll-mt-4"
              >
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#5f6c65]">
                  Payment instructions
                </h3>
                <TextArea
                  label="Guidance language"
                  value={settingsDraft.guidanceLanguage}
                  onChange={(v) => setField("guidanceLanguage", v)}
                  rows={3}
                />
                <Field
                  label="Routing Number"
                  value={settingsDraft.routingNumber}
                  onChange={(v) => setField("routingNumber", v)}
                />
                <Field
                  label="Account Number"
                  value={settingsDraft.accountNumber}
                  onChange={(v) => setField("accountNumber", v)}
                />
                <Field
                  label="Receiving Bank"
                  value={settingsDraft.receivingBank}
                  onChange={(v) => setField("receivingBank", v)}
                />
                <TextArea
                  label="Bank Address"
                  value={settingsDraft.bankAddress}
                  onChange={(v) => setField("bankAddress", v)}
                  rows={3}
                />
              </section>

              <section
                ref={(node) => {
                  sectionRefs.current["api-settings"] = node;
                }}
                className="flex flex-col gap-3 scroll-mt-4"
              >
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#5f6c65]">
                  API settings
                </h3>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[#5f6c65]">Toggl API</span>
                  <div className="flex items-center gap-2">
                    <input
                      type={showTogglApiKey ? "text" : "password"}
                      className="flex-1 h-10 rounded-lg border border-[#d7e0d5] bg-white px-3 text-[13px] text-[#1f2f28] outline-none focus:border-[#31566f]"
                      value={togglTokenDraft}
                      onChange={(e) => setTogglTokenDraft(e.target.value)}
                      placeholder="Paste your Toggl API token"
                    />
                    <button
                      type="button"
                      className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-[#d7e0d5] text-[#64736b] hover:bg-[#eef3ef] transition-colors"
                      onClick={() => setShowTogglApiKey((prev) => !prev)}
                      aria-label={showTogglApiKey ? "Hide Toggl API key" : "Show Toggl API key"}
                      title={showTogglApiKey ? "Hide API key" : "Show API key"}
                    >
                      {showTogglApiKey ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[#5f6c65]">MiniMax API</span>
                  <div className="flex items-center gap-2">
                    <input
                      type={showMinimaxApiKey ? "text" : "password"}
                      className="flex-1 h-10 rounded-lg border border-[#d7e0d5] bg-white px-3 text-[13px] text-[#1f2f28] outline-none focus:border-[#31566f]"
                      value={minimaxDraft}
                      onChange={(e) => setMinimaxDraft(e.target.value)}
                      placeholder="Paste your MiniMax API key"
                    />
                    <button
                      type="button"
                      className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-[#d7e0d5] text-[#64736b] hover:bg-[#eef3ef] transition-colors"
                      onClick={() => setShowMinimaxApiKey((prev) => !prev)}
                      aria-label={showMinimaxApiKey ? "Hide MiniMax API key" : "Show MiniMax API key"}
                      title={showMinimaxApiKey ? "Hide API key" : "Show API key"}
                    >
                      {showMinimaxApiKey ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[#5f6c65]">MiniMax Model</span>
                  <select
                    className="h-10 rounded-lg border border-[#d7e0d5] bg-white px-3 text-[13px] text-[#1f2f28] outline-none focus:border-[#31566f]"
                    value={minimaxModelDraft}
                    onChange={(e) => setMinimaxModelDraft(e.target.value)}
                  >
                    {MINIMAX_MODEL_OPTIONS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              {error && (
                <div className="rounded-lg border border-[#ebc9c5] bg-[#f8ecea] px-3 py-2 text-[12px] text-[#8a2d2d]">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="h-9 px-4 rounded-lg border border-[#d3ddd3] text-[12px] text-[#415049] hover:bg-[#eef3ef] transition-colors"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-[#31566f] text-white text-[12px] font-medium hover:bg-[#26495f] transition-colors disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save settings"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
