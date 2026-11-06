import { Input } from "./input";
import { Select, SelectTrigger, SelectValue } from "./select";
import { Textarea } from "./textarea";
import { render, screen } from "@/test/test-utils";

// Form controls sit on their own surface (`bg-field`, white in light mode) so they read as
// controls on the off-white page and on muted panels. `pnpm --filter client ui:add` rewrites
// these files with shadcn's transparent default; this test is what catches that.
describe("form control surface", () => {
  it("input, textarea and select trigger use the field surface", () => {
    render(
      <>
        <Input aria-label="text" />
        <Textarea aria-label="area" />
        <Select>
          <SelectTrigger aria-label="pick">
            <SelectValue />
          </SelectTrigger>
        </Select>
      </>,
    );
    for (const control of [
      screen.getByLabelText("text"),
      screen.getByLabelText("area"),
      screen.getByLabelText("pick"),
    ]) {
      expect(control.className).toContain("bg-field");
      expect(control.className).not.toMatch(/(^|\s)bg-transparent(\s|$)/);
    }
  });
});
