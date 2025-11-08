import {
  render,
  screen,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminDashboard from "../AdminDashboard";
import { BrowserRouter } from "react-router-dom";
import * as dataApi from "@/lib/dataApi";

// Mocks
const mockLogout = vi.fn();
const mockedNavigate = vi.fn();

vi.mock("@/contexts/AuthContext", async () => {
  const actual = await vi.importActual("@/contexts/AuthContext");
  return {
    ...actual,
    useAuth: () => ({
      user: { name: "Admin User", role: "admin" },
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

vi.mock("@/lib/dataApi", () => ({
  getAllBookings: vi.fn(),
  updateBookingStatus: vi.fn(),
  getRooms: vi.fn(),
}));

describe("AdminDashboard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(dataApi, "getRooms").mockResolvedValue([]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  const renderComponent = () =>
    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

  it("renders the dashboard with default tab selected", async () => {
    vi.spyOn(dataApi, "getAllBookings").mockResolvedValue([]);
    renderComponent();

    expect(
      await screen.findByRole("heading", { name: /quickroom admin/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/welcome, admin user/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /pending approvals/i })
    ).toHaveClass("bg-blue-50");
    expect(
      screen.getByRole("heading", { name: /pending approvals/i })
    ).toBeInTheDocument();
  });

  it("switches to the 'All Bookings' tab", async () => {
    vi.spyOn(dataApi, "getAllBookings").mockResolvedValue([]);
    renderComponent();

    await userEvent.click(
      screen.getByRole("button", { name: /all bookings/i })
    );

    expect(
      await screen.findByRole("heading", { name: /all bookings/i })
    ).toBeInTheDocument();
  });

  it("fetches and displays pending bookings", async () => {
    const mockBookings = [
      {
        id: 1,
        room_name: "Room A",
        user_name: "User 1",
        status: "pending",
        date: "2025-01-01",
        start_time: "10:00",
        end_time: "11:00",
      },
      {
        id: 2,
        room_name: "Room B",
        user_name: "User 2",
        status: "approved",
        date: "2025-01-01",
        start_time: "10:00",
        end_time: "11:00",
      },
    ];
    vi.spyOn(dataApi, "getAllBookings").mockResolvedValue(mockBookings);
    renderComponent();

    expect(await screen.findByText("Room A")).toBeInTheDocument();
    expect(screen.queryByText("Room B")).not.toBeInTheDocument();
  });

  it("fetches and displays all bookings", async () => {
    const mockBookings = [
      {
        id: 1,
        room_name: "Room A",
        user_name: "User 1",
        status: "pending",
        date: "2025-01-01",
        start_time: "10:00",
        end_time: "11:00",
      },
      {
        id: 2,
        room_name: "Room B",
        user_name: "User 2",
        status: "approved",
        date: "2025-01-01",
        start_time: "10:00",
        end_time: "11:00",
      },
    ];
    vi.spyOn(dataApi, "getAllBookings").mockResolvedValue(mockBookings);
    renderComponent();

    await userEvent.click(
      screen.getByRole("button", { name: /all bookings/i })
    );

    expect(await screen.findByText("Room A")).toBeInTheDocument();
    expect(await screen.findByText("Room B")).toBeInTheDocument();
  });

  it("filters bookings by status", async () => {
    const mockBookings = [
      {
        id: 1,
        room_name: "Room A",
        user_name: "User 1",
        status: "pending",
        date: "2025-01-01",
        start_time: "10:00",
        end_time: "11:00",
      },
      {
        id: 2,
        room_name: "Room B",
        user_name: "User 2",
        status: "approved",
        date: "2025-01-01",
        start_time: "10:00",
        end_time: "11:00",
      },
    ];
    vi.spyOn(dataApi, "getAllBookings").mockResolvedValue(mockBookings);
    renderComponent();

    await userEvent.click(
      screen.getByRole("button", { name: /all bookings/i })
    );
    await userEvent.click(screen.getByTestId("status-select"));
    await userEvent.click(await screen.findByText("Approved"));

    expect(screen.queryByText("Room A")).not.toBeInTheDocument();
    expect(await screen.findByText("Room B")).toBeInTheDocument();
  });

  it("approves a pending booking", async () => {
    const mockBookings = [
      {
        id: 1,
        room_name: "Room A",
        user_name: "User 1",
        status: "pending",
        date: "2025-01-01",
        start_time: "10:00",
        end_time: "11:00",
      },
    ];
    vi.spyOn(dataApi, "getAllBookings").mockResolvedValue(mockBookings);
    const updateSpy = vi
      .spyOn(dataApi, "updateBookingStatus")
      .mockResolvedValue({});
    renderComponent();

    const approveButton = await screen.findByRole("button", {
      name: /approve/i,
    });
    await userEvent.click(approveButton);

    expect(updateSpy).toHaveBeenCalledWith(
      "1",
      "approved",
      undefined,
      expect.any(String)
    );
  });

  it("rejects a pending booking", async () => {
    const mockBookings = [
      {
        id: 1,
        room_name: "Room A",
        user_name: "User 1",
        status: "pending",
        date: "2025-01-01",
        start_time: "10:00",
        end_time: "11:00",
      },
    ];
    vi.spyOn(dataApi, "getAllBookings").mockResolvedValue(mockBookings);
    const updateSpy = vi
      .spyOn(dataApi, "updateBookingStatus")
      .mockResolvedValue({});
    renderComponent();

    const rejectButton = await screen.findByRole("button", { name: /reject/i });
    await userEvent.click(rejectButton);

    const confirmButton = await screen.findByRole("button", {
      name: /confirm/i,
    });
    await userEvent.click(confirmButton);

    expect(updateSpy).toHaveBeenCalledWith("1", "rejected", undefined);
  });
});
