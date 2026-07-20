import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-primary">Page not found</h1>
      <p className="text-sm text-muted max-w-sm">The page you're looking for doesn't exist or may have been moved.</p>
      <button
        type="button"
        onClick={() => navigate("/")}
        className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors focus-ring cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Go to Dashboard
      </button>
    </div>
  );
}
