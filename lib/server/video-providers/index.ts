import { runwayProvider } from "./runway";
import { VideoProvider, VideoProviderName } from "./types";

const providers: Record<VideoProviderName, VideoProvider | undefined> = { runway: runwayProvider, higgsfield: undefined };
export const getVideoProvider = (name: VideoProviderName = "runway") => {
  const provider = providers[name];
  if (!provider) throw new Error(`${name} is not configured as a video provider.`);
  return provider;
};
export type { ProviderTask, VideoInput, VideoProviderName } from "./types";
