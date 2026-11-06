import { DetailSkeleton, LoadingRegion, TableSkeleton } from "./skeletons";
import { renderWithProviders, screen } from "@/test/test-utils";

describe("skeletons", () => {
  it("LoadingRegion exposes the loading state to assistive tech", () => {
    renderWithProviders(
      <LoadingRegion testId="thing-loading">
        <TableSkeleton rows={3} />
      </LoadingRegion>,
    );
    const region = screen.getByTestId("thing-loading");
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveTextContent(/loading/i);
    // header + 3 rows, each with the default 4 columns, all decorative
    expect(region.querySelectorAll("[aria-hidden='true']")).toHaveLength(16);
  });

  it("DetailSkeleton renders the requested paragraphs", () => {
    renderWithProviders(
      <LoadingRegion testId="d">
        <DetailSkeleton paragraphs={5} />
      </LoadingRegion>,
    );
    expect(screen.getByTestId("d").querySelectorAll("[aria-hidden='true']")).toHaveLength(8);
  });
});
