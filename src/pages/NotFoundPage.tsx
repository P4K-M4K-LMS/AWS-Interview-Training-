import { EmptyState } from "../components/ui";

export function NotFoundPage() {
  return <EmptyState title="Page not found" body="That route does not exist." cta={{ to: "/", label: "Back to Dashboard" }} />;
}
