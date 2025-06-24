import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import {
  securityHeaders,
  rateLimitMiddleware,
  csrfMiddleware,
  authMiddleware,
} from "./middleware";
import authRouter from "./routes/auth";
import youtubersRouter from "./routes/youtubers";
import videosRouter from "./routes/videos";
import utilsRouter from "./routes/utils";

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      // Allow requests from configured origins or localhost
      const allowedOrigins = [
        "http://localhost:8787",
        "https://localhost:8787",
      ];

      // If running in production, add the configured origins
      const corsOrigins = c.env?.CORS_ORIGINS;
      if (corsOrigins) {
        allowedOrigins.push(...corsOrigins.split(","));
      }

      return allowedOrigins.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    credentials: true,
  })
);

// Security headers
app.use("*", securityHeaders());

// Rate limiting for API routes
app.use("/api/*", rateLimitMiddleware());

// CSRF protection for state-changing operations
app.use("/api/*", csrfMiddleware());

// API Routes
app.route("/api/auth", authRouter);
app.route("/api/youtubers", youtubersRouter);
app.route("/api/videos", videosRouter);
app.route("/api/utils", utilsRouter);

// Authentication middleware for protected routes (after auth routes)
app.use("/api/youtubers", async (c, next) => {
  if (c.req.method !== "GET") {
    return authMiddleware()(c, next);
  }
  return next();
});

app.use("/api/videos", async (c, next) => {
  if (c.req.method !== "GET") {
    return authMiddleware()(c, next);
  }
  return next();
});

app.use("/api/utils/*", authMiddleware());

// Static file serving
app.get("/", async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YouTube Showcase</title>
    <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
    <header class="header">
        <div class="container">
            <h1 class="logo">YouTube Showcase</h1>
            <nav class="nav">
                <a href="/" class="nav-link">Home</a>
                <a href="/youtubers" class="nav-link">YouTubers</a>
                <a href="/videos" class="nav-link">Videos</a>
                <button id="themeToggle" class="btn btn-secondary" onclick="toggleTheme()">🌙</button>
            </nav>
        </div>
    </header>

    <main class="main">
        <div class="container">
            <div class="hero">
                <h2>Welcome to YouTube Showcase</h2>
                <p>Discover amazing YouTubers and their best videos</p>
                <div class="hero-actions">
                    <a href="/youtubers" class="btn btn-primary">Browse YouTubers</a>
                    <a href="/videos" class="btn btn-secondary">Watch Videos</a>
                </div>
            </div>

            <div class="auth-section">
                <div id="authStatus" class="auth-status"></div>
                <div id="authActions" class="auth-actions">
                    <button id="loginBtn" class="btn btn-outline" onclick="showLoginModal()">Admin Login</button>
                    <button id="logoutBtn" class="btn btn-outline" onclick="logout()" style="display: none;">Logout</button>
                </div>
            </div>
        </div>
    </main>

    <!-- Login Modal -->
    <div id="loginModal" class="modal">
        <div class="modal-content">
            <h3>Admin Login</h3>
            <form id="loginForm">
                <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" name="password" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="hideLoginModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Login</button>
                </div>
            </form>
        </div>
    </div>

    <div id="statusMessage" class="status-message"></div>

    <script src="/static/main.js"></script>
</body>
</html>`;

  return c.html(html);
});

app.get("/youtubers", async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YouTubers - YouTube Showcase</title>
    <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
    <header class="header">
        <div class="container">
            <h1 class="logo">YouTube Showcase</h1>
            <nav class="nav">
                <a href="/" class="nav-link">Home</a>
                <a href="/youtubers" class="nav-link active">YouTubers</a>
                <a href="/videos" class="nav-link">Videos</a>
                <button id="themeToggle" class="btn btn-secondary" onclick="toggleTheme()">🌙</button>
            </nav>
        </div>
    </header>

    <main class="main">
        <div class="container">
            <div class="page-header">
                <h2>YouTubers</h2>
                <button id="addBtn" class="btn btn-primary" onclick="showAddModal()" style="display: none;">Add YouTuber</button>
            </div>

            <div id="loadingState" class="loading-state">
                <p>Loading YouTubers...</p>
            </div>

            <div id="youtubersGrid" class="youtubers-grid"></div>
        </div>
    </main>

    <!-- Add/Edit Modal -->
    <div id="youtuberModal" class="modal">
        <div class="modal-content">
            <h3 id="modalTitle">Add YouTuber</h3>
            <form id="youtuberForm">
                <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" id="name" name="name" required>
                </div>
                <div class="form-group">
                    <label for="tags">Tags (comma-separated):</label>
                    <input type="text" id="tags" name="tags" placeholder="gaming, tech, tutorial">
                </div>
                <div class="form-group">
                    <label for="image">Image:</label>
                    <input type="file" id="image" name="image" accept="image/*">
                    <small class="form-help">Optional: Upload an image or leave blank for auto-generated avatar</small>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="hideYouTuberModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                </div>
            </form>
        </div>
    </div>

    <div id="statusMessage" class="status-message"></div>

    <script src="/static/youtubers.js"></script>
</body>
</html>`;

  return c.html(html);
});

