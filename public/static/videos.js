let videos = [];
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
      const thumbnailUrl = video.thumbnail_url || generateVideoThumbnail();
      const descriptionHtml = video.description
        ? `<p class="video-description">${escapeHtml(video.description)}</p>`
        : "";
      const actionsHtml = isAuthenticated
        ? `<div class="card-actions">
                <button class="btn btn-primary" onclick="editVideo(${video.video_id})">Edit</button>
                <button class="btn btn-danger" onclick="deleteVideo(${video.video_id})">Delete</button>
            </div>`
        : "";

      return `
            <div class="video-card">
                <img src="${thumbnailUrl}" alt="${escapeHtml(video.title)}" class="video-thumbnail" onclick="window.open('${video.url}', '_blank')">
                <div class="video-content">
                    <h3 class="video-title">${escapeHtml(video.title)}</h3>
                    ${descriptionHtml}
                    <a href="${video.url}" target="_blank" class="video-url">${escapeHtml(video.url)}</a>
                    ${actionsHtml}
                </div>
            </div>
        `;
    })
    .join("");
}

// Generate video thumbnail placeholder
function generateVideoThumbnail() {
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="350" height="200" viewBox="0 0 350 200"><rect width="350" height="200" fill="%23ddd"/><text x="175" y="100" text-anchor="middle" font-size="16" fill="%23999">No Thumbnail</text></svg>`;
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
  document.getElementById("modalTitle").textContent = "Add Video";
  document.getElementById("videoForm").reset();
  document.getElementById("thumbnailPreview").style.display = "none";
  document.getElementById("videoModal").classList.add("show");
}

// Edit Video
function editVideo(id) {
  if (!authToken) {
    showStatus("Please login first", "error");
    return;
  }

  const video = videos.find((v) => v.video_id === id);
  if (!video) return;

  editingId = id;
  document.getElementById("modalTitle").textContent = "Edit Video";
  document.getElementById("url").value = video.url;
  document.getElementById("title").value = video.title;
  document.getElementById("description").value = video.description || "";

  const preview = document.getElementById("thumbnailPreview");
  if (video.thumbnail_url) {
    preview.src = video.thumbnail_url;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }

  document.getElementById("videoModal").classList.add("show");
}

// Delete Video
async function deleteVideo(id) {
  if (!authToken) {
    showStatus("Please login first", "error");
    return;
  }

  if (!confirm("Are you sure you want to delete this video?")) {
    return;
  }

  try {
    const response = await fetch(`/api/videos/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "X-CSRF-Token": authToken,
      },
    });

    const data = await response.json();

    if (data.success) {
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

// Close modal
function closeModal() {
  document.getElementById("videoModal").classList.remove("show");
}

// Handle form submission
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("videoForm");
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
        formData.append("url", document.getElementById("url").value);
        formData.append("title", document.getElementById("title").value);
        formData.append(
          "description",
          document.getElementById("description").value
        );

        const thumbnailFile =
          document.getElementById("custom_thumbnail").files[0];
        if (thumbnailFile) {
          formData.append("custom_thumbnail", thumbnailFile);
        }

        const url = editingId ? `/api/videos/${editingId}` : "/api/videos";
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

        if (data.video) {
          showStatus(
            `Video ${editingId ? "updated" : "created"} successfully`,
            "success"
          );
          closeModal();
          loadVideos();
        } else {
          showStatus(
            data.error || `Failed to ${editingId ? "update" : "create"} video`,
            "error"
          );
        }
      } catch (error) {
        console.error("Error saving video:", error);
        showStatus("Failed to save video", "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    });
  }

  // Thumbnail preview
  const thumbnailInput = document.getElementById("custom_thumbnail");
  if (thumbnailInput) {
    thumbnailInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      const preview = document.getElementById("thumbnailPreview");

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
  const modal = document.getElementById("videoModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        closeModal();
      }
    });
  }

  // Initialize
  checkAuth();
  loadVideos();
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
// UPDATED FILE - Wed Jun 25 00:41:33 IST 2025
