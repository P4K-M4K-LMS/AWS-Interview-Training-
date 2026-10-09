import { BigOVisualizer } from "../components/BigOVisualizer";
import { PageHeader, Panel } from "../components/ui";

export function AlgorithmsLabPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Algorithms Laboratory" subtitle="Instrumented algorithms with adjustable input sizes, operation counting, step-through and side-by-side comparison." />
      <Panel>
        <BigOVisualizer />
      </Panel>
    </div>
  );
}