app.get("/videos", async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Videos - YouTube Showcase</title>
    <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
    <header class="header">
        <div class="container">
            <h1 class="logo">YouTube Showcase</h1>
            <nav class="nav">
                <a href="/" class="nav-link">Home</a>
                <a href="/youtubers" class="nav-link">YouTubers</a>
                <a href="/videos" class="nav-link active">Videos</a>
                <button id="themeToggle" class="btn btn-secondary" onclick="toggleTheme()">🌙</button>
            </nav>
        </div>
    </header>

    <main class="main">
        <div class="container">
            <div class="page-header">
                <h2>Videos</h2>
                <button id="addBtn" class="btn btn-primary" onclick="showAddModal()" style="display: none;">Add Video</button>
            </div>

            <div id="loadingState" class="loading-state">
                <p>Loading videos...</p>
            </div>

            <div id="videosGrid" class="videos-grid"></div>
        </div>
    </main>

    <!-- Add/Edit Modal -->
    <div id="videoModal" class="modal">
        <div class="modal-content">
            <h3 id="modalTitle">Add Video</h3>
            <form id="videoForm">
                <div class="form-group">
                    <label for="title">Title:</label>
                    <input type="text" id="title" name="title" required>
                </div>
                <div class="form-group">
                    <label for="url">YouTube URL:</label>
                    <input type="url" id="url" name="url" required placeholder="https://www.youtube.com/watch?v=...">
                    <small class="form-help">We'll automatically extract video information</small>
                </div>
                <div class="form-group">
                    <label for="youtuber_id">YouTuber:</label>
                    <select id="youtuber_id" name="youtuber_id" required>
                        <option value="">Select a YouTuber</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="description">Description:</label>
                    <textarea id="description" name="description" rows="3"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="hideVideoModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                </div>
            </form>
        </div>
    </main>

    <div id="statusMessage" class="status-message"></div>

    <script src="/static/videos.js"></script>
</body>
</html>`;

  return c.html(html);
});

// Serve static CSS and JS files
app.get("/static/styles.css", async (c) => {
  const css = `/* Modern CSS Variables and Reset */
:root {
  /* Light theme colors */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #e9ecef;
  --text-primary: #212529;
  --text-secondary: #6c757d;
  --text-muted: #adb5bd;
  --border-color: #dee2e6;
  --shadow: 0 2px 4px rgba(0,0,0,0.1);
  --shadow-hover: 0 4px 8px rgba(0,0,0,0.15);
  --primary: #007bff;
  --primary-dark: #0056b3;
  --secondary: #6c757d;
  --success: #28a745;
  --danger: #dc3545;
  --warning: #ffc107;
  --info: #17a2b8;
}

[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #404040;
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --text-muted: #808080;
  --border-color: #404040;
  --shadow: 0 2px 4px rgba(0,0,0,0.3);
  --shadow-hover: 0 4px 8px rgba(0,0,0,0.4);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  line-height: 1.6;
  color: var(--text-primary);
  background-color: var(--bg-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header */
.header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--primary);
}

.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav-link {
  text-decoration: none;
  color: var(--text-secondary);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.nav-link:hover,
.nav-link.active {
  color: var(--primary);
  background: var(--bg-tertiary);
}

/* Main Content */
.main {
  padding: 2rem 0;
  min-height: calc(100vh - 100px);
}

.hero {
  text-align: center;
  padding: 3rem 0;
  margin-bottom: 2rem;
}

.hero h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.hero p {
  font-size: 1.2rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-header h2 {
  font-size: 2rem;
  color: var(--text-primary);
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--secondary);
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
  transform: translateY(-1px);
}

.btn-outline {
  background: transparent;
  color: var(--primary);
  border: 2px solid var(--primary);
}

.btn-outline:hover {
  background: var(--primary);
  color: white;
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

/* Grid Layouts */
.youtubers-grid,
.videos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

/* Cards */
.youtuber-card,
.video-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: var(--shadow);
  transition: all 0.3s ease;
}

.youtuber-card:hover,
.video-card:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}

.youtuber-image {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin: 0 auto 1rem;
  display: block;
  object-fit: cover;
}

.youtuber-name,
.video-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  text-align: center;
  color: var(--text-primary);
}

