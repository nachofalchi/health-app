import { DashboardTabs } from "@/components/dashboard-tabs";
import { getDashboardData } from "@/lib/dashboard-data";
import { getAppUserContext } from "@/lib/app-user";
import { LandingAuthPage } from "@/components/landing-auth-page";

export default async function Home() {
  const appUser = await getAppUserContext();

  if (!appUser) {
    return <LandingAuthPage />;
  }

  const dashboard = await getDashboardData(appUser);
  const { day, sectorCards, weeklySummary, experiments = [], advancedScores } = dashboard;

  return (
    <main className="shell">
      <DashboardTabs
        day={day}
        sectorCards={sectorCards as any}
        latestExercise={dashboard.latestExercise}
        stepsSeries={dashboard.stepsSeries}
        dataCards={dashboard.dataCards}
        weeklySummary={weeklySummary}
        experiments={experiments}
        syncSummary={dashboard.syncSummary}
        profile={dashboard.profile}
        isGoogleHealthConnected={dashboard.isGoogleHealthConnected}
        advancedScores={advancedScores}
        anomalies={dashboard.anomalies}
      />
    </main>
  );
}

