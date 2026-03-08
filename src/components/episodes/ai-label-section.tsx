"use client";

import { useState } from "react";
import { Brain, ThumbsUp, ThumbsDown, AlertCircle, Edit, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { triggerAIAnalysis, submitAILabelFeedback } from "@/lib/api";
import type { Episode, AILabel } from "@/lib/types";
import outputs from "../../../amplify_outputs.json";

interface AILabelSectionProps {
  episode: Episode;
  aiLabel?: AILabel;
  onAnalysisComplete?: () => void;
  onFeedbackSubmit?: () => void;
}

export function AILabelSection({
  episode,
  aiLabel,
  onAnalysisComplete,
  onFeedbackSubmit,
}: AILabelSectionProps) {
  const t = useTranslations("aiLabel");
  const tCommon = useTranslations("common");
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackDetails, setFeedbackDetails] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

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

      if (result.status === "completed") {
        toast({
          title: t("analysisComplete"),
          description: t("analysisCompleteDescription"),
        });
        onAnalysisComplete?.();
      } else {
        throw new Error(result.error || "Analysis failed");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        variant: "destructive",
        title: t("analysisError"),
        description: error instanceof Error ? error.message : tCommon("error"),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

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

  // No AI label but video exists - show trigger button
  if (!aiLabel && episode.labelStatus === "pending") {
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

  // AI label exists - show analysis results
  if (!aiLabel) return null;

  const severityColor = aiLabel.suggestedSeverity === 1
    ? "bg-green-100 text-green-800"
    : aiLabel.suggestedSeverity === 2
    ? "bg-yellow-100 text-yellow-800"
    : "bg-red-100 text-red-800";

  const typeLabel = aiLabel.suggestedType === "motor"
    ? t("typeMotor")
    : aiLabel.suggestedType === "vocal"
    ? t("typeVocal")
    : t("typeBoth");

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Brain className="h-4 w-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Type and Severity */}
        <div className="flex items-center gap-2">
          <Badge variant="outline">{typeLabel}</Badge>
          <Badge className={severityColor}>
            {t("severity")} {aiLabel.suggestedSeverity}/3
          </Badge>
          {aiLabel.confidence && (
            <Badge variant="secondary">
              {t("confidence")} {Math.round(aiLabel.confidence * 100)}%
            </Badge>
          )}
        </div>

        {/* Context */}
        {aiLabel.suggestedContext && (
          <p className="text-sm text-muted-foreground">
            <strong>{t("context")}:</strong> {aiLabel.suggestedContext}
          </p>
        )}

        {/* Observations */}
        {aiLabel.observations && aiLabel.observations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t("observations")}:</p>
            <ul className="space-y-1">
              {aiLabel.observations.map((obs, idx) => (
                <li key={idx} className="text-sm text-muted-foreground">
                  {obs.timestamp && <span className="font-mono">{obs.timestamp}</span>}
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

        {/* Feedback Section */}
        {episode.feedbackType ? (
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
        )}
      </CardContent>
    </Card>
  );
}