.youtuber-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.tag {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.85rem;
}

.video-thumbnail {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.video-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.video-description {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 1rem;
}

/* Auth Section */
.auth-section {
  text-align: center;
  padding: 2rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  margin-bottom: 2rem;
}

.auth-status {
  margin-bottom: 1rem;
  font-weight: 500;
}

.auth-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* Modal */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary);
  margin: 5% auto;
  padding: 2rem;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: var(--shadow-hover);
}

.modal h3 {
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

/* Forms */
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 1rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.2s ease;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-help {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

/* Status Messages */
.status-message {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 1rem 1.5rem;
  border-radius: 6px;
  font-weight: 500;
  z-index: 1001;
  transform: translateX(400px);
  opacity: 0;
  transition: all 0.3s ease;
}

.status-message.show {
  transform: translateX(0);
  opacity: 1;
}

.status-success {
  background: var(--success);
  color: white;
}

.status-error {
  background: var(--danger);
  color: white;
}

.status-info {
  background: var(--info);
  color: white;
}

/* Loading and Empty States */
.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.loading-state p,
.empty-state h3 {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: var(--text-muted);
}

/* Responsive Design */
@media (max-width: 768px) {
  .container {
    padding: 0 15px;
  }
  
  .hero h2 {
    font-size: 2rem;
  }
  
  .hero p {
    font-size: 1rem;
  }
  
  .hero-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .youtubers-grid,
  .videos-grid {
    grid-template-columns: 1fr;
  }
  
  .modal-content {
    margin: 10% auto;
    width: 95%;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .nav {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}

@media (max-width: 480px) {
  .header .container {
    flex-direction: column;
    gap: 1rem;
  }
  
  .auth-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .card-actions {
    flex-direction: column;
  }
}

/* Test Page Styles */
.test-page {
  font-family: Arial, sans-serif;
  padding: 2rem;
}

.test-page .btn {
  padding: 1rem;
  margin: 1rem;
  font-size: 1rem;
  cursor: pointer;
}

.test-page .modal {
  display: none;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 2rem;
  border: 1px solid #ccc;
  z-index: 1000;
}

[data-theme="dark"] {
  background: #333;
  color: white;
}

[data-theme="dark"] .modal {
  background: #444;
  color: white;
}
`;

  return c.text(css, 200, {
    "Content-Type": "text/css",
  });
});

app.get("/static/main.js", async (c) => {
  const js = `let authToken = localStorage.getItem("authToken");

// Theme management
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeToggle();
}

function updateThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    toggle.textContent = currentTheme === "dark" ? "☀️" : "🌙";
  }
}

// Load saved theme
const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);

