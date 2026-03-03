import { useCallback, useEffect, useState } from "react";
import type { CompanySettings } from "../types";

interface CompanySettingsResponse {
  ok: boolean;
  settings?: CompanySettings;
  error?: string;
}

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: "Example Studio LLC",
  companyLogoDataUrl: undefined,
  companyAddress: "123 Example Street\nSan Francisco, CA 94105",
  contactEmail: "billing@example.com",
  ein: "00-0000000",
  guidanceLanguage:
    "Use these details to send ACH transfers to Example Studio LLC's checking account.",
  routingNumber: "000000000",
  accountNumber: "000000000000",
  receivingBank: "Example Bank",
  bankAddress: "100 Bank Street\nSan Francisco, CA 94105",
};

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function useCompanySettings() {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/__invoicer/company-settings");
      const payload = await parseJsonSafe<CompanySettingsResponse>(res);
      if (!res.ok || !payload?.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to load company settings.");
      }
      setSettings(payload.settings);
    } catch (error) {
      console.error("[company-settings] failed to load:", error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (next: CompanySettings): Promise<CompanySettings> => {
    setSaving(true);
    try {
      const res = await fetch("/__invoicer/company-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: next }),
      });
      const payload = await parseJsonSafe<CompanySettingsResponse>(res);
      if (!res.ok || !payload?.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to save company settings.");
      }
      setSettings(payload.settings);
      return payload.settings;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    settings,
    loading,
    saving,
    refresh,
    save,
  };
}
