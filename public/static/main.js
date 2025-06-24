// Theme management
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
}

// Load saved theme
const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);

// Login functionality
let csrfToken = null;

async function getCSRFToken() {
  try {
    const response = await fetch("/api/auth/csrf");
    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    console.error("Error getting CSRF token:", error);
    return null;
  }
}

async function login() {
  const password = document.getElementById("password").value;
  const loginBtn = document.getElementById("loginBtn");
  const statusMessage = document.getElementById("statusMessage");

  if (!password) {
    showStatus("Please enter a password", "error");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";

  try {
    // Get CSRF token
    const csrfToken = await getCSRFToken();
    if (!csrfToken) {
      throw new Error("Failed to get CSRF token");
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: password,
        csrf_token: csrfToken,
      }),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem("authToken", data.token);
      showStatus("Login successful! You can now manage content.", "success");
      document.getElementById("password").value = "";

      // Redirect to admin interface after successful login
      setTimeout(() => {
        window.location.href = "/youtubers";
      }, 1000);
    } else {
      showStatus(data.error || "Login failed", "error");
    }
  } catch (error) {
    console.error("Login error:", error);
    showStatus("Login failed. Please try again.", "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
}

function showStatus(message, type) {
  const statusMessage = document.getElementById("statusMessage");
  statusMessage.textContent = message;
  statusMessage.className = "status-message status-" + type;
}

// Allow Enter key to submit login
document.addEventListener("DOMContentLoaded", () => {
  const passwordInput = document.getElementById("password");
  if (passwordInput) {
    passwordInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        login();
      }
    });
  }
});
