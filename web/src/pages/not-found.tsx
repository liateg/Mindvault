import { Link } from "react-router-dom";
import { Button, StatePanel } from "../components/ui";

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <StatePanel
        title="Page not found"
        description="The route you requested does not exist."
        action={
          <Link to="/">
            <Button>Return home</Button>
          </Link>
        }
      />
    </main>
  );
}
