import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Login from "../Login";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BrowserRouter } from "react-router-dom";
import { toast } from "sonner";

// Define mocks outside of vi.mock so they can be accessed in tests
const mockLogin = vi.fn();
const mockSignup = vi.fn();
const mockedNavigate = vi.fn();

// Mock the useAuth hook
vi.mock("@/contexts/AuthContext", async () => {
  const actual = await vi.importActual("@/contexts/AuthContext");
  return {
    ...actual,
    useAuth: () => ({
      login: mockLogin,
      signup: mockSignup,
    }),
  };
});

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Login Component", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockLogin.mockClear();
    mockSignup.mockClear();
    mockedNavigate.mockClear();
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it("renders login form by default", () => {
    renderComponent();
    expect(
      screen.getByRole("heading", { name: /quickroom/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sign in to your account/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("switches to sign up form when switch button is clicked", () => {
    renderComponent();
    const switchButton = screen.getByRole("button", {
      name: /don't have an account\? sign up/i,
    });
    fireEvent.click(switchButton);

    expect(
      screen.getByText(/create a new account/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign up/i })
    ).toBeInTheDocument();
  });

  it("calls login function with correct credentials and navigates on successful login", async () => {
    mockLogin.mockResolvedValue(true);
    // Mock localStorage
    Storage.prototype.getItem = vi.fn(
      () => '{"role": "student"}'
    );

    renderComponent();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "student@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("student@test.com", "password123");
      expect(toast.success).toHaveBeenCalledWith("Login successful!");
      expect(mockedNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error toast on failed login", async () => {
    mockLogin.mockResolvedValue(false);
    renderComponent();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "wrong@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
    });
  });

  it("calls signup function with correct details and navigates on successful signup", async () => {
    mockSignup.mockResolvedValue(true);
    renderComponent();

    // Switch to sign up form
    fireEvent.click(
      screen.getByRole("button", { name: /don't have an account\? sign up/i })
    );

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "newuser@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith(
        "newuser@test.com",
        "newpassword123",
        "Test User"
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Account created successfully!"
      );
      expect(mockedNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error toast on failed signup", async () => {
    mockSignup.mockResolvedValue(false);
    renderComponent();

    // Switch to sign up form
    fireEvent.click(
      screen.getByRole("button", { name: /don't have an account\? sign up/i })
    );

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "existing@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Email already exists");
    });
  });
});
