"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Video, X, Check, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

type RecordingState = "idle" | "requesting" | "recording" | "preview";

export default function CapturePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("capture");
  const tCommon = useTranslations("common");

  const childId = searchParams.get("childId");
  const episodeId = searchParams.get("episodeId");

  const [state, setState] = useState<RecordingState>("idle");
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_DURATION = 20; // seconds
  const MIN_DURATION = 5; // seconds

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setState("requesting");
    setError(null);

    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Display video stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start recording automatically
      startRecording(stream);
    } catch (err) {
      console.error("Camera access error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "カメラへのアクセスが拒否されました",
      );
      setState("idle");
    }
  };

  const startRecording = (stream: MediaStream) => {
    chunksRef.current = [];

    // Detect supported MIME type
    const mimeType = MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 1500000, // 1.5 Mbps
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
      stopCamera();
      setState("preview");
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setState("recording");
    setCountdown(MAX_DURATION);

    // Countdown timer
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed++;
      const remaining = MAX_DURATION - elapsed;
      setCountdown(remaining);

      if (remaining <= 0) {
        stopRecording();
      }
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const retake = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setState("idle");
  };

  const saveVideo = async () => {
    if (!recordedBlob || !childId || !episodeId) return;

    try {
      // TODO: Upload to S3 via presigned URL
      // For now, just navigate back
      router.push(`/?childId=${childId}`);
    } catch (err) {
      console.error("Upload error:", err);
      setError("動画のアップロードに失敗しました");
    }
  };

  const cancel = () => {
    stopCamera();
    router.back();
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button variant="ghost" size="icon" onClick={cancel}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Video Display */}
        <Card className="overflow-hidden aspect-video bg-black relative">
          {state === "preview" && recordedUrl ? (
            <video
              src={recordedUrl}
              controls
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          )}

          {/* Recording Indicator */}
          {state === "recording" && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="font-mono text-sm">{countdown}s</span>
            </div>
          )}

          {/* Countdown Overlay */}
          {state === "recording" && countdown <= 3 && countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-8xl font-bold animate-pulse">
                {countdown}
              </div>
            </div>
          )}
        </Card>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-4">
          {state === "idle" && (
            <Button onClick={startCamera} className="flex-1" size="lg">
              <Camera className="mr-2 h-5 w-5" />
              {t("startRecording")}
            </Button>
          )}

          {state === "requesting" && (
            <Button disabled className="flex-1" size="lg">
              <Video className="mr-2 h-5 w-5 animate-pulse" />
              {t("requestingCamera")}
            </Button>
          )}

          {state === "recording" && (
            <Button
              onClick={stopRecording}
              variant="destructive"
              className="flex-1"
              size="lg"
              disabled={countdown > MAX_DURATION - MIN_DURATION}
            >
              <Video className="mr-2 h-5 w-5" />
              {t("stopRecording")} ({countdown}s)
            </Button>
          )}

          {state === "preview" && (
            <>
              <Button
                onClick={retake}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                {t("retake")}
              </Button>
              <Button onClick={saveVideo} className="flex-1" size="lg">
                <Check className="mr-2 h-5 w-5" />
                {tCommon("save")}
              </Button>
            </>
          )}
        </div>

        {/* iOS Fallback */}
        {!navigator.mediaDevices && (
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              {t("cameraNotSupported")}
            </p>
            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              id="file-upload"
            />
            <Button asChild variant="outline">
              <label htmlFor="file-upload" className="cursor-pointer">
                <Camera className="mr-2 h-5 w-5" />
                {t("selectVideo")}
              </label>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
