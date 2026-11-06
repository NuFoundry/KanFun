import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListPagination } from "./list-pagination";
import { ListSearch, ListSelect, SortableHead } from "./list-toolbar";
import { Table, TableHeader, TableRow } from "@/components/ui/table";
import { renderWithProviders, screen } from "@/test/test-utils";

describe("list building blocks", () => {
  it("search box waits before reporting the value", async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    renderWithProviders(
      <ListSearch testId="posts" value="" onChange={onChange} placeholder="Search" />,
    );
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.type(screen.getByTestId("posts-search"), "abc");
    expect(onChange).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith("abc");
    jest.useRealTimers();
  });

  it("select maps the empty option both ways", () => {
    const onChange = jest.fn();
    renderWithProviders(
      <ListSelect
        testId="posts-status"
        value=""
        onChange={onChange}
        label="Status"
        options={[
          { value: "", label: "All" },
          { value: "draft", label: "Draft" },
        ]}
      />,
    );
    const trigger = screen.getByTestId("posts-status");
    expect(trigger).toHaveTextContent("All");
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Draft" }));
    expect(onChange).toHaveBeenCalledWith("draft");
  });

  it("sortable header shows the direction and asks to sort", async () => {
    const onSort = jest.fn();
    renderWithProviders(
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead column="title" sort="-title" onSort={onSort}>
              Title
            </SortableHead>
            <SortableHead column="created" sort="-title" onSort={onSort}>
              Created
            </SortableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    expect(screen.getByRole("columnheader", { name: /title/i })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByRole("columnheader", { name: /created/i })).toHaveAttribute(
      "aria-sort",
      "none",
    );
    await userEvent.click(screen.getByTestId("sort-created"));
    expect(onSort).toHaveBeenCalledWith("created");
  });

  it("pagination shows the range and moves between pages", async () => {
    const onPage = jest.fn();
    renderWithProviders(
      <ListPagination testId="posts" page={2} perPage={20} total={41} onPage={onPage} />,
    );
    expect(screen.getByTestId("posts-showing")).toHaveTextContent("Showing 21–40 of 41");
    await userEvent.click(screen.getByRole("link", { name: /next/i }));
    expect(onPage).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole("link", { name: "1" }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it("pagination hides the links when everything fits on one page", () => {
    renderWithProviders(
      <ListPagination testId="posts" page={1} perPage={20} total={3} onPage={jest.fn()} />,
    );
    expect(screen.getByTestId("posts-showing")).toHaveTextContent("Showing 1–3 of 3");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
