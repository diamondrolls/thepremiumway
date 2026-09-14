// Supabase Configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fjtzodjudyctqacunlqp.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqdHpvZGp1ZHljdHFhY3VubHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNjA2OTQsImV4cCI6MjA3MzYzNjY5NH0.qR9RBsecfGUfKnbWgscmxloM-oEClJs_bo5YWoxFoE4';

if (!supabaseKey) {
  console.error('Supabase key is missing. Please set VITE_SUPABASE_ANON_KEY environment variable.');
}

const { createClient } = supabase;
const client = createClient(supabaseUrl, supabaseKey);

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Helper function to show loading state
function setLoadingState(isLoading, buttonId = 'saveProfileBtn') {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Saving...' : 'Save Profile';
  }
}
// state for the profile being viewed
let currentProfileUserId = null;

// List up to `limit` photos for a user (most recent first)
async function listPhotosForUser(userId, limit = 20) {
  if (!userId) return [];

  // fetch metadata rows from profile_photos table
  const { data: rows, error } = await client
    .from('profile_photos')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching profile_photos:', error);
    return [];
  }
  if (!rows || rows.length === 0) return [];

  // convert file_path to a usable URL. Use public URL here.
  const photos = rows.map(row => {
    const { data } = client.storage.from('avatars').getPublicUrl(row.file_path);
    return {
      ...row,
      url: data?.publicUrl || null
    };
  });

  return photos;
}

// Render photos grid
function renderPhotosGrid(photos) {
  const grid = document.getElementById('photosGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!photos || photos.length === 0) {
    grid.innerHTML = '<p>No photos yet.</p>';
    return;
  }

  photos.forEach(p => {
    const tile = document.createElement('div');
    tile.className = 'photo-tile';
    tile.innerHTML = `
      <div class="thumb-wrap">
        <img src="${p.url}" alt="${escapeHtml(p.file_name || 'photo')}" loading="lazy"/>
      </div>
      <div class="photo-meta">${new Date(p.uploaded_at).toLocaleString()}</div>
    `;
    grid.appendChild(tile);
  });
}

// Simple HTML escape for file names
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Search users by display name (requires a 'profiles' table or view with id, display_name)
async function searchUsersByName(query) {
  if (!query) return [];
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name')
    .ilike('display_name', `%${query}%`)
    .limit(10);

  if (error) {
    console.error('Error searching users:', error);
    return [];
  }
  return data || [];
}

// Load another user's profile into the current page (basic)
async function loadProfileById(userId) {
  if (!userId) return;
  // fetch profile info (adjust if your profiles table columns differ)
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, avatar_url')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error loading profile:', error);
    return;
  }

  // Populate UI (update these IDs to match your markup)
  document.getElementById('userName').textContent = data.display_name || 'User';
  if (data.avatar_url) document.getElementById('userAvatar').src = data.avatar_url;

  currentProfileUserId = userId;
}
// Load profile info (avatar + name)
async function loadProfile() {
  const { data: userData, error } = await client.auth.getUser();
  if (error || !userData.user) {
    console.log("Not logged in");
    return;
  }

  const user = userData.user;
  document.getElementById('userName').textContent = user.user_metadata?.name || "User";
  document.getElementById('displayName').value = user.user_metadata?.name || "";

  // Get public URL for the user's avatar
  const filePath = `${user.id}/avatar.png`;
  
  try {
    const { data } = client.storage.from('avatars').getPublicUrl(filePath);
    
    if (data && data.publicUrl) {
      // Check if the file actually exists by attempting to load it
      const img = new Image();
      img.onload = () => {
        document.getElementById('userAvatar').src = data.publicUrl;
      };
      img.onerror = () => {
        // Keep default avatar if file doesn't exist
        console.log("Avatar not found, using default");
      };
      img.src = data.publicUrl;
    }
  } catch (error) {
    console.log("Error loading avatar:", error.message);
  }
}

