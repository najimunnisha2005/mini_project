const API_URL = "http://localhost:8080/api/auth";

export interface AuthResponse {
  id: number;
  displayName: string;
  email: string;
  token: string;
}

interface RegisterRequest {
  displayName: string;
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

async function sendAuthRequest(
  endpoint: string,
  data: RegisterRequest | LoginRequest
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Request failed (${response.status}). Please try again.`
    );
  }

  return result as AuthResponse;
}

export function registerUser(
  data: RegisterRequest
): Promise<AuthResponse> {
  return sendAuthRequest("register", data);
}

export function loginUser(
  data: LoginRequest
): Promise<AuthResponse> {
  return sendAuthRequest("login", data);
}