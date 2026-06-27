import { Router, type IRouter } from "express";
import {
  GetUserInfoHeader,
  GetUserInfoResponse,
  ControlDeviceParams,
  ControlDeviceHeader,
  ControlDeviceBody,
  ControlDeviceResponse,
  GetScenariosHeader,
  GetScenariosResponse,
  RunScenarioParams,
  RunScenarioHeader,
  RunScenarioResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const YANDEX_API_BASE = "https://api.iot.yandex.net";

/** Safely parse JSON — returns null if the body is not valid JSON */
async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

router.get("/yandex/user-info", async (req, res): Promise<void> => {
  const headers = GetUserInfoHeader.safeParse(req.headers);
  if (!headers.success) {
    req.log.warn({ errors: headers.error.message }, "Missing Yandex token");
    res.status(401).json({ error: "Missing or invalid x-yandex-token header" });
    return;
  }

  const token = headers.data["x-yandex-token"];

  try {
    const response = await fetch(`${YANDEX_API_BASE}/v1.0/user/info`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await safeJson(response);

    if (!response.ok) {
      req.log.warn({ status: response.status }, "Yandex API error on user-info");
      res.status(response.status).json({
        error: (data as any)?.message ?? `Yandex API error (${response.status})`,
      });
      return;
    }

    const parsed = GetUserInfoResponse.safeParse(data);
    if (!parsed.success) {
      req.log.error({ err: parsed.error }, "Zod parse error on user-info");
      res.status(502).json({ error: "Unexpected response shape from Yandex API" });
      return;
    }

    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Yandex user info");
    res.status(502).json({ error: "Failed to reach Yandex API" });
  }
});

router.post("/yandex/devices/:deviceId/actions", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.deviceId)
    ? req.params.deviceId[0]
    : req.params.deviceId;

  const params = ControlDeviceParams.safeParse({ deviceId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const headersResult = ControlDeviceHeader.safeParse(req.headers);
  if (!headersResult.success) {
    res.status(401).json({ error: "Missing or invalid x-yandex-token header" });
    return;
  }

  const body = ControlDeviceBody.safeParse(req.body);
  if (!body.success) {
    req.log.warn({ errors: body.error.message }, "Invalid device action body");
    res.status(400).json({ error: body.error.message });
    return;
  }

  const token = headersResult.data["x-yandex-token"];

  try {
    const response = await fetch(
      `${YANDEX_API_BASE}/v1.0/devices/${params.data.deviceId}/actions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body.data),
      }
    );

    const data = await safeJson(response);

    if (!response.ok) {
      req.log.warn({ status: response.status }, "Yandex API error on device action");
      res.status(response.status).json({
        error: (data as any)?.message ?? `Yandex API error (${response.status})`,
      });
      return;
    }

    const parsed = ControlDeviceResponse.safeParse(data);
    if (!parsed.success) {
      req.log.error({ err: parsed.error }, "Zod parse error on device action");
      res.status(502).json({ error: "Unexpected response shape from Yandex API" });
      return;
    }

    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Failed to send device action");
    res.status(502).json({ error: "Failed to reach Yandex API" });
  }
});

router.get("/yandex/scenarios", async (req, res): Promise<void> => {
  const headersResult = GetScenariosHeader.safeParse(req.headers);
  if (!headersResult.success) {
    res.status(401).json({ error: "Missing or invalid x-yandex-token header" });
    return;
  }

  const token = headersResult.data["x-yandex-token"];

  try {
    const response = await fetch(`${YANDEX_API_BASE}/v1.0/scenarios`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await safeJson(response);

    if (!response.ok) {
      req.log.warn({ status: response.status }, "Yandex API error on scenarios");
      res.status(response.status).json({
        error: (data as any)?.message ?? `Yandex API error (${response.status})`,
      });
      return;
    }

    const parsed = GetScenariosResponse.safeParse(data);
    if (!parsed.success) {
      req.log.error({ err: parsed.error }, "Zod parse error on scenarios");
      // Return empty scenarios list rather than 502 — scenarios are non-critical
      res.json({ status: "ok", scenarios: [] });
      return;
    }

    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Yandex scenarios");
    res.status(502).json({ error: "Failed to reach Yandex API" });
  }
});

router.post("/yandex/scenarios/:scenarioId/actions", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.scenarioId)
    ? req.params.scenarioId[0]
    : req.params.scenarioId;

  const params = RunScenarioParams.safeParse({ scenarioId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const headersResult = RunScenarioHeader.safeParse(req.headers);
  if (!headersResult.success) {
    res.status(401).json({ error: "Missing or invalid x-yandex-token header" });
    return;
  }

  const token = headersResult.data["x-yandex-token"];

  try {
    const response = await fetch(
      `${YANDEX_API_BASE}/v1.0/scenarios/${params.data.scenarioId}/actions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await safeJson(response);

    if (!response.ok) {
      req.log.warn({ status: response.status }, "Yandex API error on scenario run");
      res.status(response.status).json({
        error: (data as any)?.message ?? `Yandex API error (${response.status})`,
      });
      return;
    }

    const parsed = RunScenarioResponse.safeParse(data);
    if (!parsed.success) {
      req.log.error({ err: parsed.error }, "Zod parse error on scenario run");
      res.status(502).json({ error: "Unexpected response shape from Yandex API" });
      return;
    }

    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Failed to run Yandex scenario");
    res.status(502).json({ error: "Failed to reach Yandex API" });
  }
});

export default router;
