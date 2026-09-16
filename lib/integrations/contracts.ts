/** Provider-neutral boundaries. Adapters are server-side only and never expose tokens to the browser. */
export type CorrespondenceCandidate = {
  providerMessageId: string;
  threadId?: string;
  subject: string;
  sender: string;
  receivedAt: Date;
  bodyText?: string;
  attachmentIds: string[];
};

export type DocumentCandidate = {
  providerFileId: string;
  name: string;
  mimeType: string;
  webUrl?: string;
  modifiedAt?: Date;
};

export type GmailProvider = {
  listDealCandidates(since?: Date): Promise<CorrespondenceCandidate[]>;
  createDraft(input: { to: string[]; subject: string; body: string }): Promise<{ providerMessageId: string }>;
  sendApprovedDraft(providerMessageId: string): Promise<void>;
};

export type DriveProvider = {
  listDocuments(folderId?: string): Promise<DocumentCandidate[]>;
  downloadDocument(providerFileId: string): Promise<{ bytes: Uint8Array; mimeType: string }>;
};

export const integrationRequired = (name: "Gmail" | "Google Drive") =>
  `${name} integration is not connected. This action remains internal until server-side OAuth is configured.`;
