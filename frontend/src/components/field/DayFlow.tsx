"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DistanceConfirmCard } from "@/components/field/DistanceConfirmCard";
import { useResolvedLocation } from "@/lib/hooks/useResolvedLocation";
import { usePUDistance } from "@/lib/hooks/usePUDistance";
import { checkIn, checkOut, updateStatus } from "@/lib/api/officers";
import { queueCheckIn, queueCheckOut, queueStatus } from "@/lib/offline/queue";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useAssignedPU } from "@/components/field/AssignedPUContext";
import type { PUStatus } from "@/types";
import { toast } from "sonner";
import { MapPin, LogOut, Loader2, CheckCircle2, PartyPopper, AlertTriangle } from "lucide-react";

interface Stage {
  status: PUStatus;
  /** First screen: a plain gut-check before anything is treated as
   * confirmed. */
  intentQuestion: string;
  intentConfirmLabel: string;
  /** Second screen: the question restated next to a live distance
   * readout -- a mis-tap on the intent screen alone can't send anything. */
  confirmQuestion: string;
}

// The polling day, one question at a time -- each stage only appears
// once the one before it has been confirmed. "not_open" isn't listed
// here: it's just the PU's default state before anyone has confirmed
// anything, never something an agent explicitly sends.
const STAGES: Stage[] = [
  {
    status: "accrediting",
    intentQuestion: "Accreditation started?",
    intentConfirmLabel: "Accreditation started",
    confirmQuestion: "Has accreditation started?",
  },
  {
    status: "voting",
    intentQuestion: "Voting started?",
    intentConfirmLabel: "Voting started",
    confirmQuestion: "Has voting started?",
  },
  {
    status: "completed",
    intentQuestion: "Voting has finished?",
    intentConfirmLabel: "Voting finished",
    confirmQuestion: "Has voting finished at your polling unit?",
  },
  {
    status: "counting",
    intentQuestion: "Counting started?",
    intentConfirmLabel: "Counting started",
    confirmQuestion: "Has counting started?",
  },
];

/** How many stages are already confirmed, going by the PU's last-known
 * status -- e.g. "voting" means accreditation and voting are both done,
 * so the next thing to ask about is stage index 2 (completed). A status
 * outside this pipeline (incident/distress/no_report -- none of which
 * this flow sends anymore) has no reliable pipeline position to recover,
 * so it starts over from the top rather than guessing. */
function seedStageIndex(status: PUStatus | undefined): number {
  const idx = STAGES.findIndex((s) => s.status === status);
  return idx === -1 ? 0 : idx + 1;
}

type ArrivalStep = "distance" | "recording" | "done" | null;
type Direction = "arrive" | "leave";
type PipelineSubstep = "collapsed" | "intent" | "confirm";

/** The whole field-app home flow, one screen at a time: arrive at your PU
 * -> accreditation -> voting -> voting finished -> counting, each step a
 * plain question, a confirm-with-distance, then the next question --
 * never a menu of everything you could report. Reporting an issue and
 * checking out are always reachable alongside it, but don't interrupt
 * the sequence. */
