let youtubers = [];
let editingId = null;
let authToken = localStorage.getItem("authToken");

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
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");
      const actionsHtml = isAuthenticated
        ? `<div class="card-actions">
                <button class="btn btn-primary" onclick="editYouTuber(${youtuber.youtuber_id})">Edit</button>
                <button class="btn btn-danger" onclick="deleteYouTuber(${youtuber.youtuber_id})">Delete</button>
            </div>`
        : "";

      return `
            <div class="youtuber-card">
                <img src="${avatarUrl}" alt="${escapeHtml(youtuber.name)}" class="youtuber-image">
                <h3 class="youtuber-name">${escapeHtml(youtuber.name)}</h3>
                <div class="youtuber-tags">${tagsHtml}</div>
                ${actionsHtml}
            </div>
        `;
    })
    .join("");
}

// Generate avatar SVG
function generateAvatar(name) {
  const initial = name.charAt(0).toUpperCase();
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="%23ddd"/><text x="40" y="45" text-anchor="middle" font-size="16" fill="%23999">${initial}</text></svg>`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Show add modal
function showAddModal() {
  if (!authToken) {
    showStatus("Please login first", "error");
    return;
  }

  editingId = null;
  document.getElementById("modalTitle").textContent = "Add YouTuber";
  document.getElementById("youtuberForm").reset();
  document.getElementById("imagePreview").style.display = "none";
  document.getElementById("youtuberModal").classList.add("show");
}

// Edit YouTuber
function editYouTuber(id) {
  if (!authToken) {
    showStatus("Please login first", "error");
    return;
  }

  const youtuber = youtubers.find((y) => y.youtuber_id === id);
  if (!youtuber) return;

  editingId = id;
  document.getElementById("modalTitle").textContent = "Edit YouTuber";
  document.getElementById("name").value = youtuber.name;
  document.getElementById("tags").value = youtuber.tags.join(", ");

  const preview = document.getElementById("imagePreview");
  if (youtuber.image_url) {
    preview.src = youtuber.image_url;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }

  document.getElementById("youtuberModal").classList.add("show");
}

// Delete YouTuber
async function deleteYouTuber(id) {
  if (!authToken) {
    showStatus("Please login first", "error");
    return;
  }

  if (!confirm("Are you sure you want to delete this YouTuber?")) {
    return;
  }

  try {
    const response = await fetch(`/api/youtubers/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "X-CSRF-Token": authToken,
      },
    });

    const data = await response.json();

    if (data.success) {
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

// Close modal
function closeModal() {
  document.getElementById("youtuberModal").classList.remove("show");
}

// Handle form submission
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("youtuberForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!authToken) {
        showStatus("Please login first", "error");
        return;
      }

      const saveBtn = document.getElementById("saveBtn");
      const originalText = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      try {
        const formData = new FormData();
        formData.append("name", document.getElementById("name").value);
        formData.append("tags", document.getElementById("tags").value);

        const imageFile = document.getElementById("image").files[0];
        if (imageFile) {
          formData.append("image", imageFile);
        }

        const url = editingId
          ? `/api/youtubers/${editingId}`
          : "/api/youtubers";
        const method = editingId ? "PUT" : "POST";

        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${authToken}`,
            "X-CSRF-Token": authToken,
          },
          body: formData,
        });

        const data = await response.json();

        if (data.youtuber) {
          showStatus(
            `YouTuber ${editingId ? "updated" : "created"} successfully`,
            "success"
          );
          closeModal();
          loadYouTubers();
        } else {
          showStatus(
            data.error ||
              `Failed to ${editingId ? "update" : "create"} YouTuber`,
            "error"
          );
        }
      } catch (error) {
        console.error("Error saving YouTuber:", error);
        showStatus("Failed to save YouTuber", "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    });
  }

  // Image preview
  const imageInput = document.getElementById("image");
  if (imageInput) {
    imageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      const preview = document.getElementById("imagePreview");

      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.src = e.target.result;
          preview.style.display = "block";
        };
        reader.readAsDataURL(file);
      } else {
        preview.style.display = "none";
      }
    });
  }

  // Close modal when clicking outside
  const modal = document.getElementById("youtuberModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        closeModal();
      }
    });
  }

  // Initialize
  checkAuth();
  loadYouTubers();
});

// Status message
function showStatus(message, type) {
  const statusElement = document.getElementById("statusMessage");
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;

    setTimeout(() => {
      statusElement.textContent = "";
      statusElement.className = "";
    }, 5000);
  }
}
