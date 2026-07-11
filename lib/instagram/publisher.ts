import { buildInstagramGraphApiBaseUrl } from "./helpers";
import type { InstagramPublishConfig } from "./types";

export type InstagramPublishInput = {
  videoUrl: string;
  caption: string;
  shareToFeed?: boolean;
};

export async function publishInstagramReel(
  config: InstagramPublishConfig,
  input: InstagramPublishInput,
) {
  const baseUrl = buildInstagramGraphApiBaseUrl(config.graphApiVersion);
  const createPayload = new URLSearchParams({
    access_token: config.accessToken,
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: input.caption,
    share_to_feed: input.shareToFeed === false ? "false" : "true",
  });

  const creationResponse = await fetch(
    `${baseUrl}/${config.igUserId}/media`,
    {
      method: "POST",
      body: createPayload,
    },
  );
  const creationData = await readGraphResponse(creationResponse);

  if (!creationResponse.ok || typeof creationData.id !== "string") {
    throw new Error(
      extractGraphError(
        creationData,
        "Instagram reel container olusturulamadi.",
      ),
    );
  }

  const publishPayload = new URLSearchParams({
    access_token: config.accessToken,
    creation_id: creationData.id,
  });
  const publishResponse = await fetch(
    `${baseUrl}/${config.igUserId}/media_publish`,
    {
      method: "POST",
      body: publishPayload,
    },
  );
  const publishData = await readGraphResponse(publishResponse);

  if (!publishResponse.ok || typeof publishData.id !== "string") {
    throw new Error(
      extractGraphError(
        publishData,
        "Instagram reel yayinlanamadi.",
      ),
    );
  }

  return {
    creationId: creationData.id,
    mediaId: publishData.id,
    videoUrl: input.videoUrl,
  };
}

async function readGraphResponse(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function extractGraphError(
  value: Record<string, unknown>,
  fallbackMessage: string,
) {
  const error = value.error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  if (typeof value.message === "string") return value.message;
  return fallbackMessage;
}
