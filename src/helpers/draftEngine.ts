import { prisma } from "./prisma.js";
// import { DraftService } from "../app/modules/draft/draft.service.js";
import { getIO } from "./socketHelper.js";

// Keep track of running interval
let draftEngineInterval: NodeJS.Timeout | null = null;
const processingLeagues = new Set<string>();

export const startDraftEngine = () => {
  if (draftEngineInterval) return;

  console.log("⚙️ Starting Draft Engine Heartbeat...");

  draftEngineInterval = setInterval(async () => {
    try {
      // Find all draft sessions currently in DRAFTING state
      const activeDrafts = await prisma.draftSession.findMany({
        where: { status: "DRAFTING" },
        include: {
          draftOrder: {
            orderBy: { overallPick: "asc" },
            include: { team: true },
          },
        },
      });

      for (const session of activeDrafts) {
        if (processingLeagues.has(session.leagueId)) continue;
        if (!session.turnStartedAt) continue;

        const currentOrderSlot = session.draftOrder[session.currentPickIndex];
        if (!currentOrderSlot) continue;

        const now = new Date().getTime();
        const turnStart = session.turnStartedAt.getTime();
        const elapsedSeconds = Math.floor((now - turnStart) / 1000);

        // Check if user has Auto-pick enabled
        const member = await prisma.leagueMember.findUnique({
          where: {
            leagueId_userId: {
              leagueId: session.leagueId,
              userId: currentOrderSlot.team.ownerId,
            },
          },
        });

        const isAutoPick = member?.isAutoPickEnabled;

        // If Auto-pick is ON, pick after 1 second. Otherwise, wait for secondsPerPick.
        const shouldAutoPick = isAutoPick
          ? elapsedSeconds >= 1
          : elapsedSeconds >= session.secondsPerPick;

        if (shouldAutoPick && session.status === "DRAFTING") {
          console.log(
            `⏱️ ${isAutoPick ? "Auto Pick (Toggle ON)" : "Draft Timer Expired"} for League ${
              session.leagueId
            }. Picking...`
          );
          processingLeagues.add(session.leagueId);
          DraftService.autoPick(session.leagueId, currentOrderSlot.teamId)
            .catch((error) => {
              console.error(`Failed to auto-pick for league ${session.leagueId}:`, error);
            })
            .finally(() => {
              processingLeagues.delete(session.leagueId);
            });
        }
      }

      // ─── Auto-Start WAITING drafts that reached draftTime ───────────────────
      // ─── Auto-Start WAITING drafts that reached draftTime ───────────────────
      const allDraftingLeagues = await prisma.league.findMany({
        where: { status: "DRAFTING", deletedAt: null },
        include: { draftSession: true },
      });

      const leaguesToStart = allDraftingLeagues.filter(l => 
        l.draftTime && 
        new Date(l.draftTime) <= new Date() && 
        l.draftSession?.status === "WAITING"
      );

      for (const league of leaguesToStart) {
        if (processingLeagues.has(league.id)) continue;

        console.log(`🚀 Auto-starting draft for league "${league.name}" (${league.id})...`);
        processingLeagues.add(league.id);
        DraftService.startDraft(league.id, league.managerId, "ADMIN")
          .then(() => {
            console.log(`✅ Auto-start successful for league ${league.id}`);
          })
          .catch((error) => {
            console.error(`❌ Failed to auto-start draft for league ${league.id}:`, error.message || error);
          })
          .finally(() => {
            processingLeagues.delete(league.id);
          });
      }

    } catch (error) {
      console.error("Draft Engine Heartbeat Error:", error);
    }
  }, 1000); // Check every second
};

export const stopDraftEngine = () => {
  if (draftEngineInterval) {
    clearInterval(draftEngineInterval);
    draftEngineInterval = null;
    console.log("🛑 Draft Engine Heartbeat stopped.");
  }
};