// Check authentication status
function checkAuth() {
  const isAuthenticated = !!authToken;
  const authStatus = document.getElementById("authStatus");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (authStatus) {
    if (isAuthenticated) {
      authStatus.textContent = "You are logged in as admin";
      authStatus.style.color = "var(--success)";
    } else {
      authStatus.textContent = "Not logged in";
      authStatus.style.color = "var(--text-secondary)";
    }
  }

  if (loginBtn) {
    loginBtn.style.display = isAuthenticated ? "none" : "inline-block";
  }
  
  if (logoutBtn) {
    logoutBtn.style.display = isAuthenticated ? "inline-block" : "none";
  }
}

// Login modal
function showLoginModal() {
  const modal = document.getElementById("loginModal");
  if (modal) {
    modal.style.display = "block";
  }
}

function hideLoginModal() {
  const modal = document.getElementById("loginModal");
  if (modal) {
    modal.style.display = "none";
  }
  // Clear form
  const form = document.getElementById("loginForm");
  if (form) {
    form.reset();
  }
}

// Login function
async function login(password) {
  try {
    // Get CSRF token first
    const csrfResponse = await fetch("/api/auth/csrf");
    const csrfData = await csrfResponse.json();
    
    if (!csrfData.csrfToken) {
      throw new Error("Failed to get CSRF token");
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfData.csrfToken,
      },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();

    if (data.token) {
      authToken = data.token;
      localStorage.setItem("authToken", authToken);
      showStatus("Login successful!", "success");
      hideLoginModal();
      checkAuth();
    } else {
      showStatus(data.error || "Login failed", "error");
    }
  } catch (error) {
    console.error("Login error:", error);
    showStatus("Login failed", "error");
  }
}

// Logout function
function logout() {
  authToken = null;
  localStorage.removeItem("authToken");
  showStatus("Logged out successfully", "info");
  checkAuth();
}

// Status message
function showStatus(message, type) {
  const statusElement = document.getElementById("statusMessage");
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = "status-message status-" + type + " show";

    setTimeout(() => {
      statusElement.className = "status-message";
      setTimeout(() => {
        statusElement.textContent = "";
      }, 300);
    }, 3000);
  }
}

// Event listeners
document.addEventListener("DOMContentLoaded", function () {
  updateThemeToggle();
  checkAuth();

  // Login form
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const password = document.getElementById("password").value;
      login(password);
    });
  }

  // Close modal when clicking outside
  const modal = document.getElementById("loginModal");
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        hideLoginModal();
      }
    });
  }
});`;

  return c.text(js, 200, {
    "Content-Type": "application/javascript",
  });
});

app.get("/static/youtubers.js", async (c) => {
  const js = `let youtubers = [];
let editingId = null;
let authToken = localStorage.getItem("authToken");

// Theme management
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeToggle();
}

function updateThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    toggle.textContent = currentTheme === "dark" ? "☀️" : "🌙";
  }
}

// Load saved theme
const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);

// Check authentication and show/hide admin controls
function checkAuth() {
  const isAuthenticated = !!authToken;
  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.style.display = isAuthenticated ? "block" : "none";
  }

  // Hide/show edit/delete buttons on cards
  document.querySelectorAll(".card-actions").forEach((actions) => {
    actions.style.display = isAuthenticated ? "flex" : "none";
  });
}

// Load YouTubers
async function loadYouTubers() {
  try {
    const response = await fetch("/api/youtubers");
    const data = await response.json();

    if (data.youtubers) {
      youtubers = data.youtubers;
      renderYouTubers();
    } else {
      showStatus("Failed to load YouTubers", "error");
    }
  } catch (error) {
    console.error("Error loading YouTubers:", error);
    showStatus("Failed to load YouTubers", "error");
  } finally {
    const loadingState = document.getElementById("loadingState");
    if (loadingState) {
      loadingState.style.display = "none";
    }
  }
}

