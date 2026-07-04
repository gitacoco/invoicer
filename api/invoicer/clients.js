import { handleError, readJsonBody, sendJson, sendMethodNotAllowed } from "../_lib/http.js";
import { readClients, writeClients } from "../_lib/invoicer-data.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const clients = await readClients();
      sendJson(res, 200, { ok: true, clients });
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const clients = await writeClients(Array.isArray(body.clients) ? body.clients : []);
      sendJson(res, 200, { ok: true, clients, count: clients.length });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    handleError(res, error);
  }
}
