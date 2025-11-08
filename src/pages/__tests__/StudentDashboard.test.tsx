import {
  render,
  screen,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import StudentDashboard from "../StudentDashboard";
import { BrowserRouter } from "react-router-dom";

// Mocks
const mockLogout = vi.fn();
const mockedNavigate = vi.fn();

vi.mock("@/contexts/AuthContext", async () => {
  const actual = await vi.importActual("@/contexts/AuthContext");
  return {
    ...actual,
    useAuth: () => ({
      user: { name: "Student User", role: "student" },
      logout: mockLogout,
    }),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

// Mock child components
vi.mock("@/components/BookingForm", () => ({
  BookingForm: () => <div>Booking Form Content</div>,
}));
vi.mock("@/components/MyBookings", () => ({
  MyBookings: () => <div>My Bookings Content</div>,
}));

describe("StudentDashboard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderComponent = () =>
    render(
      <BrowserRouter>
        <StudentDashboard />
      </BrowserRouter>
    );

  it("renders the dashboard with default tab selected", async () => {
    renderComponent();
    expect(
      await screen.findByRole("heading", { name: /quickroom/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/welcome, student user/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /book room/i })
    ).toHaveClass("bg-blue-50");
    expect(screen.getByText("Booking Form Content")).toBeInTheDocument();
  });

  it("switches to the 'My Bookings' tab", async () => {
    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /my bookings/i }));

    expect(await screen.findByText("My Bookings Content")).toBeInTheDocument();
  });

  it("calls logout and navigates on logout button click", () => {
    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /logout/i }));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockedNavigate).toHaveBeenCalledWith("/login");
  });
});