// Validate avatar file
function validateAvatarFile(file) {
  if (!file) {
    return { valid: false, message: "Please select a file" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, message: "Please upload an image file (JPEG, PNG, WebP, or GIF)" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB` };
  }

  return { valid: true };
}

// Save profile with new avatar and display name
document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    alert("You must be logged in to save profile");
    return;
  }

  const user = userData.user;
  const displayName = document.getElementById('displayName').value.trim();
  const avatarFile = document.getElementById('avatarUpload').files[0];

  if (!displayName) {
    alert("Please enter a display name");
    return;
  }

  // Validate avatar if provided
  if (avatarFile) {
    const validation = validateAvatarFile(avatarFile);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }
  }

  setLoadingState(true);

  try {
    let avatarUrl = null;

    // Upload avatar if selected
    if (avatarFile) {
      const filePath = `${user.id}/avatar.png`;
      
      // Delete old avatar if exists
      try {
        await client.storage.from('avatars').remove([filePath]);
      } catch (error) {
        // Avatar may not exist, continue
        console.log("No previous avatar to delete");
      }
      
      // Upload new avatar
      const { data: uploadData, error: uploadError } = await client.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) {
        alert("Error uploading avatar: " + uploadError.message);
        setLoadingState(false);
        return;
      }

      // Get public URL
      const { data: urlData } = client.storage.from('avatars').getPublicUrl(filePath);
      avatarUrl = urlData.publicUrl;
    }

    // Update user metadata with display name and avatar
    const updateData = {
      data: {
        name: displayName
      }
    };

    if (avatarUrl) {
      updateData.data.avatar = avatarUrl;
    }

    const { error: updateError } = await client.auth.updateUser(updateData);

    if (updateError) {
      alert("Error saving profile: " + updateError.message);
      setLoadingState(false);
      return;
    }

    alert("Profile saved successfully!");
    
    // Refresh profile display
    if (avatarUrl) {
      document.getElementById('userAvatar').src = avatarUrl;
    }
    document.getElementById('userName').textContent = displayName;
    document.getElementById('avatarUpload').value = ""; // Clear file input

  } catch (error) {
    alert("Error: " + error.message);
  } finally {
    setLoadingState(false);
  }
});

// Load profile on page load
loadProfile();
document.addEventListener('DOMContentLoaded', () => {
  const photosBtn = document.getElementById('photosBtn');
  const closeBtn = document.getElementById('closePhotosBtn');
  const panel = document.getElementById('photosPanel');
  const searchBtn = document.getElementById('searchBtn');

  photosBtn?.addEventListener('click', async () => {
    panel.classList.remove('hidden');

    // ensure currentProfileUserId is set when the profile loads
    if (!currentProfileUserId) {
      // if logged-in user, set to their id (safe fallback)
      const { data: userData } = await client.auth.getUser();
      if (userData && userData.user) currentProfileUserId = userData.user.id;
    }

    const photos = await listPhotosForUser(currentProfileUserId, 20);
    renderPhotosGrid(photos);
  });

  closeBtn?.addEventListener('click', () => panel.classList.add('hidden'));

  searchBtn?.addEventListener('click', async () => {
    const q = document.getElementById('userSearch').value.trim();
    if (!q) return;
    const results = await searchUsersByName(q);
    const sr = document.getElementById('searchResults');
    sr.innerHTML = results.map(r => `<div class="sr-item" data-id="${r.id}">${escapeHtml(r.display_name)}</div>`).join('');

    sr.querySelectorAll('.sr-item').forEach(node => {
      node.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        await loadProfileById(id);
        const photos = await listPhotosForUser(id, 20);
        renderPhotosGrid(photos);
      });
    });
  });
});

// Add logout functionality
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    const { error } = await client.auth.signOut();
    
    if (error) {
      alert("Error logging out: " + error.message);
      return;
    }
    
    window.location.href = '/';
  } catch (error) {
    alert("Error: " + error.message);
  }
});
