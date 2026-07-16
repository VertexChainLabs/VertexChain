import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import GlobalError from "./error";

describe("GlobalError", () => {
  const mockError = new Error("Test render error");
  const mockReset = vi.fn();

  it("renders the error heading", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(
      screen.getByRole("heading", { name: /something went wrong/i })
    ).toBeInTheDocument();
  });

  it("renders the descriptive message", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(
      screen.getByText(/an unexpected error occurred/i)
    ).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", async () => {
    const user = userEvent.setup();
    render(<GlobalError error={mockError} reset={mockReset} />);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to the console", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(consoleSpy).toHaveBeenCalledWith(mockError);
    consoleSpy.mockRestore();
  });
});
