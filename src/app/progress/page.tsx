import { redirect } from "next/navigation";

// Progress became a tab inside Health (D55): Progress · Body · Habits.
export default function ProgressPage() {
  redirect("/health");
}