// Render YouTubers
function renderYouTubers() {
  const grid = document.getElementById("youtubersGrid");
  if (!grid) return;

  if (youtubers.length === 0) {
    grid.innerHTML =
      '<div class="empty-state"><h3>No YouTubers found</h3><p>Add some YouTubers to get started!</p></div>';
    return;
  }

  const isAuthenticated = !!authToken;

  grid.innerHTML = youtubers
    .map((youtuber) => {
      const avatarUrl = youtuber.image_url || generateAvatar(youtuber.name);
      const tagsHtml = youtuber.tags
        .map((tag) => "<span class='tag'>" + escapeHtml(tag) + "</span>")
        .join("");
      const actionsHtml = isAuthenticated
        ? "<div class='card-actions'>" +
                "<button class='btn btn-primary' onclick='editYouTuber(" + youtuber.youtuber_id + ")'>Edit</button>" +
                "<button class='btn btn-danger' onclick='deleteYouTuber(" + youtuber.youtuber_id + ")'>Delete</button>" +
            "</div>"
        : "";

      return "<div class='youtuber-card'>" +
                "<img src='" + avatarUrl + "' alt='" + escapeHtml(youtuber.name) + "' class='youtuber-image'>" +
                "<h3 class='youtuber-name'>" + escapeHtml(youtuber.name) + "</h3>" +
                "<div class='youtuber-tags'>" + tagsHtml + "</div>" +
                actionsHtml +
            "</div>";
    })
    .join("");
}

// Generate avatar SVG
function generateAvatar(name) {
  const initial = name.charAt(0).toUpperCase();
  return "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><circle cx='40' cy='40' r='40' fill='%23ddd'/><text x='40' y='45' text-anchor='middle' font-size='16' fill='%23999'>" + initial + "</text></svg>";
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Show add modal
function showAddModal() {
  editingId = null;
  document.getElementById("modalTitle").textContent = "Add YouTuber";
  document.getElementById("youtuberForm").reset();
  document.getElementById("youtuberModal").style.display = "block";
}

// Hide modal
function hideYouTuberModal() {
  document.getElementById("youtuberModal").style.display = "none";
  editingId = null;
}

// Edit YouTuber
function editYouTuber(id) {
  const youtuber = youtubers.find((y) => y.youtuber_id === id);
  if (!youtuber) return;

  editingId = id;
  document.getElementById("modalTitle").textContent = "Edit YouTuber";
  document.getElementById("name").value = youtuber.name;
  document.getElementById("tags").value = youtuber.tags.join(", ");
  document.getElementById("youtuberModal").style.display = "block";
}

// Delete YouTuber
async function deleteYouTuber(id) {
  if (!confirm("Are you sure you want to delete this YouTuber?")) return;

  try {
    // Get CSRF token
    const csrfResponse = await fetch("/api/auth/csrf");
    const csrfData = await csrfResponse.json();

    const response = await fetch("/api/youtubers/" + id, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + authToken,
        "X-CSRF-Token": csrfData.csrfToken,
      },
    });

    const data = await response.json();

    if (response.ok) {
      showStatus("YouTuber deleted successfully", "success");
      loadYouTubers();
    } else {
      showStatus(data.error || "Failed to delete YouTuber", "error");
    }
  } catch (error) {
    console.error("Error deleting YouTuber:", error);
    showStatus("Failed to delete YouTuber", "error");
  }
}

// Save YouTuber
async function saveYouTuber(formData) {
  try {
    // Get CSRF token
    const csrfResponse = await fetch("/api/auth/csrf");
    const csrfData = await csrfResponse.json();

    const url = editingId ? "/api/youtubers/" + editingId : "/api/youtubers";
    const method = editingId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: "Bearer " + authToken,
        "X-CSRF-Token": csrfData.csrfToken,
      },
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      showStatus(
        "YouTuber " + (editingId ? "updated" : "created") + " successfully",
        "success"
      );
      hideYouTuberModal();
      loadYouTubers();
    } else {
      showStatus(data.error || "Failed to save YouTuber", "error");
    }
  } catch (error) {
    console.error("Error saving YouTuber:", error);
    showStatus("Failed to save YouTuber", "error");
  }
}