export function DayFlow() {
  const { resolve } = useResolvedLocation();
  const assignedPU = useAssignedPU();
  const user = useAuthStore((s) => s.user);
  const updateLocalStatus = useAuthStore((s) => s.updateLocalStatus);
  const puCode = user?.assigned_pu_code;
  const distance = usePUDistance(assignedPU);

  const checkedIn = user?.status === "active";

  const [arrivalStep, setArrivalStep] = useState<ArrivalStep>(null);
  // Captured once when arrival/departure starts, not re-derived from live
  // status -- checkIn/checkOut flip user.status the instant they succeed,
  // which would otherwise yank these screens straight past "recording"/
  // "done" into the pipeline view mid-render (status already says
  // "active" before the agent ever saw a confirmation).
  const [direction, setDirection] = useState<Direction>("arrive");

  // Starts at 0 (nothing confirmed) and gets seeded from the PU's real
  // current_status the moment AssignedPUContext's fetch resolves --
  // that context starts out null and populates async, so a plain lazy
  // useState initializer here would run before the real status ever
  // arrived and permanently stick at 0.
  const [stageIndex, setStageIndex] = useState(0);
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !assignedPU) return;
    seededRef.current = true;
    setStageIndex(seedStageIndex(assignedPU.current_status));
  }, [assignedPU]);

  const [pipelineSubstep, setPipelineSubstep] = useState<PipelineSubstep>("intent");
  const [submittingStage, setSubmittingStage] = useState(false);

  function startArrival() {
    setDirection("arrive");
    setArrivalStep("distance");
  }

  function startDeparture() {
    setDirection("leave");
    setArrivalStep("distance");
  }

  async function handleConfirmArrival() {
    setArrivalStep("recording");
    let lat: number, lng: number, approximate: boolean;
    try {
      ({ lat, lng, approximate } = await resolve(assignedPU));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't get your location.");
      setArrivalStep("distance");
      return;
    }
    if (approximate) {
      toast.info("Couldn't get your device's GPS — using your assigned polling unit's location instead.");
    }
    try {
      await checkIn(lat, lng);
      updateLocalStatus("active");
      toast.success("Checked in — your location has been shared");
      setArrivalStep("done");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Couldn't check in — the server rejected it. Try again.");
        setArrivalStep("distance");
      } else {
        await queueCheckIn(lat, lng);
        updateLocalStatus("active");
        toast.info("No connection — check-in saved and will send automatically once you're back online.");
        setArrivalStep("done");
      }
    }
  }

  async function handleConfirmDeparture() {
    setArrivalStep("recording");
    try {
      await checkOut();
      updateLocalStatus("offline");
      toast.success("Checked out");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Couldn't check out — the server rejected it. Try again.");
      } else {
        await queueCheckOut();
        updateLocalStatus("offline");
        toast.info("No connection — checkout saved and will send automatically once you're back online.");
      }
    } finally {
      setArrivalStep(null);
    }
  }

  async function handleConfirmStage(stage: Stage) {
    if (!puCode) {
      toast.error("You have no assigned polling unit yet.");
      return;
    }
    setSubmittingStage(true);
    try {
      await updateStatus(puCode, stage.status);
      toast.success("Sent to the dashboard");
      setStageIndex((i) => i + 1);
      setPipelineSubstep("intent");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Couldn't send — the server rejected it. Try again.");
      } else {
        await queueStatus(puCode, stage.status);
        toast.info("No connection — saved on this device and will send automatically once you're back online.");
        setStageIndex((i) => i + 1);
        setPipelineSubstep("intent");
      }
    } finally {
      setSubmittingStage(false);
    }
  }

  // These arrival/departure sub-steps are checked before anything reads
  // live status -- see the `direction` comment above for why.
  if (arrivalStep === "distance") {
    return direction === "arrive" ? (
      <DistanceConfirmCard
        question="Are you at your polling unit?"
        distance={distance}
        puName={assignedPU?.pu_name}
        primaryLabel="I am there"
        secondaryLabel="Not yet"
        onPrimary={handleConfirmArrival}
        onSecondary={() => setArrivalStep(null)}
      />
    ) : (
      <DistanceConfirmCard
        question="Are you leaving your polling unit?"
        distance={distance}
        puName={assignedPU?.pu_name}
        primaryLabel="Yes, I'm leaving"
        secondaryLabel="No, stay"
        onPrimary={handleConfirmDeparture}
        onSecondary={() => setArrivalStep(null)}
      />
    );
  }

  if (arrivalStep === "recording") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-500" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {direction === "arrive" ? "Recording your location…" : "Checking you out…"}
        </p>
      </div>
    );
  }

  if (arrivalStep === "done") {
    return (
      <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          You&apos;re checked in — your location has been shared.
        </p>
        <Button
          size="lg"
          className="h-10 w-full rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500"
          onClick={() => setArrivalStep(null)}
        >
          Continue
        </Button>
      </div>
    );
  }

  if (!checkedIn) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-10">
        <Button
          size="lg"
          className="h-14 w-full max-w-xs gap-2 rounded-2xl bg-indigo-600 text-base font-semibold text-white shadow-md hover:bg-indigo-500"
          onClick={startArrival}
        >
          <MapPin className="h-5 w-5" />
          I have arrived
        </Button>
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          Tap this once you&apos;re at your polling unit to check in and start reporting.
        </p>
      </div>
    );
  }

  const currentStage = STAGES[stageIndex];
  const pastVotingStarted = stageIndex >= 1;

  return (
    <div className="space-y-3">
      {currentStage ? (
        pipelineSubstep === "collapsed" ? (
          <button
            type="button"
            onClick={() => setPipelineSubstep("intent")}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-left text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Next: {currentStage.intentQuestion}
            <span className="shrink-0 text-xs text-indigo-600 dark:text-indigo-400">Answer now</span>
          </button>
        ) : pipelineSubstep === "confirm" ? (
          <DistanceConfirmCard
            question={currentStage.confirmQuestion}
            distance={distance}
            puName={assignedPU?.pu_name}
            primaryLabel="Yes, confirm"
            secondaryLabel="Cancel"
            onPrimary={() => handleConfirmStage(currentStage)}
            onSecondary={() => setPipelineSubstep("intent")}
            primaryLoading={submittingStage}
          />
        ) : (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="font-heading text-base font-bold text-slate-900 dark:text-white">
              {currentStage.intentQuestion}
            </p>
            <div className="space-y-2">
              <Button
                size="lg"
                className="h-10 w-full rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500"
                onClick={() => setPipelineSubstep("confirm")}
              >
                {currentStage.intentConfirmLabel}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-10 w-full rounded-xl text-sm font-semibold"
                onClick={() => setPipelineSubstep("collapsed")}
              >
                No, I made a mistake
              </Button>
            </div>
          </div>
        )
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <PartyPopper className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            You&apos;ve completed today&apos;s reporting steps for this polling unit.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        {pastVotingStarted && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-1.5 rounded-xl text-xs font-semibold"
            nativeButton={false}
            render={<Link href="/field/report" />}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Report an issue
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 flex-1 gap-1.5 rounded-xl text-xs font-semibold text-muted-foreground"
          onClick={startDeparture}
        >
          <LogOut className="h-3.5 w-3.5" />
          I am leaving
        </Button>
      </div>
    </div>
  );
}
