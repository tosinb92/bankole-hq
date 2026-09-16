import type { CorrespondenceCandidate, DocumentCandidate, DriveProvider, GmailProvider } from "@/lib/integrations/contracts";

type GoogleToken = { access_token: string; expires_in: number };
let cachedToken: { value: string; expiresAt: number } | undefined;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured. Add it as a server-only environment variable.`);
  return value;
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const body = new URLSearchParams({
    client_id: required("GOOGLE_CLIENT_ID"), client_secret: required("GOOGLE_CLIENT_SECRET"),
    refresh_token: required("GOOGLE_REFRESH_TOKEN"), grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
  if (!response.ok) throw new Error(`Google OAuth refresh failed (${response.status}).`);
  const token = await response.json() as GoogleToken;
  cachedToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
  return token.access_token;
}

async function googleFetch(path: string, init?: RequestInit) {
  const token = await accessToken();
  const response = await fetch(`https://www.googleapis.com${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`Google Workspace request failed (${response.status}).`);
  return response;
}

const decodeBase64Url = (value = "") => Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

export const googleGmail: GmailProvider = {
  async listDealCandidates(since) {
    const query = since ? `after:${Math.floor(since.getTime() / 1000)}` : "";
    const list = await googleFetch(`/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(query)}`);
    const data = await list.json() as { messages?: { id: string; threadId: string }[] };
    return Promise.all((data.messages ?? []).map(async ({ id, threadId }) => {
      const response = await googleFetch(`/gmail/v1/users/me/messages/${id}?format=full`);
      const message = await response.json() as { payload?: { headers?: { name: string; value: string }[]; body?: { data?: string }; parts?: { filename?: string; body?: { attachmentId?: string } }[] }; internalDate?: string };
      const headers = message.payload?.headers ?? [];
      const header = (name: string) => headers.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? "";
      return { providerMessageId: id, threadId, subject: header("Subject"), sender: header("From"), receivedAt: new Date(Number(message.internalDate)), bodyText: decodeBase64Url(message.payload?.body?.data), attachmentIds: (message.payload?.parts ?? []).map((part) => part.body?.attachmentId).filter((id): id is string => Boolean(id)) };
    }));
  },
  async createDraft(input) {
    const raw = Buffer.from([`To: ${input.to.join(", ")}`, `Subject: ${input.subject}`, "Content-Type: text/plain; charset=UTF-8", "", input.body].join("\r\n")).toString("base64url");
    const response = await googleFetch("/gmail/v1/users/me/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: { raw } }) });
    const draft = await response.json() as { id: string };
    return { providerMessageId: draft.id };
  },
  async sendApprovedDraft(providerMessageId) {
    await googleFetch(`/gmail/v1/users/me/drafts/${providerMessageId}/send`, { method: "POST" });
  },
};

export const googleDrive: DriveProvider = {
  async listDocuments(folderId = process.env.BA_DRIVE_FOLDER_ID) {
    const query = folderId ? `'${folderId}' in parents and trashed = false` : "trashed = false";
    const response = await googleFetch(`/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,modifiedTime)&pageSize=100`);
    const data = await response.json() as { files?: { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string }[] };
    return (data.files ?? []).map((file): DocumentCandidate => ({ providerFileId: file.id, name: file.name, mimeType: file.mimeType, webUrl: file.webViewLink, modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined }));
  },
  async downloadDocument(providerFileId) {
    const response = await googleFetch(`/drive/v3/files/${providerFileId}?alt=media`);
    return { bytes: new Uint8Array(await response.arrayBuffer()), mimeType: response.headers.get("content-type") ?? "application/octet-stream" };
  },
};
