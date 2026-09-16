export type VideoProviderName = "runway" | "higgsfield";
export type VideoInput = { prompt: string; aspectRatio: "portrait" | "landscape"; durationSeconds: number; referenceImage?: string };
export type ProviderTask = { id: string; provider: VideoProviderName; model: string; status: "QUEUED" | "GENERATING" | "PROCESSING" | "COMPLETED" | "FAILED"; providerStatus: string; error?: string };
export type VideoProvider = { name: VideoProviderName; submit(input: VideoInput): Promise<ProviderTask>; getTask(id: string): Promise<ProviderTask>; getContent(id: string): Promise<Response>; };
