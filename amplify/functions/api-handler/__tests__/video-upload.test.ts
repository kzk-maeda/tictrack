// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createDynamoDBMock } from "./helpers/dynamodb-mock.js";
import { createMockEvent } from "./helpers/event-factory.js";

const { send } = createDynamoDBMock();

// Mock S3 and presigner
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {},
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://presigned-url.example.com"),
}));

const { handler } = await import("../handler.js");

describe("Video Upload API", () => {
  const mockUserId = "user-123";
  const mockChildId = "child-456";
  const mockEpisodeId = "episode-789";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /children/{childId}/episodes/{episodeId}/upload-url", () => {
    it("should generate presigned URL for video upload", async () => {
      send.mockResolvedValueOnce({ Item: { episodeId: mockEpisodeId } }); // GetItem

      const event = createMockEvent({
        method: "POST",
        path: `/children/${mockChildId}/episodes/${mockEpisodeId}/upload-url`,
        pathParameters: {
          childId: mockChildId,
          episodeId: mockEpisodeId,
        },
        body: {
          contentType: "video/mp4",
          fileSize: 5000000, // 5MB
        },
        userId: mockUserId,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("url");
      expect(body).toHaveProperty("s3Key");
      expect(body.url).toMatch(/^https:\/\//);
      expect(body.s3Key).toMatch(
        new RegExp(`^videos/${mockUserId}/${mockChildId}/${mockEpisodeId}/`),
      );
    });

    it("should reject unsupported content types", async () => {
      // No DB mock needed - validation happens before DB call

      const event = createMockEvent({
        method: "POST",
        path: `/children/${mockChildId}/episodes/${mockEpisodeId}/upload-url`,
        pathParameters: {
          childId: mockChildId,
          episodeId: mockEpisodeId,
        },
        body: {
          contentType: "video/avi",
          fileSize: 5000000,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.detail).toContain("Content type");
    });

    it("should reject files larger than 50MB", async () => {
      // No DB mock needed - validation happens before DB call

      const event = createMockEvent({
        method: "POST",
        path: `/children/${mockChildId}/episodes/${mockEpisodeId}/upload-url`,
        pathParameters: {
          childId: mockChildId,
          episodeId: mockEpisodeId,
        },
        body: {
          contentType: "video/mp4",
          fileSize: 51 * 1024 * 1024, // 51MB
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.detail).toContain("File size");
    });

    it("should set presigned URL expiration to 5 minutes", async () => {
      send.mockResolvedValueOnce({ Item: { episodeId: mockEpisodeId } });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${mockChildId}/episodes/${mockEpisodeId}/upload-url`,
        pathParameters: {
          childId: mockChildId,
          episodeId: mockEpisodeId,
        },
        body: {
          contentType: "video/mp4",
          fileSize: 5000000,
        },
      });

      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const mockGetSignedUrl = vi.mocked(getSignedUrl);

      await handler(event);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 300 }, // 5 minutes
      );
    });
  });

  describe("POST /children/{childId}/episodes/{episodeId}/upload-complete", () => {
    it("should update episode with video metadata", async () => {
      send.mockResolvedValueOnce({ Item: { episodeId: mockEpisodeId } }); // GetItem
      send.mockResolvedValueOnce({
        Attributes: {
          episodeId: mockEpisodeId,
          videoS3Key: `videos/${mockUserId}/${mockChildId}/${mockEpisodeId}/video.mp4`,
          videoMimeType: "video/mp4",
          videoFileSize: 5000000,
          videoDuration: 12.5,
          uploadStatus: "completed",
          updatedAt: new Date().toISOString(),
        },
      }); // UpdateItem

      const event = createMockEvent({
        method: "POST",
        path: `/children/${mockChildId}/episodes/${mockEpisodeId}/upload-complete`,
        pathParameters: {
          childId: mockChildId,
          episodeId: mockEpisodeId,
        },
        body: {
          s3Key: `videos/${mockUserId}/${mockChildId}/${mockEpisodeId}/video.mp4`,
          mimeType: "video/mp4",
          fileSize: 5000000,
          duration: 12.5,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.uploadStatus).toBe("completed");
    });

    it("should link video to episode via episodeId", async () => {
      send.mockResolvedValueOnce({ Item: { episodeId: mockEpisodeId } });
      send.mockResolvedValueOnce({
        Attributes: {
          episodeId: mockEpisodeId,
          videoS3Key: `videos/${mockUserId}/${mockChildId}/${mockEpisodeId}/video.mp4`,
          videoMimeType: "video/mp4",
          videoFileSize: 5000000,
          videoDuration: 12.5,
          uploadStatus: "completed",
          updatedAt: new Date().toISOString(),
        },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${mockChildId}/episodes/${mockEpisodeId}/upload-complete`,
        pathParameters: {
          childId: mockChildId,
          episodeId: mockEpisodeId,
        },
        body: {
          s3Key: `videos/${mockUserId}/${mockChildId}/${mockEpisodeId}/video.mp4`,
          mimeType: "video/mp4",
          fileSize: 5000000,
          duration: 12.5,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.videoS3Key).toBe(
        `videos/${mockUserId}/${mockChildId}/${mockEpisodeId}/video.mp4`,
      );
    });
  });

  describe("GET /children/{childId}/episodes/{episodeId}/video-url", () => {
    it("should generate presigned URL for video playback", async () => {
      send.mockResolvedValueOnce({
        Item: {
          episodeId: mockEpisodeId,
          videoS3Key: `videos/${mockUserId}/${mockChildId}/${mockEpisodeId}/video.mp4`,
        },
      });

      const event = createMockEvent({
        method: "GET",
        path: `/children/${mockChildId}/episodes/${mockEpisodeId}/video-url`,
        pathParameters: {
          childId: mockChildId,
          episodeId: mockEpisodeId,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("url");
      expect(body.url).toMatch(/^https:\/\//);
    });

    it("should set playback presigned URL expiration to 60 minutes", async () => {
      send.mockResolvedValueOnce({
        Item: {
          episodeId: mockEpisodeId,
          videoS3Key: `videos/${mockUserId}/${mockChildId}/${mockEpisodeId}/video.mp4`,
        },
      });

      const event = createMockEvent({
        method: "GET",
        path: `/children/${mockChildId}/episodes/${mockEpisodeId}/video-url`,
        pathParameters: {
          childId: mockChildId,
          episodeId: mockEpisodeId,
        },
      });

      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const mockGetSignedUrl = vi.mocked(getSignedUrl);

      await handler(event);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 3600 }, // 60 minutes
      );
    });
  });
});