// Status message
function showStatus(message, type) {
  const statusElement = document.getElementById("statusMessage");
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = "status-message status-" + type + " show";

    setTimeout(() => {
      statusElement.className = "status-message";
      setTimeout(() => {
        statusElement.textContent = "";
      }, 300);
    }, 3000);
  }
}

// Event listeners
document.addEventListener("DOMContentLoaded", function () {
  updateThemeToggle();
  
  // YouTuber form
  const youtuberForm = document.getElementById("youtuberForm");
  if (youtuberForm) {
    youtuberForm.addEventListener("submit", function (e) {
      e.preventDefault();
      
      const formData = new FormData();
      formData.append("name", document.getElementById("name").value);
      
      const tags = document.getElementById("tags").value;
      if (tags.trim()) {
        formData.append("tags", tags);
      }
      
      const imageFile = document.getElementById("image").files[0];
      if (imageFile) {
        formData.append("image", imageFile);
      }
      
      saveYouTuber(formData);
    });
  }

  // Close modal when clicking outside
  const modal = document.getElementById("youtuberModal");
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        hideYouTuberModal();
      }
    });
  }

  // Initialize
  checkAuth();
  loadYouTubers();
});`;

  return c.text(js, 200, {
    "Content-Type": "application/javascript",
  });
});

app.get("/static/videos.js", async (c) => {
  const js = `let videos = [];
let youtubers = [];
let editingId = null;
let authToken = localStorage.getItem("authToken");

// Theme management
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeToggle();
}

function updateThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    toggle.textContent = currentTheme === "dark" ? "☀️" : "🌙";
  }
}

// Load saved theme
const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);

// Check authentication and show/hide admin controls
function checkAuth() {
  const isAuthenticated = !!authToken;
  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.style.display = isAuthenticated ? "block" : "none";
  }

  // Hide/show edit/delete buttons on cards
  document.querySelectorAll(".card-actions").forEach((actions) => {
    actions.style.display = isAuthenticated ? "flex" : "none";
  });
}

// Load Videos
async function loadVideos() {
  try {
    const response = await fetch("/api/videos");
    const data = await response.json();

    if (data.videos) {
      videos = data.videos;
      renderVideos();
    } else {
      showStatus("Failed to load videos", "error");
    }
  } catch (error) {
    console.error("Error loading videos:", error);
    showStatus("Failed to load videos", "error");
  } finally {
    const loadingState = document.getElementById("loadingState");
    if (loadingState) {
      loadingState.style.display = "none";
    }
  }
}

// Load YouTubers for dropdown
async function loadYouTubersForDropdown() {
  try {
    const response = await fetch("/api/youtubers");
    const data = await response.json();

    if (data.youtubers) {
      youtubers = data.youtubers;
      populateYouTuberDropdown();
    }
  } catch (error) {
    console.error("Error loading YouTubers:", error);
  }
}

// Populate YouTuber dropdown
function populateYouTuberDropdown() {
  const select = document.getElementById("youtuber_id");
  if (!select) return;

  select.innerHTML = '<option value="">Select a YouTuber</option>';
  youtubers.forEach((youtuber) => {
    const option = document.createElement("option");
    option.value = youtuber.youtuber_id;
    option.textContent = youtuber.name;
    select.appendChild(option);
  });
}

