import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AppRouter } from "@/config/routes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/shared/Toast";

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
