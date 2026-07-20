import { RaceSyncService } from "../../../sync/race.sync.service.js";

const syncUpcomingRaces = async () => {
  return RaceSyncService.syncUpcoming(3);
};

const syncPastResults = async () => {
  return RaceSyncService.syncResults(3);
};

export const SyncService = {
  syncUpcomingRaces,
  syncPastResults,
};
