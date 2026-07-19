import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import MapError from "./error";

describe("MapError", () => {
  const mockError = new Error("Map render error");
  const mockReset = vi.fn();

  it("renders the map error heading", () => {
    render(<MapError error={mockError} reset={mockReset} />);
    expect(
      screen.getByRole("heading", { name: /map failed to load/i })
    ).toBeInTheDocument();
  });

  it("renders the descriptive message", () => {
    render(<MapError error={mockError} reset={mockReset} />);
    expect(
      screen.getByText(/there was a problem rendering the map/i)
    ).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    render(<MapError error={mockError} reset={mockReset} />);
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", async () => {
    const user = userEvent.setup();
    render(<MapError error={mockError} reset={mockReset} />);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("renders inside a full-screen container", () => {
    const { container } = render(<MapError error={mockError} reset={mockReset} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("h-screen", "w-screen");
  });

  it("logs the error to the console", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<MapError error={mockError} reset={mockReset} />);
    expect(consoleSpy).toHaveBeenCalledWith(mockError);
    consoleSpy.mockRestore();
  });
});
