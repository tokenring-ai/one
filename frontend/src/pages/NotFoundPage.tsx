import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../ui/button.tsx";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-primary">Page not found</h1>
      <p className="text-sm text-muted max-w-sm">The page you're looking for doesn't exist or may have been moved.</p>
      <Button type="button" size="md" icon={ArrowLeft} onClick={() => navigate("/")}>
        Go to Dashboard
      </Button>
    </div>
  );
}
