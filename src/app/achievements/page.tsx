import { redirect } from "next/navigation";

// Achievements moved into the Akhada tab (D46): Leaderboard · Challenges · Awards.
export default function AchievementsPage() {
  redirect("/akhada?tab=awards");
}
