import { handleError, readJsonBody, sendJson, sendMethodNotAllowed } from "../_lib/http.js";
import {
  readCompanySettings,
  writeCompanySettings,
} from "../_lib/invoicer-data.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const settings = await readCompanySettings();
      sendJson(res, 200, { ok: true, settings });
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const settings = await writeCompanySettings(body.settings);
      sendJson(res, 200, { ok: true, settings });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    handleError(res, error);
  }
}
