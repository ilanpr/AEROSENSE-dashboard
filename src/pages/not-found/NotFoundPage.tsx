import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/constants";

/**
 * 404 Not Found Page
 *
 * Displayed when user navigates to a non-existent route.
 */
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <h1 className="text-6xl font-bold text-foreground">404</h1>
      <p className="text-lg text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Link
        to={ROUTES.DASHBOARD}
        className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