// Render Videos
function renderVideos() {
  const grid = document.getElementById("videosGrid");
  if (!grid) return;

  if (videos.length === 0) {
    grid.innerHTML =
      '<div class="empty-state"><h3>No videos found</h3><p>Add some videos to get started!</p></div>';
    return;
  }

  const isAuthenticated = !!authToken;

  grid.innerHTML = videos
    .map((video) => {
      const youtuber = youtubers.find((y) => y.youtuber_id === video.youtuber_id);
      const youtuberName = youtuber ? youtuber.name : "Unknown";
      const thumbnailUrl = video.thumbnail_url || "https://via.placeholder.com/320x180?text=No+Thumbnail";
      const actionsHtml = isAuthenticated
        ? "<div class='card-actions'>" +
                "<button class='btn btn-primary' onclick='editVideo(" + video.video_id + ")'>Edit</button>" +
                "<button class='btn btn-danger' onclick='deleteVideo(" + video.video_id + ")'>Delete</button>" +
            "</div>"
        : "";

      return "<div class='video-card'>" +
                "<img src='" + thumbnailUrl + "' alt='" + escapeHtml(video.title) + "' class='video-thumbnail'>" +
                "<h3 class='video-title'>" + escapeHtml(video.title) + "</h3>" +
                "<div class='video-meta'>" +
                    "<span>by " + escapeHtml(youtuberName) + "</span>" +
                "</div>" +
                (video.description ? "<p class='video-description'>" + escapeHtml(video.description) + "</p>" : "") +
                "<a href='" + video.url + "' target='_blank' class='btn btn-primary' style='margin-top: 1rem;'>Watch Video</a>" +
                actionsHtml +
            "</div>";
    })
    .join("");
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Show add modal
function showAddModal() {
  editingId = null;
  document.getElementById("modalTitle").textContent = "Add Video";
  document.getElementById("videoForm").reset();
  document.getElementById("videoModal").style.display = "block";
}

// Hide modal
function hideVideoModal() {
  document.getElementById("videoModal").style.display = "none";
  editingId = null;
}

// Edit Video
function editVideo(id) {
  const video = videos.find((v) => v.video_id === id);
  if (!video) return;

  editingId = id;
  document.getElementById("modalTitle").textContent = "Edit Video";
  document.getElementById("title").value = video.title;
  document.getElementById("url").value = video.url;
  document.getElementById("youtuber_id").value = video.youtuber_id;
  document.getElementById("description").value = video.description || "";
  document.getElementById("videoModal").style.display = "block";
}

// Delete Video
async function deleteVideo(id) {
  if (!confirm("Are you sure you want to delete this video?")) return;

  try {
    // Get CSRF token
    const csrfResponse = await fetch("/api/auth/csrf");
    const csrfData = await csrfResponse.json();

    const response = await fetch("/api/videos/" + id, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + authToken,
        "X-CSRF-Token": csrfData.csrfToken,
      },
    });

    const data = await response.json();

    if (response.ok) {
      showStatus("Video deleted successfully", "success");
      loadVideos();
    } else {
      showStatus(data.error || "Failed to delete video", "error");
    }
  } catch (error) {
    console.error("Error deleting video:", error);
    showStatus("Failed to delete video", "error");
  }
}

// Save Video
async function saveVideo(videoData) {
  try {
    // Get CSRF token
    const csrfResponse = await fetch("/api/auth/csrf");
    const csrfData = await csrfResponse.json();

    const url = editingId ? "/api/videos/" + editingId : "/api/videos";
    const method = editingId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + authToken,
        "X-CSRF-Token": csrfData.csrfToken,
      },
      body: JSON.stringify(videoData),
    });

    const data = await response.json();

    if (response.ok) {
      showStatus(
        "Video " + (editingId ? "updated" : "created") + " successfully",
        "success"
      );
      hideVideoModal();
      loadVideos();
    } else {
      showStatus(data.error || "Failed to save video", "error");
    }
  } catch (error) {
    console.error("Error saving video:", error);
    showStatus("Failed to save video", "error");
  }
}

// Status message
function showStatus(message, type) {
  const statusElement = document.getElementById("statusMessage");
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = "status-message status-" + type + " show";

    setTimeout(() => {
      statusElement.className = "status-message";
      setTimeout(() => {
        statusElement.textContent = "";
      }, 300);
    }, 3000);
  }
}

