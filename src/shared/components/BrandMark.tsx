import { Box } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-mark" aria-label="RigStage">
      <span className="brand-mark__icon">
        <Box aria-hidden="true" />
      </span>
      <span
        className={
          compact
            ? "brand-mark__word brand-mark__word--compact"
            : "brand-mark__word"
        }
      >
        Rig<span>Stage</span>
      </span>
    </span>
  );
}
