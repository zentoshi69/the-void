import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-void-text-primary">Command Center</h1>
        <p className="mt-1 text-sm text-void-text-secondary">
          Capital overview and system status
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-void-text-secondary">System Status</span>
            <Badge variant="positive">Operational</Badge>
          </div>
          <p className="mt-3 font-mono text-2xl font-semibold">Online</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-void-text-secondary">Active Strategies</span>
            <Badge variant="neutral">Phase 0</Badge>
          </div>
          <p className="mt-3 font-mono text-2xl font-semibold">0</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-void-text-secondary">Open Positions</span>
            <Badge variant="neutral">Phase 0</Badge>
          </div>
          <p className="mt-3 font-mono text-2xl font-semibold">0</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-void-text-secondary">Pending Orders</span>
            <Badge variant="neutral">Phase 0</Badge>
          </div>
          <p className="mt-3 font-mono text-2xl font-semibold">0</p>
        </Card>
      </div>
    </div>
  );
}
