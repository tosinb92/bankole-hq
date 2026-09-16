import { ProviderTask, VideoInput, VideoProvider } from "./types";

const baseUrl = "https://api.dev.runwayml.com/v1";
const headers = () => ({ Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" });
const statusFor = (status: string): ProviderTask["status"] => {
  if (["SUCCEEDED", "COMPLETED"].includes(status)) return "COMPLETED";
  if (["FAILED", "CANCELLED"].includes(status)) return "FAILED";
  if (["RUNNING", "PROCESSING"].includes(status)) return status === "PROCESSING" ? "PROCESSING" : "GENERATING";
  return "QUEUED";
};
type RunwayResponse = { id?: string; status?: string; output?: string[]; failure?: string; error?: { message?: string } };

async function runwayJson(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) }, cache: "no-store" });
  const payload = await response.json() as RunwayResponse;
  if (!response.ok) throw new Error(payload.error?.message ?? payload.failure ?? `Runway request failed (${response.status}).`);
  return payload;
}

export const runwayProvider: VideoProvider = {
  name: "runway",
  async submit(input: VideoInput) {
    if (!process.env.RUNWAYML_API_SECRET) throw new Error("RUNWAYML_API_SECRET is not configured on the server.");
    const payload = await runwayJson("/image_to_video", { method: "POST", body: JSON.stringify({ model: "gen4.5", promptText: input.prompt, ...(input.referenceImage ? { promptImage: input.referenceImage } : {}), ratio: input.aspectRatio === "landscape" ? "1280:720" : "720:1280", duration: input.durationSeconds }) });
    if (!payload.id) throw new Error("Runway did not return a task ID.");
    return { id: payload.id, provider: "runway", model: "gen4.5", status: statusFor(payload.status ?? "PENDING"), providerStatus: payload.status ?? "PENDING" };
  },
  async getTask(id: string) {
    if (!process.env.RUNWAYML_API_SECRET) throw new Error("RUNWAYML_API_SECRET is not configured on the server.");
    const payload = await runwayJson(`/tasks/${encodeURIComponent(id)}`);
    const providerStatus = payload.status ?? "PENDING";
    return { id, provider: "runway", model: "gen4.5", status: statusFor(providerStatus), providerStatus, ...(payload.failure ? { error: payload.failure } : {}) };
  },
  async getContent(id: string) {
    if (!process.env.RUNWAYML_API_SECRET) throw new Error("RUNWAYML_API_SECRET is not configured on the server.");
    const task = await runwayJson(`/tasks/${encodeURIComponent(id)}`);
    if (!task.output?.[0]) throw new Error("Runway video output is not available yet.");
    const response = await fetch(task.output[0], { cache: "no-store" });
    if (!response.ok || !response.body) throw new Error("Runway video output could not be retrieved before its temporary URL expired.");
    return response;
  },
};