// Event listeners
document.addEventListener("DOMContentLoaded", function () {
  updateThemeToggle();
  
  // Video form
  const videoForm = document.getElementById("videoForm");
  if (videoForm) {
    videoForm.addEventListener("submit", function (e) {
      e.preventDefault();
      
      const videoData = {
        title: document.getElementById("title").value,
        url: document.getElementById("url").value,
        youtuber_id: parseInt(document.getElementById("youtuber_id").value),
        description: document.getElementById("description").value || null,
      };
      
      saveVideo(videoData);
    });
  }

  // Close modal when clicking outside
  const modal = document.getElementById("videoModal");
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        hideVideoModal();
      }
    });
  }

  // Initialize
  checkAuth();
  loadYouTubersForDropdown();
  loadVideos();
});`;

  return c.text(js, 200, {
    "Content-Type": "application/javascript",
  });
});

// Test page to debug issues
app.get('/test', async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Page</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 2rem; }
        .btn { padding: 1rem; margin: 1rem; font-size: 1rem; cursor: pointer; }
        .modal { display: none; position: fixed; top: 50%; left: 50%; 
                transform: translate(-50%, -50%); background: white; 
                padding: 2rem; border: 1px solid #ccc; z-index: 1000; }
        [data-theme="dark"] { background: #333; color: white; }
        [data-theme="dark"] .modal { background: #444; color: white; }
    </style>
</head>
<body>
    <h1>Theme & Login Test</h1>
    <button id="themeToggle" class="btn" onclick="toggleTheme()">🌙 Toggle Theme</button>
    <button id="loginBtn" class="btn" onclick="showLoginModal()">📝 Show Login Modal</button>
    
    <div id="loginModal" class="modal">
        <h3>Login Modal</h3>
        <input type="password" id="password" placeholder="Password">
        <button onclick="login()">Login</button>
        <button onclick="hideLoginModal()">Cancel</button>
    </div>
    
    <div id="status"></div>
    
    <script>
        // Theme management
        function toggleTheme() {
            console.log('toggleTheme called');
            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            document.getElementById('themeToggle').textContent = newTheme === 'dark' ? '☀️ Toggle Theme' : '🌙 Toggle Theme';
            showStatus('Theme changed to ' + newTheme, 'success');
        }
        
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.getElementById('themeToggle').textContent = savedTheme === 'dark' ? '☀️ Toggle Theme' : '🌙 Toggle Theme';
        
        // Login modal
        function showLoginModal() {
            console.log('showLoginModal called');
            document.getElementById('loginModal').style.display = 'block';
            showStatus('Login modal opened', 'info');
        }
        
        function hideLoginModal() {
            console.log('hideLoginModal called');
            document.getElementById('loginModal').style.display = 'none';
        }
        
        // Login function
        async function login() {
            const password = document.getElementById('password').value;
            if (!password) {
                showStatus('Enter a password', 'error');
                return;
            }
            
            try {
                // Get CSRF token
                const csrfResponse = await fetch('/api/auth/csrf');
                const csrfData = await csrfResponse.json();
                
                showStatus('Got CSRF token: ' + csrfData.csrfToken.substring(0, 20) + '...', 'info');
                
                // Try login
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, csrf_token: csrfData.csrfToken })
                });
                
                const data = await response.json();
                
                if (data.token) {
                    showStatus('Login successful! Token: ' + data.token.substring(0, 20) + '...', 'success');
                    hideLoginModal();
                } else {
                    showStatus('Login failed: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                showStatus('Login error: ' + error.message, 'error');
            }
        }
        
        function showStatus(message, type) {
            const colors = { success: 'green', error: 'red', info: 'blue' };
            document.getElementById('status').innerHTML = 
                '<div style="color: ' + colors[type] + '; margin: 1rem 0;">' + message + '</div>';
        }
        
        console.log('Test page loaded');
    </script>
</body>
</html>`;
  
  return c.html(html);
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
