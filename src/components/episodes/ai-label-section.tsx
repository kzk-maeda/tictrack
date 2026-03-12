"use client";

import { useState, useEffect, useRef } from "react";
import { Brain, ThumbsUp, ThumbsDown, AlertCircle, Edit, Loader2, RefreshCw } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { triggerAIAnalysis, submitAILabelFeedback, getAILabel, getAnalysisStatus } from "@/lib/api/ai-labels";
import type { Episode, AILabel } from "@/lib/types";
import { getSymptomName } from "@/lib/tic-symptoms";
import outputs from "../../../amplify_outputs.json";

interface AILabelSectionProps {
  episode: Episode;
  aiLabel?: AILabel;
  onAnalysisComplete?: () => void;
  onFeedbackSubmit?: () => void;
  isDemoMode?: boolean;
}

export function AILabelSection({
  episode,
  aiLabel: initialAILabel,
  onAnalysisComplete,
  onFeedbackSubmit,
  isDemoMode = false,
}: AILabelSectionProps) {
  const t = useTranslations("aiLabel");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "ja" | "en";
  const { toast } = useToast();
  const [aiLabel, setAILabel] = useState<AILabel | undefined>(initialAILabel);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingLabel, setIsLoadingLabel] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackDetails, setFeedbackDetails] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Refs to store polling interval and timeout IDs
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with parent prop changes
  useEffect(() => {
    setAILabel(initialAILabel);
  }, [initialAILabel]);

  // Update analyzing state based on episode status
  useEffect(() => {
    if (episode.labelStatus === "analyzing") {
      setIsAnalyzing(true);
      // Start polling if not already polling
      if (!pollIntervalRef.current) {
        startPolling();
      }
    }
  }, [episode.labelStatus]);

  // Load AI label if episode has ai_suggested status but no label provided
  useEffect(() => {
    if (
      !aiLabel &&
      episode.labelStatus === "ai_suggested" &&
      episode.videoS3Key &&
      !isLoadingLabel
    ) {
      loadAILabel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode.episodeId, episode.labelStatus]);

  const loadAILabel = async () => {
    setIsLoadingLabel(true);
    try {
      const label = await getAILabel(episode.childId, episode.episodeId);
      setAILabel(label as AILabel);
    } catch (error) {
      console.error("Failed to load AI label:", error);
      // Don't show error toast for missing labels (404 is expected)
      if (error instanceof Error && !error.message.includes("404")) {
        toast({
          variant: "destructive",
          title: t("loadError"),
          description: error.message,
        });
      }
    } finally {
      setIsLoadingLabel(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    if (!episode.videoS3Key) {
      toast({
        variant: "destructive",
        title: t("noVideoError"),
        description: t("noVideoErrorDescription"),
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const bucketName = outputs.storage.bucket_name;
      const result = await triggerAIAnalysis(episode.episodeId, {
        childId: episode.childId,
        s3Key: episode.videoS3Key,
        bucketName,
        videoMimeType: episode.videoMimeType,
      });

      if (result.status === "analyzing") {
        toast({
          title: t("analysisStarted"),
          description: t("analysisStartedDescription"),
        });

        // Start polling for status
        startPolling();
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        variant: "destructive",
        title: t("analysisError"),
        description: error instanceof Error ? error.message : tCommon("error"),
      });
      setIsAnalyzing(false);
    }
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  const startPolling = () => {
    // Clear any existing polling
    stopPolling();

    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await getAnalysisStatus(episode.childId, episode.episodeId);

        if (status.status === "ai_suggested") {
          stopPolling();
          setIsAnalyzing(false);

          if (status.aiLabel) {
            setAILabel(status.aiLabel);
          }

          toast({
            title: t("analysisComplete"),
            description: t("analysisCompleteDescription"),
          });

          onAnalysisComplete?.();
        } else if (status.status === "failed") {
          stopPolling();
          setIsAnalyzing(false);

          toast({
            variant: "destructive",
            title: t("analysisFailed"),
            description: status.error || t("analysisFailedDescription"),
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
        // Continue polling on error
      }
    }, 3000); // Poll every 3 seconds

    // Timeout after 5 minutes (100 polls) - AI analysis can take time
    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
      // Don't set isAnalyzing to false - keep showing analyzing state
      // User can refresh the page to check status

      toast({
        title: t("analysisInProgress"),
        description: t("analysisInProgressDescription"),
      });
    }, 300000); // 5 minutes
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const handleSubmitFeedback = async (feedbackType: "useful" | "not_useful" | "incorrect" | "needs_edit") => {
    setSubmittingFeedback(true);
    try {
      await submitAILabelFeedback(episode.childId, episode.episodeId, {
        feedbackType,
        feedbackDetails: feedbackDetails || undefined,
      });

      toast({
        title: t("feedbackSuccess"),
        description: t("feedbackSuccessDescription"),
      });
      setShowFeedback(false);
      setFeedbackDetails("");
      onFeedbackSubmit?.();
    } catch (error) {
      console.error("Feedback error:", error);
      toast({
        variant: "destructive",
        title: t("feedbackError"),
        description: error instanceof Error ? error.message : tCommon("error"),
      });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // No AI label and no video - cannot analyze
  if (!aiLabel && !episode.videoS3Key) {
    return null;
  }

  // No AI label but video exists - show trigger button (not in demo mode)
  // Show for pending, undefined (old episodes), or any non-completed status
  if (!aiLabel && episode.labelStatus !== "ai_suggested" && episode.labelStatus !== "analyzing") {
    // In demo mode, don't show the analyze button
    if (isDemoMode) {
      return null;
    }

    return (
      <Card className="mt-3">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("notAnalyzed")}</span>
            </div>
            <Button
              size="sm"
              onClick={handleTriggerAnalysis}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("analyzing")}
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  {t("analyzeVideo")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show analyzing state
  if (episode.labelStatus === "analyzing" && !aiLabel) {
    return (
      <Card className="mt-3">
        <CardContent className="pt-4">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">{t("analyzing")}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading AI label
  if (isLoadingLabel) {
    return (
      <Card className="mt-3">
        <CardContent className="pt-4">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">{tCommon("loading")}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // AI label exists - show analysis results
  if (!aiLabel) return null;

  // Debug logging
  console.log("=== AI Label Debug ===");
  console.log("Full aiLabel:", JSON.stringify(aiLabel, null, 2));
  console.log("primaryTic:", aiLabel.primaryTic);
  console.log("severity:", aiLabel.severity);
  console.log("suggestedType:", aiLabel.suggestedType);

  // Use new structure (primaryTic) or fall back to legacy fields
  const primaryTic = aiLabel.primaryTic;
  const severity = aiLabel.severity || aiLabel.suggestedSeverity || 3;

  // Severity color (1-5 scale)
  const severityColor = severity <= 2
    ? "bg-green-100 text-green-800"
    : severity === 3
    ? "bg-yellow-100 text-yellow-800"
    : "bg-orange-100 text-orange-800";

  // Type label
  const typeLabel = primaryTic
    ? (primaryTic.type === "motor" ? t("typeMotor") : t("typeVocal"))
    : (aiLabel.suggestedType === "motor"
      ? t("typeMotor")
      : aiLabel.suggestedType === "vocal"
      ? t("typeVocal")
      : t("typeBoth"));

  // Complexity label
  const complexityLabel = primaryTic
    ? (primaryTic.complexity === "simple" ? t("complexitySimple") : t("complexityComplex"))
    : null;

  // Symptom name
  const symptomLabel = primaryTic
    ? (primaryTic.symptomId
        ? getSymptomName(primaryTic.symptomId, locale)
        : primaryTic.customSymptom)
    : null;

  return (
    <Card className="mt-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4" />
            {t("title")}
          </CardTitle>
          {aiLabel && episode.videoS3Key && !isDemoMode && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleTriggerAnalysis}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  {t("analyzing")}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-3 w-3" />
                  {t("reanalyze")}
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Symptom Name (Primary) */}
        {symptomLabel && (
          <div className="text-base font-semibold">
            {symptomLabel}
          </div>
        )}

        {/* Type, Complexity, and Severity */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{typeLabel}</Badge>
          {complexityLabel && (
            <Badge variant="outline">{complexityLabel}</Badge>
          )}
          <Badge className={severityColor}>
            {t("severity")} {severity}/5
          </Badge>
          {(primaryTic?.confidence || aiLabel.confidence) && (
            <Badge variant="secondary">
              {t("confidence")} {Math.round((primaryTic?.confidence || aiLabel.confidence || 0) * 100)}%
            </Badge>
          )}
        </div>

        {/* Secondary Tics */}
        {aiLabel.secondaryTics && aiLabel.secondaryTics.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t("secondaryTics")}:</p>
            <div className="flex flex-wrap gap-2">
              {aiLabel.secondaryTics.map((tic, idx) => {
                const secondarySymptom = tic.symptomId
                  ? getSymptomName(tic.symptomId, locale)
                  : tic.customSymptom;
                return (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {secondarySymptom || `${tic.type} (${tic.complexity})`}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Observations */}
        {aiLabel.observations && aiLabel.observations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t("observations")}:</p>
            <ul className="space-y-1">
              {aiLabel.observations.map((obs, idx) => (
                <li key={idx} className="text-sm text-muted-foreground">
                  {obs.timestamp && (
                    <span className="font-mono">{typeof obs.timestamp === 'number' ? `${obs.timestamp}s` : obs.timestamp}</span>
                  )}
                  {" "}{obs.description}
                  {obs.intensity && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {obs.intensity}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Legacy Context (if no observations) */}
        {!aiLabel.observations && aiLabel.suggestedContext && (
          <p className="text-sm text-muted-foreground">
            <strong>{t("context")}:</strong> {aiLabel.suggestedContext}
          </p>
        )}

        {/* Feedback Section (not in demo mode) */}
        {!isDemoMode && (episode.feedbackType ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {episode.feedbackType === "useful" && <ThumbsUp className="h-4 w-4" />}
            {episode.feedbackType === "not_useful" && <ThumbsDown className="h-4 w-4" />}
            {episode.feedbackType === "incorrect" && <AlertCircle className="h-4 w-4" />}
            {episode.feedbackType === "needs_edit" && <Edit className="h-4 w-4" />}
            <span>{t(`feedback.${episode.feedbackType}`)}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {!showFeedback ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("helpful")}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSubmitFeedback("useful")}
                  disabled={submittingFeedback}
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  {t("yes")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFeedback(true)}
                  disabled={submittingFeedback}
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  {t("no")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{t("tellUsMore")}</p>
                <Textarea
                  placeholder={t("feedbackPlaceholder")}
                  value={feedbackDetails}
                  onChange={(e) => setFeedbackDetails(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSubmitFeedback("not_useful")}
                    disabled={submittingFeedback}
                  >
                    <ThumbsDown className="mr-2 h-4 w-4" />
                    {t("notUseful")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSubmitFeedback("incorrect")}
                    disabled={submittingFeedback}
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    {t("incorrect")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSubmitFeedback("needs_edit")}
                    disabled={submittingFeedback}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    {t("needsEdit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowFeedback(false);
                      setFeedbackDetails("");
                    }}
                    disabled={submittingFeedback}
                  >
                    {tCommon("cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
